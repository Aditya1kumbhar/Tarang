"""
ORCA Production Rate Limiter Module.
Provides multi-worker shared rate limiting across Uvicorn / Gunicorn processes
with Cloudflare & reverse-proxy real IP resolution (anti-spoofing).
"""

from datetime import datetime, timezone
import ipaddress
import logging
import os
from pathlib import Path
import sqlite3
import time
from typing import List, Optional

from fastapi import Request
from limits.storage.base import Storage
from slowapi import Limiter

logger = logging.getLogger("orca_rate_limiter")

# Trusted internal reverse proxy networks (RFC 1918, loopback, link-local)
# Used to sanitize X-Forwarded-For headers from right-to-left
INTERNAL_PROXY_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::1/128"),
]


def is_internal_ip(ip_str: str) -> bool:
    """Checks if an IP belongs to an internal/private proxy network."""
    try:
        addr = ipaddress.ip_address(ip_str.strip())
        return any(addr in net for net in INTERNAL_PROXY_NETWORKS)
    except ValueError:
        return False


def get_real_client_ip(request: Request) -> str:
    """
    Extracts authentic client IP behind Cloudflare and reverse proxies (e.g. Render Envoy).
    Security-hardened against IP spoofing:
    1. CF-Connecting-IP: Top priority. Injected and authenticated by Cloudflare's edge proxy;
       cannot be spoofed by external HTTP clients when proxied through Cloudflare.
    2. True-Client-IP: Akamai / Cloudflare Enterprise authenticated edge header.
    3. X-Real-IP: Upstream proxy client IP (validated non-internal).
    4. X-Forwarded-For: Parsed from right-to-left, discarding internal/private proxy hops
       (Render LB, internal routers). The first external hop from the right is the genuine
       client. Leftmost values are untrusted and client-controlled.
    5. Direct socket connection IP as fallback.
    """
    if request is not None:
        headers = request.headers

        # 1. Cloudflare Authenticated Edge Header
        cf_ip = headers.get("cf-connecting-ip")
        if cf_ip and cf_ip.strip():
            return cf_ip.strip()

        # 2. True-Client-IP
        true_ip = headers.get("true-client-ip")
        if true_ip and true_ip.strip():
            return true_ip.strip()

        # 3. X-Real-IP
        real_ip = headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            clean_real = real_ip.strip()
            if not is_internal_ip(clean_real):
                return clean_real

        # 4. X-Forwarded-For: Traverse right-to-left
        xff = headers.get("x-forwarded-for")
        if xff:
            hops = [h.strip() for h in xff.split(",") if h.strip()]
            for hop in reversed(hops):
                if not is_internal_ip(hop):
                    return hop
            if hops:
                return hops[-1]

        # 5. Socket Host Fallback
        if request.client and request.client.host:
            return request.client.host

    return "127.0.0.1"


class SQLiteSharedStorage(Storage):
    """
    High-performance WAL-mode SQLite storage for slowapi / limits.
    Enables shared rate-limit counters across all concurrent Uvicorn worker processes
    on a single instance without requiring an external Redis infrastructure.
    """
    STORAGE_SCHEME = ["sqlite", "sqlite3"]

    def __init__(self, uri: Optional[str] = None, **options):
        super().__init__(uri, **options)
        if uri:
            raw_path = uri.replace("sqlite:///", "").replace("sqlite://", "")
        else:
            raw_path = os.getenv("RATE_LIMIT_DB_PATH", "backend/data/rate_limit_shared.db")

        self.db_path = str(Path(raw_path).resolve())
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        with self._get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA busy_timeout=5000;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rate_limits (
                    key TEXT PRIMARY KEY,
                    count INTEGER NOT NULL,
                    expires_at REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rate_limits_exp ON rate_limits (expires_at)")
            conn.commit()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        return conn

    @property
    def base_exceptions(self):
        return (sqlite3.Error,)

    def incr(self, key: str, expiry: int, elastic_expiry: bool = False, amount: int = 1) -> int:
        now = time.time()
        new_expiry = now + expiry

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")
            cur.execute("SELECT count, expires_at FROM rate_limits WHERE key = ?", (key,))
            row = cur.fetchone()

            if row is None or row[1] <= now:
                # Key is new or expired
                cur.execute(
                    "INSERT OR REPLACE INTO rate_limits (key, count, expires_at) VALUES (?, ?, ?)",
                    (key, amount, new_expiry),
                )
                # Opportunistic cleanup of stale keys
                cur.execute("DELETE FROM rate_limits WHERE expires_at < ?", (now,))
                conn.commit()
                return amount
            else:
                new_count = row[0] + amount
                exp = new_expiry if elastic_expiry else row[1]
                cur.execute(
                    "UPDATE rate_limits SET count = ?, expires_at = ? WHERE key = ?",
                    (new_count, exp, key),
                )
                conn.commit()
                return new_count

    def get(self, key: str) -> int:
        now = time.time()
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT count, expires_at FROM rate_limits WHERE key = ?", (key,))
            row = cur.fetchone()
            if row and row[1] > now:
                return row[0]
            return 0

    def get_expiry(self, key: str) -> float:
        now = time.time()
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT expires_at FROM rate_limits WHERE key = ?", (key,))
            row = cur.fetchone()
            if row and row[0] > now:
                return row[0] - now
            return 0.0

    def check(self) -> bool:
        return True

    def reset(self) -> Optional[int]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM rate_limits")
            conn.commit()
            return cur.rowcount

    def clear(self, key: str) -> None:
        with self._get_connection() as conn:
            conn.execute("DELETE FROM rate_limits WHERE key = ?", (key,))
            conn.commit()


# ==============================================================================
# RATE LIMITER FACTORY
# ==============================================================================
def create_rate_limiter() -> Limiter:
    """
    Initializes a production rate limiter with multi-worker shared storage.
    If REDIS_URL is provided, Redis is used.
    Otherwise, WAL-mode SQLite shared storage is used across all Uvicorn processes.
    """
    redis_url = os.getenv("REDIS_URL") or os.getenv("RATE_LIMIT_REDIS_URL")
    if redis_url:
        storage_uri = redis_url
        logger.info("Using Redis shared storage for rate limiting: %s", redis_url.split("@")[-1])
    else:
        db_path = os.getenv("RATE_LIMIT_DB_PATH", "backend/data/rate_limit_shared.db")
        storage_uri = f"sqlite:///{db_path}"
        logger.info("Using SQLite WAL-mode shared storage across Uvicorn workers: %s", db_path)

    return Limiter(
        key_func=get_real_client_ip,
        default_limits=["120/minute"],
        storage_uri=storage_uri,
        headers_enabled=False,
        enabled=True,
    )


# Singleton instance for import across application
limiter = create_rate_limiter()
