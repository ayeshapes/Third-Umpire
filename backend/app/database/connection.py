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
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
