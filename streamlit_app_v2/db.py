"""
Shared DB connection for the Streamlit app. Reads DATABASE_URL from an
environment variable or Streamlit secrets -- never hardcode credentials.

Local dev: create .streamlit/secrets.toml with:
    DATABASE_URL = "postgresql+psycopg2://user:password@host:5432/dbname"

Or set the environment variable directly before running:
    export DATABASE_URL="postgresql+psycopg2://..."
"""
import os
import streamlit as st
from sqlalchemy import create_engine, text
import pandas as pd


@st.cache_resource
def get_engine():
    url = os.environ.get("DATABASE_URL") or st.secrets.get("DATABASE_URL", None)
    if not url:
        st.error(
            "DATABASE_URL not set. Add it to `.streamlit/secrets.toml` as "
            "`DATABASE_URL = \"postgresql+psycopg2://user:password@host:5432/dbname\"` "
            "or set it as an environment variable before running."
        )
        st.stop()
    return create_engine(url)


def run_query(sql, params=None):
    """Runs a query and returns a pandas DataFrame. Always sets the schema
    search_path first, matching every other script in this project."""
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SET search_path TO raw_cricsheet, public;"))
        return pd.read_sql(text(sql), conn, params=params or {})
