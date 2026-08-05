"""
Database connection handling.

Preserved from the original dashboard/backend/main.py: a plain psycopg2
connection using RealDictCursor so every row comes back as a dict that
FastAPI can serialize directly to JSON. If the project later moves to
SQLAlchemy models for writes, this stays the read path for the
dashboard's query-heavy endpoints -- no need to force everything through
an ORM.
"""

import os

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in "
        "your PostgreSQL connection string."
    )


def get_conn():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

    # Supabase installs extensions (pg_trgm, postgis, etc.) into a schema
    # called `extensions`, not `public` -- the extension is genuinely
    # installed, but an unqualified call like similarity(...) still fails
    # with "function ... does not exist" because `public` (the default
    # search_path) doesn't include it. Adding `extensions` to the search
    # path fixes every unqualified extension-function call across the
    # whole app (players/teams/venues fuzzy search) without having to
    # schema-qualify each call site individually. Harmless on databases
    # that don't have an `extensions` schema at all -- Postgres silently
    # skips missing schemas in search_path.
    with conn.cursor() as cur:
        cur.execute("SET search_path TO public, extensions;")
    conn.commit()

    return conn
