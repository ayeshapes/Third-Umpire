"""
ESPNcricinfo Player Profile Scraper (v4 -- verified endpoint + fixed regex)

CONFIRMED (via direct fetch of a real page, not guessed) in this session:

- https://stats.espncricinfo.com/{slug}/engine/player/{id}.html?...type=allround
  IS reachable -- no Akamai block. This is the Statsguru "engine" path.
- https://stats.espncricinfo.com/{slug}/content/player/{id}.html
  (the actual "Bio & Career Stats" page, which is where Playing Role,
  height, nicknames etc. live) IS STILL Akamai-blocked, even on this
  subdomain. So this endpoint gets you batting style, bowling style, and
  date of birth reliably -- but NOT playing role. That field stays blank;
  there's currently no known-accessible source for it.
- Real confirmed header line format on the engine page:
      "{Full Name} - {batting style}; {bowling style} - Player profile
       Born {Month DD, YYYY}"
  e.g. "Sachin Tendulkar - right-hand bat; right-arm offbreak, legbreak
       googly - Player profile Born April 24, 1973"
  Batting-only players omit the "; {bowling style}" part entirely.

BUG FIXED in this version: the old regex excluded hyphens from the
bowling-style capture group ([^-]*?), but almost every bowling style
description contains one ("right-arm ...", "left-arm ..."). That silently
truncated or nulled out batting_style/bowling_style for most bowlers.
Verified against real sample text before and after the fix -- see
test_regex.py output from this session if you want to rerun the check.

Setup (run once):
    pip install playwright
    playwright install chromium

Usage:
    python3 scraper.py player_ids.csv data/raw_scraped/player_profiles.csv --limit 10

Notes:
- I (Claude) verified the endpoint and page format via web search + fetch
  in this session -- that's different from actually running this Playwright
  script, which needs a real browser and network access I don't have in
  this sandbox. You'll need to run this yourself and confirm it end-to-end.
- Still writes incrementally; safe to stop and resume (skips names already
  in the output CSV).
"""

import csv
import os
import re
import sys
import time
import random
from playwright.sync_api import sync_playwright

DELAY_RANGE = (3.0, 5.0)


def polite_sleep():
    time.sleep(random.uniform(*DELAY_RANGE))


def already_done(out_csv):
    done = set()
    if os.path.exists(out_csv):
        with open(out_csv, newline="") as f:
            for r in csv.DictReader(f):
                done.add(r["source_player_name"])
    return done


def append_row(out_csv, row, fieldnames):
    write_header = not os.path.exists(out_csv)
    with open(out_csv, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        if write_header:
            w.writeheader()
        w.writerow(row)


# Matches: "- {batting style}[; {bowling style}] - Player profile Born {date}"
# Uses .*? (not [^-]*?) so hyphens inside "right-arm"/"left-arm" etc. don't
# break the match. Non-greedy still stops at the first "- Player profile".
HEADER_PATTERN = re.compile(
    r"-\s*(.*?)\s*-\s*Player profile\s*Born\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})",
    re.IGNORECASE,
)


# Real block/anti-bot pages say things like these, rather than legitimate
# "no records for this query" pages. If we see one of these, treat it as
# a BLOCK (stop entirely) rather than just "no header, try next class" --
# retrying more classes or players while blocked just burns more requests
# against a site that's already flagged us.
BLOCK_INDICATORS = [
    "access denied",
    "pardon our interruption",
    "reference #",
    "request unsuccessful",
    "you don't have permission",
    "captcha",
]


def looks_blocked(body_text):
    lowered = body_text.lower()
    return any(indicator in lowered for indicator in BLOCK_INDICATORS)


def parse_header(body_text):
    m = HEADER_PATTERN.search(body_text)
    if not m:
        return "", "", ""
    style_blob, dob = m.groups()
    parts = [p.strip() for p in style_blob.split(";")]
    batting_style = parts[0] if parts and parts[0] else ""
    bowling_style = parts[1] if len(parts) > 1 and parts[1] else ""
    return batting_style, bowling_style, dob


# (class, type) combos to try, in order. Statsguru omits the header line
# entirely when a player has zero matching records for the requested class,
# so a single hardcoded class silently fails for anyone whose career sits
# in a different bucket:
#   class=6  -> Twenty20 matches (domestic T20, incl. PSL) with type=allround
#   class=11 -> Combined Test/ODI/T20I (international) with type=allround
# Most PSL players will hit on class=6 since many never played
# international cricket. class=11 is kept as a fallback for the ones who
# did (e.g. capped internationals who also played PSL).
CLASS_ATTEMPTS = [
    (6, "allround"),
    (11, "allround"),
]


def scrape_profile(page, espn_id):
    body_text = ""
    for class_id, type_ in CLASS_ATTEMPTS:
        # NOTE: deliberately NOT including "template=results" here -- that
        # param makes the engine return a bare results-table fragment with
        # the bio header line stripped out. Confirmed by comparing against
        # several real working page URLs (Sachin Tendulkar, AB de Villiers,
        # Virat Kohli) -- none of them include template=results, and all of
        # them show the header. Every blank result in the last run had this
        # param in common.
        url = (f"https://stats.espncricinfo.com/ci/engine/player/{espn_id}.html"
               f"?class={class_id};type={type_}")
        page.goto(url, timeout=20000, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        body_text = page.inner_text("body")

        print(f"  [debug] tried class={class_id} type={type_} final_url={page.url}")

        if looks_blocked(body_text):
            print(f"  [blocked] anti-bot page detected for class={class_id} "
                  f"-- not trying further classes for this player")
            return {
                "date_of_birth": "", "batting_style": "", "bowling_style": "",
                "role": "", "final_url": page.url, "matched_class": "",
                "blocked": True,
            }

        batting_style, bowling_style, dob = parse_header(body_text)
        if batting_style or bowling_style or dob:
            return {
                "date_of_birth": dob,
                "batting_style": batting_style,
                "bowling_style": bowling_style,
                # Playing Role lives on /content/player/, which is still
                # Akamai-blocked on this subdomain -- confirmed this session.
                # Leaving blank rather than guessing.
                "role": "",
                "final_url": page.url,
                "matched_class": class_id,
                "blocked": False,
            }
        print(f"  [debug] no header found for class={class_id}, trying next...")

    # No class attempted produced a header line at all, and it wasn't a
    # block either. This usually means the person has no international/
    # domestic-T20 playing record under any class tried (e.g. the ID
    # actually belongs to an umpire or official rather than a player --
    # worth checking player_ids.csv for that), or the page structure
    # differs from what's been confirmed here.
    print(f"  [debug] body_snippet={body_text[:300]!r}")
    return {
        "date_of_birth": "",
        "batting_style": "",
        "bowling_style": "",
        "role": "",
        "final_url": page.url,
        "matched_class": "",
        "blocked": False,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scraper.py <player_ids.csv> <output_csv> [--limit N]")
        sys.exit(1)

    ids_csv, out_csv = sys.argv[1], sys.argv[2]
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    with open(ids_csv, newline="") as f:
        players = list(csv.DictReader(f))
    players = [p for p in players if p.get("espn_id")]
    if limit:
        players = players[:limit]

    fieldnames = ["source_player_name", "source_site", "source_player_id",
                  "date_of_birth", "nationality", "role", "batting_style",
                  "bowling_style", "matched_class", "source_url", "scraped_at"]
    os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
    done = already_done(out_csv)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        consecutive_blocks = 0
        BLOCK_STOP_THRESHOLD = 3  # stop the whole run after this many in a row

        for i, p in enumerate(players, 1):
            name = p["full_name"]
            if name in done:
                print(f"[{i}/{len(players)}] {name} -- already done, skipping")
                continue

            print(f"[{i}/{len(players)}] {name} (id={p['espn_id']})...")
            row = {"source_player_name": name, "source_site": "espncricinfo",
                   "source_player_id": p["espn_id"], "date_of_birth": "",
                   "nationality": "", "role": "", "batting_style": "",
                   "bowling_style": "", "matched_class": "", "source_url": "",
                   "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S")}
            try:
                fields = scrape_profile(page, p["espn_id"])
                row["date_of_birth"] = fields["date_of_birth"]
                row["role"] = fields["role"]
                row["batting_style"] = fields["batting_style"]
                row["bowling_style"] = fields["bowling_style"]
                row["matched_class"] = fields["matched_class"]
                row["source_url"] = fields["final_url"]

                if fields["blocked"]:
                    consecutive_blocks += 1
                    print(f"  [blocked] ({consecutive_blocks}/{BLOCK_STOP_THRESHOLD} "
                          f"consecutive) -- writing this row as blank and moving on")
                else:
                    consecutive_blocks = 0
                    print(f"  -> dob={fields['date_of_birth']}, role={fields['role']}, "
                          f"bat={fields['batting_style']}, bowl={fields['bowling_style']}, "
                          f"matched_class={fields['matched_class']}")
                    if not fields["matched_class"]:
                        print(f"  [warn] no header found under any class for {name} "
                              f"(id={p['espn_id']}) -- check if this ID is actually a "
                              f"player, not an umpire/official, in player_ids.csv")
            except Exception as e:
                print(f"  [error] {name}: {e} -- skipping, moving to next player")

            append_row(out_csv, row, fieldnames)

            if consecutive_blocks >= BLOCK_STOP_THRESHOLD:
                print(f"\n[stopping] {BLOCK_STOP_THRESHOLD} consecutive blocked "
                      f"responses -- looks like we've been rate-limited or banned. "
                      f"Stopping now rather than pushing further. Everything scraped "
                      f"so far is already saved in {out_csv}. Wait a while (hours, "
                      f"not minutes) before rerunning -- it will pick up where it "
                      f"left off and skip everyone already in the output file.")
                break

            polite_sleep()

        browser.close()

    print("\nDone. If fields are mostly blank, send me one full row so I can")
    print("adjust the regex against the real rendered text.")


if __name__ == "__main__":
    main()