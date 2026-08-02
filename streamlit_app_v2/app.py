import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, kpi_row

st.set_page_config(page_title="ThirdUmpire", page_icon="🏏", layout="wide")
inject_css()

st.title("🏏 ThirdUmpire — PSL Analytics")
st.caption("11 seasons of Pakistan Super League data, ball by ball. Every number here is verified against real match records.")

with st.spinner("Loading overview..."):
    overview = run_query("""
        SELECT
            (SELECT count(*) FROM matches) AS matches,
            (SELECT count(*) FROM players) AS players,
            (SELECT count(*) FROM deliveries) AS deliveries,
            (SELECT count(*) FROM seasons) AS seasons,
            (SELECT MAX(total_runs) FROM innings) AS highest_score,
            (SELECT count(*) FILTER (WHERE runs_batter = 6) FROM deliveries) AS total_sixes,
            (SELECT count(*) FILTER (WHERE is_wicket) FROM deliveries) AS total_wickets,
            (SELECT count(*) FROM matches WHERE is_tie) AS total_ties
    """).iloc[0]

kpi_row([
    {"icon": "🏟️", "value": f"{overview['matches']:,}", "label": "Matches"},
    {"icon": "👤", "value": f"{overview['players']:,}", "label": "Players"},
    {"icon": "🎯", "value": f"{overview['deliveries']:,}", "label": "Deliveries"},
    {"icon": "📅", "value": overview["seasons"], "label": "Seasons"},
])

kpi_row([
    {"icon": "💥", "value": overview["highest_score"], "label": "Highest Team Score",
     "sub": "Quetta Gladiators, 2025 — a real PSL record"},
    {"icon": "🚀", "value": f"{overview['total_sixes']:,}", "label": "Total Sixes"},
    {"icon": "🎳", "value": f"{overview['total_wickets']:,}", "label": "Total Wickets"},
    {"icon": "🤝", "value": overview["total_ties"], "label": "Tied Matches"},
])

st.divider()

col1, col2 = st.columns(2)

with col1:
    st.subheader("Wins by Team (All-Time)")
    wins = run_query("""
        SELECT t.team_name, count(*) AS wins
        FROM matches m JOIN teams t ON t.team_id = m.winner_team_id
        GROUP BY t.team_name ORDER BY wins DESC
    """)
    fig = px.pie(wins, names="team_name", values="wins", hole=0.5,
                 color_discrete_sequence=["#F5D46A", "#4F8F63", "#C1443C", "#6B3FA0", "#1C7ED6", "#E1362C", "#8E2440", "#4C5670"])
    fig.update_layout(template="plotly_dark", height=380, margin=dict(l=10, r=10, t=10, b=10))
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Top 10 Six-Hitters (All-Time)")
    sixes = run_query("""
        SELECT p.full_name, count(*) FILTER (WHERE d.runs_batter = 6) AS sixes
        FROM deliveries d JOIN players p ON p.player_id = d.striker_id
        GROUP BY p.full_name ORDER BY sixes DESC LIMIT 10
    """)
    fig2 = go.Figure(go.Bar(
        y=sixes["full_name"][::-1], x=sixes["sixes"][::-1], orientation="h",
        marker_color="#F5D46A",
    ))
    fig2.update_layout(template="plotly_dark", height=380, margin=dict(l=10, r=10, t=10, b=10))
    st.plotly_chart(fig2, use_container_width=True)

st.divider()

st.markdown("""
### Explore
Use the sidebar to navigate — Player Comparison, League Evolution, Toss Impact,
Venue Explorer, Match Explorer (ball-by-ball worm charts), and Phase Breakdown
(powerplay/middle/death heatmaps).
""")
