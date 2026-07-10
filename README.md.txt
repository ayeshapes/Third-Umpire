# ThirdUmpire — PSL Data Platform

An end-to-end data platform for the Pakistan Super League (2016–2026): Cricsheet-based
ETL pipeline into PostgreSQL, with a planned full-stack analytics dashboard for
player, team, venue, and season-level insights.

## Status
- ✅ PostgreSQL schema designed (`sql/psl_schema.sql`)
- ✅ ETL pipeline built and tested against real Cricsheet data (`src/etl.py`)
- ✅ Loader script pushing parsed data into Postgres (`src/loader.py`)
- ⏳ Web scraper for player bios/venue details — in progress
- ⏳ Analytics dashboard — not started

## Stack
PostgreSQL · Python · (planned: FastAPI + React)

## Structure
- `sql/` — database schema
- `src/` — ETL and loader scripts
- `data/` — staging CSVs (gitignored) and raw source data
- `docs/` — data dictionary / factors reference
- `notebooks/` — exploratory analysis