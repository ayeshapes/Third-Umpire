import streamlit as st
import plotly.express as px
from db import run_query

st.set_page_config(page_title="Venue Explorer", page_icon="🏟️", layout="wide")
st.title("🏟️ Venue Explorer")
st.caption("Batting/bowling tendencies per ground, computed live from real match data — not manual ratings.")

df = run_query("SELECT * FROM v_venue_pitch_profile ORDER BY venue_name")

if df.empty:
    st.warning("No data found in `v_venue_pitch_profile`.")
    st.stop()

col1, col2 = st.columns(2)
with col1:
    fig1 = px.bar(df, x="venue_name", y="avg_first_innings_score", color="avg_first_innings_score",
                  color_continuous_scale=["#26314D", "#F5D46A"],
                  title="Average First-Innings Score by Venue")
    fig1.update_layout(template="plotly_dark", height=380, showlegend=False)
    st.plotly_chart(fig1, use_container_width=True)

with col2:
    fig2 = px.bar(df, x="venue_name", y="chase_success_pct", color="chase_success_pct",
                  color_continuous_scale=["#C1443C", "#4F8F63"],
                  title="Chase Success % by Venue")
    fig2.update_layout(template="plotly_dark", height=380, showlegend=False)
    st.plotly_chart(fig2, use_container_width=True)

st.subheader("Pace vs Spin Wicket Split")
fig3 = px.bar(df, x="venue_name", y="spin_wicket_pct",
              title="% of Wickets Taken by Spin Bowlers, per Venue",
              color_discrete_sequence=["#4F8F63"])
fig3.update_layout(template="plotly_dark", height=350)
st.plotly_chart(fig3, use_container_width=True)

st.divider()
st.dataframe(df, use_container_width=True, hide_index=True)
