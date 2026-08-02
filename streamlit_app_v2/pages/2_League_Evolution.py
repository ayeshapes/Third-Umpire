import streamlit as st
import plotly.graph_objects as go
from db import run_query

st.set_page_config(page_title="League Evolution", page_icon="📈", layout="wide")
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
                               mode="lines+markers", name="1st Innings", line=dict(color="#F5D46A", width=3)))
    fig1.add_trace(go.Scatter(x=df["season_year"], y=df["avg_second_innings_score"],
                               mode="lines+markers", name="2nd Innings", line=dict(color="#4F8F63", width=3, dash="dot")))
    fig1.update_layout(title="Average Innings Score", template="plotly_dark", height=350,
                        margin=dict(l=10, r=10, t=40, b=10))
    st.plotly_chart(fig1, use_container_width=True)

with col2:
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=df["season_year"], y=df["overall_run_rate"],
                               mode="lines+markers", line=dict(color="#F5D46A", width=3), fill="tozeroy"))
    fig2.update_layout(title="Overall Run Rate (runs/over)", template="plotly_dark", height=350,
                        margin=dict(l=10, r=10, t=40, b=10))
    st.plotly_chart(fig2, use_container_width=True)

col3, col4 = st.columns(2)

with col3:
    fig3 = go.Figure()
    fig3.add_trace(go.Bar(x=df["season_year"], y=df["boundary_pct"], marker_color="#4F8F63"))
    fig3.update_layout(title="Boundary % of Balls Bowled", template="plotly_dark", height=350,
                        margin=dict(l=10, r=10, t=40, b=10))
    st.plotly_chart(fig3, use_container_width=True)

with col4:
    fig4 = go.Figure()
    fig4.add_trace(go.Scatter(x=df["season_year"], y=df["avg_wickets_per_innings"],
                               mode="lines+markers", line=dict(color="#C1443C", width=3)))
    fig4.update_layout(title="Average Wickets Per Innings", template="plotly_dark", height=350,
                        margin=dict(l=10, r=10, t=40, b=10))
    st.plotly_chart(fig4, use_container_width=True)

st.divider()
st.dataframe(df, use_container_width=True, hide_index=True)
