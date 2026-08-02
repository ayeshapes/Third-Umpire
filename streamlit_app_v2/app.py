import streamlit as st
from db import run_query

st.set_page_config(page_title="ThirdUmpire", page_icon="🏏", layout="wide")

st.title("🏏 ThirdUmpire — PSL Analytics")
st.caption("11 seasons of Pakistan Super League data, ball by ball.")

col1, col2, col3, col4 = st.columns(4)

with st.spinner("Loading overview..."):
    matches = run_query("SELECT count(*) AS c FROM matches").iloc[0]["c"]
    players = run_query("SELECT count(*) AS c FROM players").iloc[0]["c"]
    deliveries = run_query("SELECT count(*) AS c FROM deliveries").iloc[0]["c"]
    seasons = run_query("SELECT count(*) AS c FROM seasons").iloc[0]["c"]

col1.metric("Matches", f"{matches:,}")
col2.metric("Players", f"{players:,}")
col3.metric("Deliveries", f"{deliveries:,}")
col4.metric("Seasons", seasons)

st.divider()

st.markdown("""
### Explore
Use the sidebar to navigate:
- **Player Comparison** — head-to-head career numbers, side by side
- **League Evolution** — has scoring gone up across 11 seasons?
- **Toss Impact** — does winning the toss actually correlate with winning?
- **Venue Explorer** — batting/bowling tendencies per ground, computed from real match data

Every chart here is built from actually-verified data — the pipeline behind this
went through real bug-fixing (schema issues, ETL bugs, scraper corrections) before
any of these numbers were trusted.
""")
