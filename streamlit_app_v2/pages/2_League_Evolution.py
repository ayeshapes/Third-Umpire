import streamlit as st
import plotly.graph_objects as go
from db import run_query
from styles import inject_css, COLORS, PLOTLY_TEMPLATE_LAYOUT, CHART_COLOR_SEQUENCE, DUO_COLOR_SEQUENCE, HEATMAP_SCALE_WARM, HEATMAP_SCALE_ALERT

st.set_page_config(page_title="League Evolution", page_icon="📈", layout="wide")
inject_css()
st.title("📈 League Evolution")
st.caption("Has scoring in the PSL gone up across 11 seasons?")

df = run_query("SELECT * FROM v_league_evolution ORDER BY season_year")

if df.empty:
    st.warning("No data found — has `v_league_evolution` been created? Run `three_features_views.sql`.")
    st.stop()

col1, col2 = st.columns(2)

with col1:
    fig1 = go.Figure()
    fig1.add_trace(go.Scatter(x=df["season_year"], y=df["avg_first_innings_score"],
                               mode="lines+markers", name="1st Innings", line=dict(color=COLORS["ball_red"], width=3)))
    fig1.add_trace(go.Scatter(x=df["season_year"], y=df["avg_second_innings_score"],
                               mode="lines+markers", name="2nd Innings", line=dict(color=COLORS["turf"], width=3, dash="dot")))
    fig1.update_layout(title="Average Innings Score", **PLOTLY_TEMPLATE_LAYOUT, height=350)
    st.plotly_chart(fig1, use_container_width=True)

with col2:
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=df["season_year"], y=df["overall_run_rate"],
                               mode="lines+markers", line=dict(color=COLORS["ball_red"], width=3), fill="tozeroy"))
    fig2.update_layout(title="Overall Run Rate (runs/over)", **PLOTLY_TEMPLATE_LAYOUT, height=350)
    st.plotly_chart(fig2, use_container_width=True)

col3, col4 = st.columns(2)

with col3:
    fig3 = go.Figure()
    fig3.add_trace(go.Bar(x=df["season_year"], y=df["boundary_pct"], marker_color=COLORS["turf"]))
    fig3.update_layout(title="Boundary % of Balls Bowled", **PLOTLY_TEMPLATE_LAYOUT, height=350)
    st.plotly_chart(fig3, use_container_width=True)

with col4:
    fig4 = go.Figure()
    fig4.add_trace(go.Scatter(x=df["season_year"], y=df["avg_wickets_per_innings"],
                               mode="lines+markers", line=dict(color=COLORS["clay"], width=3)))
    fig4.update_layout(title="Average Wickets Per Innings", **PLOTLY_TEMPLATE_LAYOUT, height=350)
    st.plotly_chart(fig4, use_container_width=True)

st.divider()
st.dataframe(df, use_container_width=True, hide_index=True)
