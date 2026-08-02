"""
PSL Weather Loader
Fetches historical weather for each match's venue + date using Open-Meteo's
free historical weather API (no API key needed, no rate-limit auth, built
for exactly this kind of use -- unlike a scraper, this is a legitimate
public API and won't get blocked).

Usage:
    python3 weather_loader.py "postgresql://...supabase connection string..."
"""

import sys
import time
import requests
import psycopg2

API_URL = "https://archive-api.open-meteo.com/v1/archive"


WMO_CONDITION_MAP = {
    0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy",
    45: "fog", 48: "fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 80: "rain showers",
    81: "rain showers", 82: "violent rain showers", 95: "thunderstorm",
}


def fetch_weather(lat, lon, date):
    """Returns temp/humidity/wind/condition for the given day at the given
    coordinates, or None if the API call fails."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date,
        "end_date": date,
        "daily": "temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,"
                  "wind_speed_10m_max,weathercode",
        "timezone": "auto",
    }
    try:
        resp = requests.get(API_URL, params=params, timeout=15)
        resp.raise_for_status()
        d = resp.json().get("daily", {})
        code = d.get("weathercode", [None])[0]
        return {
            "temp_max": d.get("temperature_2m_max", [None])[0],
            "temp_min": d.get("temperature_2m_min", [None])[0],
            "humidity": d.get("relative_humidity_2m_mean", [None])[0],
            "wind_kph": d.get("wind_speed_10m_max", [None])[0],
            "condition": WMO_CONDITION_MAP.get(code, f"code_{code}" if code is not None else ""),
        }
    except requests.RequestException as e:
        print(f"  [error] {e}")
        return None


def estimate_dew(humidity, wind_kph):
    """Dew isn't a measured API field -- there's no such thing as a direct
    'dew' reading. This is a HEURISTIC, not a fact: high humidity + low wind
    are the classic recipe for dew. Label it as derived/estimated wherever
    it's shown, don't treat it as measured.

    Note: originally also gated this on is_day_night, but that column is
    NULL for every match -- Cricsheet's format here doesn't give match
    start times, so the ETL never had a way to populate it. Dropped that
    condition rather than silently zeroing every result."""
    if humidity is None:
        return None
    return bool(humidity >= 70 and (wind_kph or 0) < 15)


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 weather_loader.py <connection_string>")
        sys.exit(1)

    conn = psycopg2.connect(sys.argv[1])
    cur = conn.cursor()
    cur.execute("SET search_path TO raw_cricsheet, public;")

    cur.execute("""
        SELECT m.match_id, m.match_date, v.latitude, v.longitude
        FROM matches m
        JOIN venues v ON v.venue_id = m.venue_id
        WHERE v.latitude IS NOT NULL
        ORDER BY m.match_date
    """)
    rows = cur.fetchall()
    print(f"{len(rows)} matches to process.")

    for i, (match_id, match_date, lat, lon) in enumerate(rows, 1):
        print(f"[{i}/{len(rows)}] match {match_id} on {match_date}...")
        weather = fetch_weather(lat, lon, match_date.isoformat())
        if weather is None:
            continue

        temp_avg = None
        if weather["temp_max"] is not None and weather["temp_min"] is not None:
            temp_avg = round((weather["temp_max"] + weather["temp_min"]) / 2, 1)

        dew = estimate_dew(weather["humidity"], weather["wind_kph"])

        cur.execute(
            """INSERT INTO match_weather (match_id, temperature_c, humidity_pct, wind_kph, condition, dew_present)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (match_id) DO UPDATE SET
                   temperature_c = EXCLUDED.temperature_c,
                   humidity_pct = EXCLUDED.humidity_pct,
                   wind_kph = EXCLUDED.wind_kph,
                   condition = EXCLUDED.condition,
                   dew_present = EXCLUDED.dew_present""",
            (match_id, temp_avg, weather["humidity"], weather["wind_kph"],
             weather["condition"], dew),
        )
        conn.commit()
        time.sleep(1)

    print("Done.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()