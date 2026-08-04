"""
Minimal in-process TTL cache for read-mostly, low-cardinality endpoints
(the /api/filters/* dropdown-population routes are the main users).

This is intentionally not Redis/memcached: filter option lists (seasons,
teams, players, venues, cities) only change when new match data is
scraped and loaded, not on every request, so a process-local cache with
a multi-hour TTL removes the repeat round-trip to Postgres for what is
otherwise the same query run over and over.

Trade-off: the cache is per-process, so it is NOT shared across multiple
uvicorn/gunicorn workers, and each worker independently warms its own
copy. That's fine at this app's scale (a handful of near-static lists).
If this ever runs with several workers under real load, swap the store
in `ttl_cache` for Redis (or another shared cache) -- call sites don't
need to change, since they only see the decorator.
"""

from __future__ import annotations

import threading
import time
from functools import wraps
from typing import Callable, TypeVar

T = TypeVar("T")


def ttl_cache(ttl_seconds: int) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Cache a function's return value for `ttl_seconds`, keyed by its
    call arguments. Thread-safe (FastAPI/uvicorn can serve requests on a
    threadpool for sync def endpoints like these).
    """

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        lock = threading.Lock()
        store: dict[tuple, tuple[float, T]] = {}

        @wraps(fn)
        def wrapper(*args, **kwargs) -> T:
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()

            with lock:
                hit = store.get(key)
                if hit is not None and (now - hit[0]) < ttl_seconds:
                    return hit[1]

            result = fn(*args, **kwargs)

            with lock:
                store[key] = (now, result)
            return result

        def cache_clear() -> None:
            """Manual invalidation hook, e.g. after a data reload job."""
            with lock:
                store.clear()

        wrapper.cache_clear = cache_clear  # type: ignore[attr-defined]
        return wrapper

    return decorator
