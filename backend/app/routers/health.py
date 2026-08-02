"""
ThirdUmpire API -- health router.

Preserved query logic, migrated from the original monolithic
dashboard/backend/main.py into a modular FastAPI router.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.database.connection import get_conn

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health():
    return {"status": "ok"}
