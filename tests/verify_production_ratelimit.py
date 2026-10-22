"""
Standalone Production-Style Verification Script for Rate Limiting.
Simulates production requests with realistic Cloudflare + Render headers
and multi-worker shared storage.
"""

import os
import sys

# Ensure production environment flags are set before importing application
os.environ["ENVIRONMENT"] = "production"
os.environ["ALLOWED_ORIGINS"] = "https://tarang-0v0t.onrender.com"
os.environ["RATE_LIMIT_DB_PATH"] = "backend/data/rate_limit_shared.db"

from fastapi.testclient import TestClient
from backend.main import app
from backend.rate_limiter import limiter, get_real_client_ip

def run_production_verification():
    print("==================================================================")
    print("  PRODUCTION-STYLE RATE LIMIT ENFORCEMENT VERIFICATION")
    print("==================================================================")
    print(f"Environment: {os.getenv('ENVIRONMENT')}")
    print(f"Storage backend: {type(limiter._storage).__name__}")
    print(f"Shared DB path: {getattr(limiter._storage, 'db_path', 'N/A')}")
    print(f"Limiter enabled: {limiter.enabled}")

    # 1. Reset storage for clean test run
    limiter._storage.reset()
    client = TestClient(app)

    # 2. Simulate 24 rapid POST requests from a single client behind Cloudflare
    client_ip = "198.51.100.77"
    results = []

    print(f"\n[Test 1] Dispatching 24 rapid POSTs to /api/v1/chat from {client_ip}...")
    for i in range(1, 25):
        resp = client.post(
            "/api/v1/chat",
            json={"message": f"Rapid probe {i}: checking sea status off Rameswaram"},
            headers={
                "CF-Connecting-IP": client_ip,
                "X-Forwarded-For": f"1.1.1.1, {client_ip}, 10.0.1.2",
            },
        )
        status_code = resp.status_code
        results.append(status_code)
        if status_code == 429:
            data = resp.json()
            print(f"  Request {i:2d}: HTTP {status_code} -> {data.get('detail', '')}")
        else:
            print(f"  Request {i:2d}: HTTP {status_code}")

    # 3. Assertions
    passed_requests = results[:10]
    blocked_requests = results[10:]

    assert all(code == 200 for code in passed_requests), (
        f"Expected first 10 requests to pass with 200, got: {passed_requests}"
    )
    assert all(code == 429 for code in blocked_requests), (
        f"Expected requests 11-24 to be blocked with 429, got: {blocked_requests}"
    )
    print("\n  >>> PASSED: Exactly 10 requests allowed, remaining 14 blocked with HTTP 429.")

    # 4. Anti-Spoofing Test: Client attempts to rotate leftmost XFF header
    print(f"\n[Test 2] Anti-Spoofing: Client {client_ip} attempts to bypass by rotating leftmost X-Forwarded-For...")
    spoofed_results = []
    for spoof_ip in ["2.2.2.2", "3.3.3.3", "4.4.4.4"]:
        resp = client.post(
            "/api/v1/chat",
            json={"message": "Bypass attempt"},
            headers={
                "CF-Connecting-IP": client_ip,  # Real IP remains fixed by Cloudflare
                "X-Forwarded-For": f"{spoof_ip}, {client_ip}, 10.0.1.2",
            },
        )
        spoofed_results.append(resp.status_code)
        print(f"  Spoofed XFF '{spoof_ip}' -> HTTP {resp.status_code}")

    assert all(code == 429 for code in spoofed_results), (
        f"Spoofed requests bypassed rate limiter: {spoofed_results}"
    )
    print("  >>> PASSED: Leftmost X-Forwarded-For rotation safely ignored; CF-Connecting-IP enforced.")

    # 5. Clean up
    limiter._storage.reset()
    print("\n==================================================================")
    print("  ALL PRODUCTION RATE LIMITING CHECKS PASSED (24/24 ACCURATE)")
    print("==================================================================")


if __name__ == "__main__":
    run_production_verification()
