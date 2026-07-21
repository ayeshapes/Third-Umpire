"""
Captain Scraper (Wikipedia-based)

Why Wikipedia instead of ESPNcricinfo: ESPNcricinfo doesn't have a clean
structured field for "team captain per season" anywhere accessible (that's
why we were piecing this together from news articles). Wikipedia DOES --
every PSL team-season has a dedicated page
(https://en.wikipedia.org/wiki/{year}_{team}_season) with a clean
"Captain:" field in its infobox. And critically, Wikipedia has no bot
protection, so this is a simple, reliable `requests`-based scraper --
no Playwright, no Akamai fighting.

Usage:
    python3 scrape_captains.py captains_template.csv captains_scraped.csv

Handles multi-captain seasons (e.g. "Imad Wasim (9 matches) Babar Azam
(1 match)") by picking whoever captained the most matches -- same rule
we used manually. If a team-season has no dedicated Wikipedia page (404),
or the Captain field can't be found, that row is left blank rather than
guessed.
"""

import csv
import re
import sys
import time
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Multi-captain pattern: "Name One (N matches) Name Two (M matches)"
MULTI_CAPTAIN_PATTERN = re.compile(r"([A-Za-z][A-Za-z.\-' ]+?)\s*\((\d+)\s*match(?:es)?\)")


def clean_team_slug(team_name):
    return team_name.replace(" ", "_")


def fetch_captain(team_name, year):
    url = f"https://en.wikipedia.org/wiki/{year}_{clean_team_slug(team_name)}_season"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        print(f"  [debug] url={url} status={resp.status_code}")
        if resp.status_code == 404:
            return None, url, "page not found"
        resp.raise_for_status()
    except requests.RequestException as e:
        return None, url, f"request error: {e}"

    text = re.sub(r"<[^>]+>", " ", resp.text)
    text = re.sub(r"\s+", " ", text)
    print(f"  [debug] has 'Captain:' in text: {'Captain:' in text}")
    idx = text.find("Captain:")
    if idx != -1:
        print(f"  [debug] context: {text[idx:idx+150]!r}")

    m = re.search(r"Captain:\s*([A-Za-z][A-Za-z.\-' ()0-9]+?)(?:\s*-\s*[A-Z][a-z]|\s*PSL|\s*Coach|\s*Ground)", text)
    if not m:
        return None, url, "no Captain field found on page"

    captain_blob = m.group(1).strip().rstrip(" -").strip()

    # multi-captain season: pick whoever led the most matches
    multi = MULTI_CAPTAIN_PATTERN.findall(captain_blob)
    if multi:
        best = max(multi, key=lambda x: int(x[1]))
        return best[0].strip(), url, f"multi-captain season, picked most matches ({best[1]})"

    return captain_blob, url, "ok"


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 scrape_captains.py <captains_template.csv> <output.csv>")
        sys.exit(1)

    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    for i, r in enumerate(rows, 1):
        if r.get("captain_full_name", "").strip():
            print(f"[{i}/{len(rows)}] {r['team_name']} {r['season_year']} -- already filled, skipping")
            continue

        print(f"[{i}/{len(rows)}] {r['team_name']} {r['season_year']}...")
        captain, url, status = fetch_captain(r["team_name"], r["season_year"])
        if captain:
            r["captain_full_name"] = captain
            print(f"  -> {captain} ({status})")
        else:
            print(f"  -> not found ({status}) -- {url}")
        time.sleep(1)  # polite delay, though Wikipedia doesn't require it

    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["team_name", "season_year", "captain_full_name"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    filled = sum(1 for r in rows if r["captain_full_name"].strip())
    print(f"\nDone. {filled}/{len(rows)} rows have a captain now.")


if __name__ == "__main__":
    main()