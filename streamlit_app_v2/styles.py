"""
Shared CSS + HTML component helpers for the Streamlit app.

BUG FIX (kept from earlier version): the previous kpi_card()/kpi_row() built
HTML using indented multi-line f-strings. Streamlit/Markdown treats any line
indented 4+ spaces as a preformatted code block -- so the FIRST card would
render correctly, then everything after would show up as literal raw tags.
This is a confirmed, longstanding Streamlit quirk (see streamlit/streamlit#859).
Fix: build every HTML string as ONE continuous line with zero leading
whitespace on any line, so nothing accidentally triggers code-block parsing.

PALETTE CHANGE v2 ("Golden Hour"): fixed to the 5-color brand palette --
metallic gold, jonquil, bone, anti-flash white, timberwolf. Old key names
(ball_red / turf / amber) are kept so app.py and every page's chart code
doesn't need touching -- they're just repointed to the new hexes:
    ball_red -> gold      (D1B01B, primary accent)
    turf     -> dark bronze (4A3F1E, secondary/dark accent, derived from gold)
    amber    -> jonquil   (FFD000, bright highlight accent)
One semantic-only addition, "clay", for alerts / ties / "field" toss
decisions -- the one spot a pure gold-on-gold chart reads as ambiguous.

IMPORTANT: this file used to only be imported by app.py. The 6 sub-pages
under pages/ had never been migrated off the original dark navy/floodlight
look (template="plotly_dark", hardcoded #F5D46A etc.) -- that mismatch is
fixed page-by-page alongside this change; see pages/*.py.
"""
import streamlit as st

COLORS = {
    "bg": "#ECECEC",          # anti-flash white -- page background
    "surface": "#FFFFFF",     # card / chart surface
    "surface_alt": "#EADECB", # bone -- secondary surface, heatmap low end
    "hairline": "#D6D6D6",    # timberwolf -- borders, dividers
    "text": "#26210F",        # near-black bronze, derived from gold for AA contrast
    "text_dim": "#7A6F52",    # muted ink, derived from gold
    "ball_red": "#D1B01B",    # gold (metallic) -- primary accent [legacy key name]
    "turf": "#4A3F1E",        # dark bronze -- secondary/dark accent [legacy key name]
    "amber": "#FFD000",       # jonquil -- bright highlight accent [legacy key name]
    "clay": "#8C4A3A",        # muted clay -- alerts / ties / "field" only
}


def inject_css():
    css = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
        '<style>'
        f'.stApp {{ background: {COLORS["bg"]}; }}'
        f'html, body, [class*="css"] {{ font-family: "Inter", sans-serif; color: {COLORS["text"]}; }}'
        f'h1, h2, h3 {{ font-family: "Space Grotesk", sans-serif !important; letter-spacing: -0.02em; color: {COLORS["text"]} !important; }}'
        f'[data-testid="stSidebar"] {{ background: {COLORS["surface_alt"]}; border-right: 1px solid {COLORS["hairline"]}; }}'
        f'[data-testid="stSidebar"] * {{ color: {COLORS["text"]} !important; }}'
        f'.stCaption, [data-testid="stCaptionContainer"] {{ color: {COLORS["text_dim"]} !important; }}'
        '.kpi-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }'
        f'.kpi-card {{ background: {COLORS["surface"]}; border: 1px solid {COLORS["hairline"]}; border-top: 3px solid {COLORS["ball_red"]}; border-radius: 10px; padding: 16px 18px; flex: 1; min-width: 150px; box-shadow: 0 1px 3px rgba(38,33,15,0.06); transition: transform 0.15s ease, box-shadow 0.15s ease; }}'
        '.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(38,33,15,0.12); }'
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
    """accent: None (gold, default), 'turf' (dark bronze), or 'amber' (jonquil)."""
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
# palette without each page having to redefine it. Note this is
# "plotly_white" now, not "plotly_dark" -- every page's charts need to
# switch to spreading this dict into update_layout(**PLOTLY_TEMPLATE_LAYOUT)
# instead of passing template="plotly_dark" directly.
PLOTLY_TEMPLATE_LAYOUT = dict(
    template="plotly_white",
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["surface"],
    font=dict(family="Inter, sans-serif", color=COLORS["text"]),
    margin=dict(l=10, r=10, t=30, b=10),
)

# Monochromatic gold ramp (plus two neutrals) so multi-category charts --
# e.g. the 6-team wins pie -- stay inside the brand palette's family
# instead of reaching for unrelated hues.
CHART_COLOR_SEQUENCE = [
    COLORS["ball_red"], COLORS["amber"], COLORS["turf"], COLORS["clay"],
    "#B9A46B", "#6B5D33", COLORS["hairline"], COLORS["text_dim"],
]

# For 2-value comparisons (player A vs player B, innings 1 vs 2, bat vs field)
DUO_COLOR_SEQUENCE = [COLORS["ball_red"], COLORS["turf"]]

# For a low->high heatmap/gradient (phase breakdown tables)
HEATMAP_SCALE_WARM = [[0, COLORS["surface_alt"]], [1, COLORS["ball_red"]]]
HEATMAP_SCALE_ALERT = [[0, COLORS["surface_alt"]], [1, COLORS["clay"]]]
