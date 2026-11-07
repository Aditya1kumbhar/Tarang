"""
Pytest configuration and environment initialization for ORCA test suite.
Ensures syntactically valid dummy auth credentials and environment configuration
are present in CI/isolated test runners before any module imports backend.main.
"""

import os

# Syntactically valid dummy Google Client ID for testing and CI
DUMMY_GOOGLE_CLIENT_ID = "000000000000-dummycitestonly00000000000000.apps.googleusercontent.com"

# Set default test environment variables BEFORE any application code imports backend.main.
# setdefault ensures real developer environment values are never overwritten.
os.environ.setdefault("GOOGLE_CLIENT_ID", DUMMY_GOOGLE_CLIENT_ID)
os.environ.setdefault("VITE_GOOGLE_CLIENT_ID", DUMMY_GOOGLE_CLIENT_ID)
os.environ.setdefault("AUTH_SECRET", "orca_maritime_national_security_auth_secret_2026")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("AI_TIMEOUT_SECONDS", "45.0")

