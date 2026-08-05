"""
ThirdUmpire API -- application entrypoint.

This replaces the original single-file dashboard/backend/main.py with a
modular FastAPI app. Every endpoint's query logic is preserved exactly;
only the organization changed (split into routers by resource, shared
helpers moved into app/utils and app/database).

Run:
    pip install -r requirements.txt
    cp .env.example .env   # fill in DATABASE_URL
    uvicorn app.main:app --reload

Docs at http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import (
    analytics,
    filters,
    health,
    leaderboards,
    matches,
    overview,
    players,
    records,
    seasons,
    teams,
    venues,
)

app = FastAPI(
    title="ThirdUmpire API",
    description="Pakistan Super League analytics platform -- REST API",
    version="2.0.0",
)

# Dev-friendly CORS. Tighten allow_origins to the deployed frontend URL
# (e.g. https://thirdumpire.vercel.app) before shipping to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Without this, an unhandled exception (e.g. a bad query, a DB
    connection drop) can produce a raw ASGI-level crash instead of a
    normal HTTP response. CORSMiddleware only adds its headers to
    responses that make it back through the app -- a response that
    never comes back gets no CORS headers either, and the browser
    reports that as a CORS error ("no Access-Control-Allow-Origin
    header"), which is misleading: the real problem is the 500, not
    CORS config. This guarantees every route always returns a real,
    CORS-tagged JSON response, even on a bug, so the frontend sees an
    honest error instead of an opaque CORS failure.
    """
    return JSONResponse(status_code=500, content={"error": "internal_server_error", "detail": str(exc)})


app.include_router(health.router)
app.include_router(filters.router)
app.include_router(overview.router)
app.include_router(seasons.router)
app.include_router(teams.router)
app.include_router(matches.router)
app.include_router(players.router)
app.include_router(venues.router)
app.include_router(leaderboards.router)
app.include_router(analytics.router)
app.include_router(records.router)
