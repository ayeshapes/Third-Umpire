"""
Shared cricket-domain helpers.

Preserved from the original dashboard/backend/main.py so every router
that needs to sum bowling overs correctly uses the exact same logic.
"""


def overs_to_balls_expr(column: str) -> str:
    """
    overs_bowled is stored in cricket's X.Y over notation (e.g. 3.4 means
    3 overs + 4 balls = 22 balls), NOT decimal overs. Summing it directly
    across innings would be mathematically wrong (3.4 + 3.4 != 7.2 overs
    in real balls -- it's 44 balls = 7.2 overs, which happens to work out
    here, but e.g. 3.5 + 3.5 = 44 balls = 7.2 overs, not 7.10). Converting
    to balls first, summing, then converting back is the only correct way.

    Returns a SQL expression (string) usable inside a SUM(...).
    """
    return f"(FLOOR({column}) * 6 + ROUND(({column} - FLOOR({column})) * 10))"


def balls_to_overs_str(total_balls: int) -> str:
    """Convert a ball count back to cricket's X.Y overs notation."""
    return f"{total_balls // 6}.{total_balls % 6}"
