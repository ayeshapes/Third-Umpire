import streamlit as st
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE, DUO_COLOR_SEQUENCE, HEATMAP_SCALE_WARM, HEATMAP_SCALE_ALERT

st.set_page_config(page_title="Toss Impact", page_icon="🪙", layout="wide")
inject_css()
st.title("🪙 Toss Impact")
st.caption("Does winning the toss actually correlate with winning the match?")

teams_df = run_query("SELECT team_id, team_name FROM teams ORDER BY team_name")
team_options = ["All teams"] + teams_df["team_name"].tolist()
selected_team = st.selectbox("Filter by team (whose toss wins to look at)", team_options)

team_filter_sql = ""
params = {}
if selected_team != "All teams":
    team_id = teams_df[teams_df["team_name"] == selected_team]["team_id"].iloc[0]
    team_filter_sql = "AND m.toss_winner_team_id = :team_id"
    params["team_id"] = int(team_id)

overall = run_query(f"""
    SELECT
        COUNT(*) AS total_matches,
        COUNT(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won
    FROM matches m
    WHERE m.winner_team_id IS NOT NULL {team_filter_sql}
""", params).iloc[0]

by_decision = run_query(f"""
    SELECT
        m.toss_decision,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won
    FROM matches m
    WHERE m.toss_decision IS NOT NULL AND m.winner_team_id IS NOT NULL {team_filter_sql}
    GROUP BY m.toss_decision
""", params)

win_pct = round(overall["toss_winner_won"] / overall["total_matches"] * 100, 1) if overall["total_matches"] else 0

st.metric(
    "Toss winner went on to win",
    f"{win_pct}%",
    help=f"{overall['toss_winner_won']} of {overall['total_matches']} matches"
)

if not by_decision.empty:
    fig = go.Figure()
    for _, row in by_decision.iterrows():
        pct = round(row["toss_winner_won"] / row["total"] * 100, 1) if row["total"] else 0
        fig.add_trace(go.Bar(
            x=[row["toss_decision"]], y=[pct],
            name=row["toss_decision"], marker_color=COLORS["turf"] if row["toss_decision"] == "bat" else COLORS["ball_red"],
            text=[f"{pct}%<br>({row['toss_winner_won']}/{row['total']})"], textposition="outside",
        ))
    fig.update_layout(title="Win % by Toss Decision", **PLOTLY_TEMPLATE_LAYOUT, height=400,
                       showlegend=False, yaxis_range=[0, 100])
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("No matches found for this filter.")
