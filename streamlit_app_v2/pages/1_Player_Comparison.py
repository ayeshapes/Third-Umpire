import streamlit as st
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE, DUO_COLOR_SEQUENCE, HEATMAP_SCALE_WARM, HEATMAP_SCALE_ALERT

st.set_page_config(page_title="Player Comparison", page_icon="⚔️", layout="wide")
inject_css()
st.title("⚔️ Player Comparison")
st.caption("Two players, head-to-head career numbers.")

@st.cache_data(ttl=600)
def get_player_list():
    return run_query("SELECT player_id, full_name, display_name FROM players ORDER BY full_name")

players_df = get_player_list()
name_to_id = {
    (row["display_name"] or row["full_name"]): row["player_id"]
    for _, row in players_df.iterrows()
}
names = sorted(name_to_id.keys())

col1, col2 = st.columns(2)
with col1:
    player_a_name = st.selectbox("Player A", names, index=names.index("Babar Azam") if "Babar Azam" in names else 0)
with col2:
    default_b = names.index("Shaheen Shah Afridi") if "Shaheen Shah Afridi" in names else min(1, len(names) - 1)
    player_b_name = st.selectbox("Player B", names, index=default_b)

BATTING_QUERY = """
    SELECT
        COUNT(*) AS innings,
        SUM(bs.runs) AS runs,
        MAX(bs.runs) AS highest_score,
        ROUND(SUM(bs.runs)::numeric / NULLIF(COUNT(*) FILTER (WHERE bs.dismissal_type IS NOT NULL), 0), 2) AS average,
        ROUND(SUM(bs.runs)::numeric / NULLIF(SUM(bs.balls_faced), 0) * 100, 2) AS strike_rate,
        SUM(bs.fours) AS fours,
        SUM(bs.sixes) AS sixes
    FROM match_batting_scorecard bs
    WHERE bs.player_id = :player_id
"""

BOWLING_QUERY = """
    SELECT
        COUNT(*) AS innings,
        SUM(bw.wickets) AS wickets,
        ROUND(SUM(bw.runs_conceded)::numeric / NULLIF(SUM(bw.wickets), 0), 2) AS average,
        ROUND(SUM(bw.runs_conceded)::numeric / NULLIF(SUM(bw.overs_bowled), 0), 2) AS economy
    FROM match_bowling_scorecard bw
    WHERE bw.player_id = :player_id
"""

def get_stats(player_id):
    bat = run_query(BATTING_QUERY, {"player_id": player_id}).iloc[0]
    bowl = run_query(BOWLING_QUERY, {"player_id": player_id}).iloc[0]
    return bat, bowl

if player_a_name and player_b_name:
    id_a, id_b = name_to_id[player_a_name], name_to_id[player_b_name]
    bat_a, bowl_a = get_stats(id_a)
    bat_b, bowl_b = get_stats(id_b)

    st.divider()
    st.subheader("Batting")

    bat_metrics = ["runs", "average", "strike_rate", "fours", "sixes", "highest_score"]
    bat_labels = ["Runs", "Average", "Strike Rate", "4s", "6s", "Highest Score"]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        y=bat_labels, x=[bat_a[m] or 0 for m in bat_metrics],
        name=player_a_name, orientation="h", marker_color=COLORS["ball_red"],
    ))
    fig.add_trace(go.Bar(
        y=bat_labels, x=[bat_b[m] or 0 for m in bat_metrics],
        name=player_b_name, orientation="h", marker_color=COLORS["turf"],
    ))
    fig.update_layout(barmode="group", height=380, **PLOTLY_TEMPLATE_LAYOUT)
    st.plotly_chart(fig, use_container_width=True)

    if bat_a["innings"] == 0 and bat_b["innings"] == 0:
        st.info("Neither player has a batting record in the database.")

    st.subheader("Bowling")
    if bowl_a["innings"] > 0 or bowl_b["innings"] > 0:
        bowl_col1, bowl_col2, bowl_col3, bowl_col4 = st.columns(4)
        bowl_col1.metric(f"{player_a_name} — Wickets", int(bowl_a["wickets"] or 0))
        bowl_col2.metric(f"{player_a_name} — Economy", bowl_a["economy"] or "—")
        bowl_col3.metric(f"{player_b_name} — Wickets", int(bowl_b["wickets"] or 0))
        bowl_col4.metric(f"{player_b_name} — Economy", bowl_b["economy"] or "—")
    else:
        st.info("Neither player has a bowling record in the database.")
