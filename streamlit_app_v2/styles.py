"""
Shared CSS + HTML component helpers for the Streamlit app.

BUG FIX (this version): the previous kpi_card()/kpi_row() built HTML using
indented multi-line f-strings. Streamlit/Markdown treats any line indented
4+ spaces as a preformatted code block -- so the FIRST card would render
correctly, then everything after would show up as literal raw tags. This
is a confirmed, longstanding Streamlit quirk (see streamlit/streamlit#859).
Fix: build every HTML string as ONE continuous line with zero leading
whitespace on any line, so nothing accidentally triggers code-block
parsing.

PALETTE CHANGE: moved off the navy/floodlight look entirely, to a warm,
sunlit "day match on a real pitch" palette -- cream/parchment background,
cricket-ball red and deep turf green as the two anchor accents, warm
amber instead of the old cold yellow. Still cricket-grounded, just a
different time of day.
"""
import streamlit as st

COLORS = {
    "bg": "#FBF7EF",
    "surface": "#FFFFFF",
    "surface_alt": "#F3ECDA",
    "hairline": "#E4D8BE",
    "text": "#2B2118",
    "text_dim": "#8A7B62",
    "ball_red": "#B5382F",
    "turf": "#2F6B4F",
    "amber": "#C98A2C",
}


def inject_css():
    css = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
        '<style>'
        f'.stApp {{ background: {COLORS["bg"]}; }}'
        f'html, body, [class*="css"] {{ font-family: "Inter", sans-serif; color: {COLORS["text"]}; }}'
        f'h1, h2, h3 {{ font-family: "Space Grotesk", sans-serif !important; letter-spacing: -0.02em; color: {COLORS["text"]} !important; }}'
        '.kpi-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }'
        f'.kpi-card {{ background: {COLORS["surface"]}; border: 1px solid {COLORS["hairline"]}; border-top: 3px solid {COLORS["ball_red"]}; border-radius: 10px; padding: 16px 18px; flex: 1; min-width: 150px; box-shadow: 0 1px 3px rgba(43,33,24,0.06); transition: transform 0.15s ease, box-shadow 0.15s ease; }}'
        '.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(43,33,24,0.1); }'
        '.kpi-card.turf { border-top-color: ' + COLORS["turf"] + '; }'
        '.kpi-card.amber { border-top-color: ' + COLORS["amber"] + '; }'
        '.kpi-icon { font-size: 20px; margin-bottom: 6px; }'
        f'.kpi-value {{ font-family: "IBM Plex Mono", monospace; font-size: 25px; font-weight: 600; color: {COLORS["text"]}; line-height: 1.1; }}'
        f'.kpi-label {{ font-size: 11px; color: {COLORS["text_dim"]}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }}'
        f'.kpi-sub {{ font-size: 11px; color: {COLORS["text_dim"]}; margin-top: 6px; font-style: italic; }}'
        '</style>'
    )
    st.markdown(css, unsafe_allow_html=True)


def kpi_card(icon, value, label, sub=None, accent=None):
    """accent: None (red, default), 'turf', or 'amber'."""
    css_class = "kpi-card" + (f" {accent}" if accent else "")
    sub_html = f'<div class="kpi-sub">{sub}</div>' if sub else ""
    # IMPORTANT: single line, no embedded newlines/indentation -- see bug
    # note at the top of this file for why that matters.
    return (
        f'<div class="{css_class}">'
        f'<div class="kpi-icon">{icon}</div>'
        f'<div class="kpi-value">{value}</div>'
        f'<div class="kpi-label">{label}</div>'
        f'{sub_html}'
        f'</div>'
    )


def kpi_row(cards):
    """cards: list of dicts with keys icon, value, label, sub (optional), accent (optional)."""
    html = '<div class="kpi-row">' + "".join(
        kpi_card(c["icon"], c["value"], c["label"], c.get("sub"), c.get("accent"))
        for c in cards
    ) + '</div>'
    st.markdown(html, unsafe_allow_html=True)


# Shared Plotly styling so every chart across every page matches the new
# palette without each page having to redefine it.
PLOTLY_TEMPLATE_LAYOUT = dict(
    template="plotly_white",
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["surface"],
    font=dict(family="Inter, sans-serif", color=COLORS["text"]),
    margin=dict(l=10, r=10, t=30, b=10),
)

CHART_COLOR_SEQUENCE = [
    COLORS["ball_red"], COLORS["turf"], COLORS["amber"],
    "#6B4A8A", "#2B7A8C", "#A85C3E", "#4C5670", "#8A7B62",
]
