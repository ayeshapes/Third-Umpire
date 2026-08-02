import streamlit as st
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE, DUO_COLOR_SEQUENCE, HEATMAP_SCALE_WARM, HEATMAP_SCALE_ALERT

st.set_page_config(page_title="Match Explorer", page_icon="🎯", layout="wide")
inject_css()
st.title("🎯 Match Explorer")
st.caption("Ball-by-ball run progression for any match — the standout feature this project's data depth actually supports.")

@st.cache_data(ttl=600)
def get_matches():
    return run_query("""
        SELECT m.match_id, m.match_date, t1.team_name AS team1, t2.team_name AS team2,
               m.external_ref_cricsheet
        FROM matches m
        JOIN teams t1 ON t1.team_id = m.team1_id
        JOIN teams t2 ON t2.team_id = m.team2_id
        ORDER BY m.match_date DESC
    """)

matches_df = get_matches()
matches_df["label"] = matches_df["match_date"].astype(str) + " — " + matches_df["team1"] + " vs " + matches_df["team2"]

selected_label = st.selectbox("Pick a match", matches_df["label"])
match_row = matches_df[matches_df["label"] == selected_label].iloc[0]
match_id = int(match_row["match_id"])

worm = run_query("""
    SELECT i.innings_number, t.team_name AS batting_team, o.over_number, o.wickets,
           SUM(o.runs_conceded) OVER (PARTITION BY i.innings_id ORDER BY o.over_number) AS cumulative_runs
    FROM overs o
    JOIN innings i ON i.innings_id = o.innings_id
    JOIN teams t ON t.team_id = i.batting_team_id
    WHERE i.match_id = :match_id
    ORDER BY i.innings_number, o.over_number
""", {"match_id": match_id})

if worm.empty:
    st.warning("No ball-by-ball data for this match.")
else:
    fig = go.Figure()
    colors = DUO_COLOR_SEQUENCE
    for idx, (inn_num, group) in enumerate(worm.groupby("innings_number")):
        team_name = group["batting_team"].iloc[0]
        fig.add_trace(go.Scatter(
            x=group["over_number"] + 1, y=group["cumulative_runs"],
            mode="lines", name=f"{team_name} (inn {inn_num})",
            line=dict(color=colors[idx % 2], width=3),
        ))
        # mark wickets as red X markers on the line
        wicket_overs = group[group["wickets"] > 0]
        if not wicket_overs.empty:
            fig.add_trace(go.Scatter(
                x=wicket_overs["over_number"] + 1, y=wicket_overs["cumulative_runs"],
                mode="markers", name=f"Wickets ({team_name})",
                marker=dict(symbol="x", size=10, color=COLORS["clay"]),
                showlegend=False,
            ))

    fig.update_layout(
        title="Run Progression (Worm Chart)", **PLOTLY_TEMPLATE_LAYOUT, height=450,
        xaxis_title="Over", yaxis_title="Cumulative Runs",
    )
    st.plotly_chart(fig, use_container_width=True)

    st.caption("✕ marks mark overs where a wicket fell.")

st.divider()

# Batting scorecard for the selected match
scorecard = run_query("""
    SELECT i.innings_number, t.team_name, p.full_name, bs.runs, bs.balls_faced, bs.strike_rate, bs.dismissal_type
    FROM match_batting_scorecard bs
    JOIN innings i ON i.innings_id = bs.innings_id
    JOIN teams t ON t.team_id = i.batting_team_id
    JOIN players p ON p.player_id = bs.player_id
    WHERE i.match_id = :match_id
    ORDER BY i.innings_number, bs.scorecard_id
""", {"match_id": match_id})

if not scorecard.empty:
    for inn_num, group in scorecard.groupby("innings_number"):
        st.subheader(f"Innings {inn_num} — {group['team_name'].iloc[0]}")
        st.dataframe(
            group[["full_name", "runs", "balls_faced", "strike_rate", "dismissal_type"]],
            use_container_width=True, hide_index=True,
        )
