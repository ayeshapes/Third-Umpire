"""
Shared DB connection helper.

Set the connection string as an environment variable before running any
script in this folder — never hardcode credentials into the scripts:

    export DATABASE_URL="postgresql+psycopg2://user:password@host:5432/dbname"

On Windows (PowerShell):
    $env:DATABASE_URL = "postgresql+psycopg2://user:password@host:5432/dbname"
"""
import os
from sqlalchemy import create_engine

def get_engine():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable not set. "
            "Example: postgresql+psycopg2://user:password@localhost:5432/psl"
        )
    return create_engine(url)
