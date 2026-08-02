"""
Shared CSS + HTML component helpers for the Streamlit app, matching the
color/font language of the existing vanilla-JS dashboard (floodlight
yellow, turf green, IBM Plex Mono for numbers, Space Grotesk for
headings) so both dashboards feel like the same product.
"""
import streamlit as st

COLORS = {
    "bg": "#0B1120",
    "surface": "#131B2E",
    "surface_hover": "#1B2540",
    "hairline": "#26314D",
    "text": "#E7EAF3",
    "text_dim": "#8A93AC",
    "floodlight": "#F5D46A",
    "turf": "#4F8F63",
    "ball_red": "#C1443C",
}


def inject_css():
    st.markdown(f"""
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        html, body, [class*="css"] {{
            font-family: 'Inter', sans-serif;
        }}
        h1, h2, h3 {{
            font-family: 'Space Grotesk', sans-serif !important;
            letter-spacing: -0.02em;
        }}
        .kpi-row {{
            display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 20px;
        }}
        .kpi-card {{
            background: {COLORS['surface']};
            border: 1px solid {COLORS['hairline']};
            border-radius: 12px;
            padding: 18px 20px;
            flex: 1;
            min-width: 160px;
            transition: transform 0.15s ease, border-color 0.15s ease;
        }}
        .kpi-card:hover {{
            transform: translateY(-2px);
            border-color: {COLORS['floodlight']};
        }}
        .kpi-icon {{ font-size: 22px; margin-bottom: 6px; }}
        .kpi-value {{
            font-family: 'IBM Plex Mono', monospace;
            font-size: 26px; font-weight: 600;
            color: {COLORS['floodlight']};
            line-height: 1.1;
        }}
        .kpi-label {{
            font-size: 12px; color: {COLORS['text_dim']};
            margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em;
        }}
        .kpi-sub {{
            font-size: 11px; color: {COLORS['text_dim']};
            margin-top: 6px; font-style: italic;
        }}
    </style>
    """, unsafe_allow_html=True)


def kpi_card(icon, value, label, sub=None):
    sub_html = f'<div class="kpi-sub">{sub}</div>' if sub else ""
    return f"""
    <div class="kpi-card">
        <div class="kpi-icon">{icon}</div>
        <div class="kpi-value">{value}</div>
        <div class="kpi-label">{label}</div>
        {sub_html}
    </div>
    """


def kpi_row(cards):
    """cards: list of dicts with keys icon, value, label, sub (optional)"""
    html = '<div class="kpi-row">' + "".join(
        kpi_card(c["icon"], c["value"], c["label"], c.get("sub")) for c in cards
    ) + "</div>"
    st.markdown(html, unsafe_allow_html=True)
