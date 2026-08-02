import streamlit as st
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE, DUO_COLOR_SEQUENCE, HEATMAP_SCALE_WARM, HEATMAP_SCALE_ALERT

st.set_page_config(page_title="Phase Breakdown", page_icon="🔥", layout="wide")
inject_css()
st.title("🔥 Phase Breakdown")
st.caption("Powerplay vs middle-overs vs death — how a player performs in each phase.")

@st.cache_data(ttl=600)
def get_player_list():
    return run_query("SELECT player_id, full_name, display_name FROM players ORDER BY full_name")

players_df = get_player_list()
name_to_id = {(row["display_name"] or row["full_name"]): row["player_id"] for _, row in players_df.iterrows()}
names = sorted(name_to_id.keys())
default_idx = names.index("Babar Azam") if "Babar Azam" in names else 0
selected_name = st.selectbox("Pick a player", names, index=default_idx)
player_id = int(name_to_id[selected_name])

PHASE_ORDER = ["powerplay", "middle", "death"]

batting = run_query("""
    SELECT o.phase,
           COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides') AS balls_faced,
           SUM(d.runs_batter) AS runs,
           COUNT(*) FILTER (WHERE d.is_wicket AND d.dismissed_player_id = d.striker_id) AS dismissals
    FROM deliveries d
    JOIN overs o ON o.over_id = d.over_id
    WHERE d.striker_id = :player_id
    GROUP BY o.phase
""", {"player_id": player_id})

bowling = run_query("""
    SELECT o.phase,
           COUNT(*) FILTER (WHERE d.extras_type IS DISTINCT FROM 'wides' AND d.extras_type IS DISTINCT FROM 'noballs') AS legal_balls,
           SUM(d.runs_batter + COALESCE(
               CASE WHEN d.extras_type = 'wides' THEN d.runs_extras
                    WHEN d.extras_type = 'noballs' THEN 1 ELSE 0 END, 0)) AS runs_conceded,
           COUNT(*) FILTER (WHERE d.is_wicket AND d.dismissal_type NOT IN ('run_out','retired_hurt','retired_out','obstructing_field','timed_out')) AS wickets
    FROM deliveries d
    JOIN overs o ON o.over_id = d.over_id
    WHERE d.bowler_id = :player_id
    GROUP BY o.phase
""", {"player_id": player_id})

col1, col2 = st.columns(2)

with col1:
    st.subheader("Batting")
    if batting.empty:
        st.info("No batting record for this player.")
    else:
        batting = batting.set_index("phase").reindex(PHASE_ORDER).fillna(0)
        batting["strike_rate"] = (batting["runs"] / batting["balls_faced"].replace(0, 1) * 100).round(1)
        batting["average"] = (batting["runs"] / batting["dismissals"].replace(0, 1)).round(1)

        z = [batting["strike_rate"].tolist(), batting["average"].tolist()]
        fig = go.Figure(data=go.Heatmap(
            z=z, x=PHASE_ORDER, y=["Strike Rate", "Average"],
            colorscale=HEATMAP_SCALE_WARM,
            text=z, texttemplate="%{text}", textfont=dict(size=14),
        ))
        fig.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=280)
        st.plotly_chart(fig, use_container_width=True)
        st.dataframe(batting[["balls_faced", "runs", "dismissals", "strike_rate", "average"]], use_container_width=True)

with col2:
    st.subheader("Bowling")
    if bowling.empty:
        st.info("No bowling record for this player.")
    else:
        bowling = bowling.set_index("phase").reindex(PHASE_ORDER).fillna(0)
        bowling["economy"] = (bowling["runs_conceded"] / (bowling["legal_balls"].replace(0, 1) / 6)).round(2)
        bowling["average"] = (bowling["runs_conceded"] / bowling["wickets"].replace(0, 1)).round(1)

        z = [bowling["economy"].tolist(), bowling["average"].tolist()]
        fig2 = go.Figure(data=go.Heatmap(
            z=z, x=PHASE_ORDER, y=["Economy", "Average"],
            colorscale=HEATMAP_SCALE_ALERT,
            text=z, texttemplate="%{text}", textfont=dict(size=14),
        ))
        fig2.update_layout(**PLOTLY_TEMPLATE_LAYOUT, height=280)
        st.plotly_chart(fig2, use_container_width=True)
        st.dataframe(bowling[["legal_balls", "runs_conceded", "wickets", "economy", "average"]], use_container_width=True)
