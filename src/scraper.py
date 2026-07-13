"""
ESPNcricinfo Player Profile Scraper (Playwright version)

Why Playwright: plain `requests` calls get blocked -- both by search engines
(DuckDuckGo returned HTTP 202 challenge pages) and likely by ESPNcricinfo
itself, which sits behind Akamai CDN protection with JS-based bot checks.
A real headless browser renders JS and behaves like an actual visitor,
which is how other cricket-data tools get past this.

Setup (run once):
    pip install playwright
    playwright install chromium

Usage:
    python3 scraper.py players_staging.csv raw_scraped/player_profiles.csv --limit 10

Notes:
- Writes output incrementally (one row at a time), so a crash partway
  through doesn't lose everything -- just re-run and it'll pick up where
  the CSV left off (skips names already present in the output file).
- Slow on purpose: ~4-6s per player between actions. Do not remove the
  delays or run multiple copies in parallel.
- I could not test this against the live site from my sandbox (no network
  access to espncricinfo.com or bing.com there) -- this is a best-effort
  v1 built from the site structure I could inspect via search snippets.
  Expect to debug the CSS selectors against real output.
"""

import csv
import os
import re
import sys
import time
import random
from playwright.sync_api import sync_playwright

DELAY_RANGE = (4.0, 6.0)


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


def find_espn_url(page, name):
    """Search Bing and pull the pcb.com.pk player profile link out of the
    results (visible text, not href -- Bing wraps hrefs in tracking-redirect
    URLs). PCB (Pakistan's own cricket board) covers domestic PSL players
    far better than ESPNcricinfo's international-focused Statsguru pages."""
    query = f"{name} pcb.com.pk player profile"
    try:
        page.goto(f"https://www.bing.com/search?q={query.replace(' ', '+')}",
                   timeout=20000, wait_until="domcontentloaded")
    except Exception:
        pass
    page.wait_for_timeout(2000)

    body_text = page.inner_text("body")
    m = re.search(r"pcb\.com\.pk/player/([a-z0-9-]+)\.html", body_text, re.IGNORECASE)
    if m:
        return f"https://www.pcb.com.pk/player/{m.group(1)}.html"
    return None


def scrape_profile(page, url):
    """Visit the PCB profile page and pull out batting/bowling style and DOB
    from the bio section. Confirmed real format from a search snippet:
    'Batting style: Left handed · Bowling style: Left Arm Medium Fast'
    and 'Born: 06 Apr 2000 Khyber Agency'."""
    page.goto(url, timeout=20000, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    body_text = page.inner_text("body")

    def grab(pattern):
        m = re.search(pattern, body_text, re.IGNORECASE)
        return m.group(1).strip() if m else ""

    batting_style = grab(r"Batting style:\s*([A-Za-z ]+?)(?:\s*[·\n]|Bowling)")
    bowling_style = grab(r"Bowling style:\s*([A-Za-z ]+?)(?:\s*[·\n]|Matches|$)")
    dob = grab(r"Born:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})")
    role = ""  # PCB's page doesn't have an explicit "role" field like ESPN's;
               # leaving blank rather than guessing.
    nationality = "Pakistan"  # safe default -- PCB profiles are Pakistani players by definition

    return {
        "date_of_birth": dob, "nationality": nationality,
        "role": role, "batting_style": batting_style, "bowling_style": bowling_style,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scraper.py <players_staging.csv> <output_csv> [--limit N]")
        sys.exit(1)

    players_csv, out_csv = sys.argv[1], sys.argv[2]
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    with open(players_csv, newline="") as f:
        players = list(csv.DictReader(f))
    if limit:
        players = players[:limit]

    fieldnames = ["source_player_name", "source_site", "source_player_id",
                  "date_of_birth", "nationality", "role", "batting_style",
                  "bowling_style", "source_url", "scraped_at"]
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

        for i, p in enumerate(players, 1):
            name = p["full_name"]
            if name in done:
                print(f"[{i}/{len(players)}] {name} -- already done, skipping")
                continue

            print(f"[{i}/{len(players)}] {name}...")
            row = {"source_player_name": name, "source_site": "espncricinfo",
                   "source_player_id": "", "date_of_birth": "", "nationality": "",
                   "role": "", "batting_style": "", "bowling_style": "",
                   "source_url": "", "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S")}
            try:
                url = find_espn_url(page, name)
                polite_sleep()
                if not url:
                    print("  -> no ESPNcricinfo page found")
                    append_row(out_csv, row, fieldnames)
                    continue

                m = re.search(r"-(\d+)\.html", url)
                row["source_player_id"] = m.group(1) if m else ""
                row["source_url"] = url

                fields = scrape_profile(page, url)
                polite_sleep()
                row.update(fields)
                print(f"  -> id={row['source_player_id']}, role={fields['role']}, dob={fields['date_of_birth']}")
            except Exception as e:
                print(f"  [error] {name}: {e}")

            append_row(out_csv, row, fieldnames)

        browser.close()

    print("\nDone. Check the CSV -- if role/style/dob are mostly blank, the")
    print("selectors need adjusting against the real page structure (send")
    print("me one filled-out row and one blank one and I'll fix it).")


if __name__ == "__main__":
    main()