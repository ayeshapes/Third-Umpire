import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, kpi_row, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE

st.set_page_config(page_title="ThirdUmpire", page_icon="🏏", layout="wide")
inject_css()

st.title("🏏 ThirdUmpire — PSL Analytics")
st.caption("11 seasons of Pakistan Super League data, ball by ball. Every number here is verified against real match records.")

# ---------------------------------------------------------------
# Filters -- season range + team, applied to everything below
# ---------------------------------------------------------------
with st.sidebar:
    st.header("Filters")
    seasons_df = run_query("SELECT season_id, season_year FROM seasons ORDER BY season_year")
    season_options = seasons_df["season_year"].tolist()
    selected_seasons = st.multiselect(
        "Seasons", season_options, default=season_options,
        help="Leave all selected for the full 11-season history.",
    )
    selected_season_ids = seasons_df[seasons_df["season_year"].isin(selected_seasons)]["season_id"].tolist()

    teams_df = run_query("SELECT team_id, team_name FROM teams ORDER BY team_name")
    team_options = ["All teams"] + teams_df["team_name"].tolist()
    selected_team = st.selectbox("Team", team_options)
    selected_team_id = (
        None if selected_team == "All teams"
        else int(teams_df[teams_df["team_name"] == selected_team]["team_id"].iloc[0])
    )

if not selected_season_ids:
    st.warning("Select at least one season in the sidebar to see data.")
    st.stop()

season_filter_sql = "m.season_id = ANY(:season_ids)"
# SQLAlchemy's text() (what db.py uses) needs :name placeholders, not
# psycopg2-style %()s -- confirmed against real Postgres, %()s throws
# exactly the DatabaseError seen on Streamlit Cloud.
team_filter_sql = " AND (m.team1_id = :team_id OR m.team2_id = :team_id)" if selected_team_id else ""
params = {"season_ids": selected_season_ids, "team_id": selected_team_id}

# ---------------------------------------------------------------
# KPI row 1 -- headline counts
# ---------------------------------------------------------------
with st.spinner("Loading overview..."):
    overview = run_query(f"""
        WITH match_stats AS (
            SELECT
                count(DISTINCT m.match_id) AS matches,
                count(DISTINCT m.match_id) FILTER (WHERE m.is_tie) AS total_ties,
                count(DISTINCT m.match_id) FILTER (WHERE m.decided_by_super_over) AS super_overs
            FROM matches m
            WHERE {season_filter_sql}{team_filter_sql}
        ),
        player_stats AS (
            SELECT count(DISTINCT ms.player_id) AS players
            FROM matches m
            JOIN match_squads ms ON ms.match_id = m.match_id
            WHERE {season_filter_sql}{team_filter_sql}
        ),
        innings_stats AS (
            SELECT MAX(i.total_runs) AS highest_score
            FROM matches m
            JOIN innings i ON i.match_id = m.match_id
            WHERE {season_filter_sql}{team_filter_sql}
        ),
        delivery_stats AS (
            -- kept separate from player_stats/innings_stats on purpose --
            -- joining match_squads into the same query as deliveries would
            -- multiply every delivery-level count by squad size (fan-out),
            -- same class of bug caught earlier in v_league_evolution
            SELECT
                count(*) AS deliveries,
                count(*) FILTER (WHERE d.runs_batter = 6) AS total_sixes,
                count(*) FILTER (WHERE d.runs_batter = 4) AS total_fours,
                count(*) FILTER (WHERE d.is_wicket) AS total_wickets
            FROM matches m
            JOIN innings i ON i.match_id = m.match_id
            JOIN deliveries d ON d.innings_id = i.innings_id
            WHERE {season_filter_sql}{team_filter_sql}
        ),
        season_stats AS (
            SELECT count(DISTINCT m.season_id) AS seasons
            FROM matches m
            WHERE {season_filter_sql}{team_filter_sql}
        )
        SELECT * FROM match_stats, player_stats, innings_stats, delivery_stats, season_stats
    """, params).iloc[0]

kpi_row([
    {"icon": "🏟️", "value": f"{overview['matches']:,}", "label": "Matches"},
    {"icon": "👤", "value": f"{overview['players']:,}", "label": "Players", "accent": "turf"},
    {"icon": "🎯", "value": f"{overview['deliveries']:,}", "label": "Deliveries", "accent": "amber"},
    {"icon": "📅", "value": overview["seasons"], "label": "Seasons"},
])

kpi_row([
    {"icon": "💥", "value": overview["highest_score"], "label": "Highest Team Score", "accent": "turf"},
    {"icon": "🚀", "value": f"{overview['total_sixes']:,}", "label": "Total Sixes", "accent": "amber"},
    {"icon": "🏏", "value": f"{overview['total_fours']:,}", "label": "Total Fours"},
    {"icon": "🎳", "value": f"{overview['total_wickets']:,}", "label": "Total Wickets", "accent": "turf"},
])

kpi_row([
    {"icon": "🤝", "value": overview["total_ties"], "label": "Tied Matches", "accent": "amber"},
    {"icon": "⚡", "value": overview["super_overs"], "label": "Super Overs"},
    {
        "icon": "📊", "value": f"{overview['total_sixes'] + overview['total_fours']:,}",
        "label": "Total Boundaries", "accent": "turf",
    },
    {
        "icon": "🎯", "value": round(overview["deliveries"] / overview["matches"], 1) if overview["matches"] else "—",
        "label": "Avg Deliveries/Match", "accent": "amber",
    },
])

st.divider()

# ---------------------------------------------------------------
# Charts
# ---------------------------------------------------------------
row1_col1, row1_col2 = st.columns(2)

with row1_col1:
    st.subheader("Wins by Team")
    wins = run_query(f"""
        SELECT t.team_name, count(*) AS wins
        FROM matches m JOIN teams t ON t.team_id = m.winner_team_id
        WHERE {season_filter_sql}{team_filter_sql}
        GROUP BY t.team_name ORDER BY wins DESC
    """, params)
    if wins.empty:
        st.info("No completed matches for this filter.")
    else:
        fig = px.pie(wins, names="team_name", values="wins", hole=0.5,
                     color_discrete_sequence=CHART_COLOR_SEQUENCE)
        fig.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=360)
        st.plotly_chart(fig, use_container_width=True)

with row1_col2:
    st.subheader("Top 10 Six-Hitters")
    sixes = run_query(f"""
        SELECT p.full_name, count(*) FILTER (WHERE d.runs_batter = 6) AS sixes
        FROM deliveries d
        JOIN players p ON p.player_id = d.striker_id
        JOIN innings i ON i.innings_id = d.innings_id
        JOIN matches m ON m.match_id = i.match_id
        WHERE {season_filter_sql}{team_filter_sql}
        GROUP BY p.full_name ORDER BY sixes DESC LIMIT 10
    """, params)
    if sixes.empty:
        st.info("No delivery data for this filter.")
    else:
        fig2 = go.Figure(go.Bar(
            y=sixes["full_name"][::-1], x=sixes["sixes"][::-1], orientation="h",
            marker_color=COLORS["ball_red"],
        ))
        fig2.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=360)
        st.plotly_chart(fig2, use_container_width=True)

row2_col1, row2_col2 = st.columns(2)

with row2_col1:
    st.subheader("Average 1st-Innings Score by Season")
    trend = run_query(f"""
        SELECT s.season_year, ROUND(AVG(i.total_runs), 1) AS avg_score
        FROM seasons s
        JOIN matches m ON m.season_id = s.season_id
        JOIN innings i ON i.match_id = m.match_id AND i.innings_number = 1
        WHERE {season_filter_sql}{team_filter_sql}
        GROUP BY s.season_year ORDER BY s.season_year
    """, params)
    if trend.empty:
        st.info("No innings data for this filter.")
    else:
        fig3 = go.Figure(go.Scatter(
            x=trend["season_year"], y=trend["avg_score"], mode="lines+markers",
            line=dict(color=COLORS["turf"], width=2.5), marker=dict(size=7),
        ))
        fig3.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=340)
        st.plotly_chart(fig3, use_container_width=True)

with row2_col2:
    st.subheader("Toss Decision: Bat vs Field")
    toss = run_query(f"""
        SELECT m.toss_decision, count(*) AS total,
               count(*) FILTER (WHERE m.toss_winner_team_id = m.winner_team_id) AS toss_winner_won
        FROM matches m
        WHERE m.toss_decision IS NOT NULL AND m.winner_team_id IS NOT NULL
          AND {season_filter_sql}{team_filter_sql}
        GROUP BY m.toss_decision
    """, params)
    if toss.empty:
        st.info("No toss data for this filter.")
    else:
        toss["win_pct"] = (toss["toss_winner_won"] / toss["total"] * 100).round(1)
        fig4 = go.Figure(go.Bar(
            x=toss["toss_decision"], y=toss["win_pct"],
            marker_color=[COLORS["amber"], COLORS["ball_red"]],
            text=toss["win_pct"].astype(str) + "%", textposition="outside",
        ))
        fig4.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=340, yaxis_title="Toss winner's match-win %")
        st.plotly_chart(fig4, use_container_width=True)

st.divider()

st.markdown("""
### Explore
Use the sidebar to navigate — Player Comparison, League Evolution, Toss Impact,
Venue Explorer, Match Explorer (ball-by-ball worm charts), and Phase Breakdown
(powerplay/middle/death heatmaps). Season and team filters on this page carry
the same spirit across the rest of the app — check each page for its own
local filters too.
""")
