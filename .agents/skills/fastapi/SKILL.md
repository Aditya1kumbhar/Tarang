---
name: fastapi
description: >-
  Modern standards, patterns, and best practices for building production-ready FastAPI applications,
  dependency injection, Pydantic v2 schemas, and high-performance async APIs.
---

# FastAPI Production Standards & Modern Conventions

This skill provides on-demand guidelines and idiomatic code patterns for developing high-performance, maintainable APIs using modern FastAPI and Pydantic v2.

---

## 1. Project Structure & Router Modularization

Structure APIs into clean, decoupled layers:

```text
backend/
├── main.py              # FastAPI app initialization, middleware, lifecycle events
├── config.py            # Pydantic BaseSettings or typed configuration
├── schemas/             # Pydantic v2 request/response models
│   └── models.py
├── routers/             # Domain-specific APIRouter modules
│   ├── auth.py
│   └── items.py
├── services/            # Business logic and external API integrations
└── dependencies.py      # Shared dependency injection providers
```

In `main.py`, mount routers with clean prefixes and tags:
```python
from fastapi import FastAPI
from backend.routers import items, auth

app = FastAPI(title="Maritime Intelligence API", version="1.0.0")

app.include_router(items.router, prefix="/api/v1/items", tags=["items"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
```

---

## 2. Modern Dependency Injection (`Annotated`)

Always use `typing.Annotated` for dependency injection and parameter metadata:

```python
from typing import Annotated
from fastapi import APIRouter, Depends, Query, HTTPException, status

router = APIRouter()

# Bad: def get_items(limit: int = Query(10), db: Session = Depends(get_db)):
# Good: Modern Annotated style
PaginationLimit = Annotated[int, Query(ge=1, le=100, description="Items per page")]
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

@router.get("/")
async def list_items(
    limit: PaginationLimit = 20,
    db: DbSession = None,
    user: CurrentUser = None,
):
    return await item_service.fetch_all(db, limit=limit)
```

---

## 3. Pydantic v2 Patterns & Strict Validation

Follow modern Pydantic v2 idioms:
- Use `ConfigDict(extra="forbid", from_attributes=True)` for strict schemas.
- Avoid legacy `class Config:` syntax and deprecated `validator` decorators (use `@field_validator` and `@model_validator`).
- Never use `Ellipsis` (`...`) as default values; specify default types or `Field(...)` explicitly.

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator

class VesselReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    vessel_id: str = Field(min_length=3, max_length=64, description="Unique vessel MMSI or callsign")
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    speed_knots: float = Field(default=0.0, ge=0.0, le=100.0)

    @field_validator("vessel_id")
    @classmethod
    def validate_vessel_id(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("vessel_id must be alphanumeric")
        return v.upper()
```

---

## 4. Async vs Sync Execution Rules

1. **`async def` endpoints:**
   - Must ONLY contain non-blocking asynchronous calls (e.g., `httpx.AsyncClient`, `asyncpg`, `asyncio.sleep`).
   - NEVER call blocking libraries (`requests.get`, `time.sleep`, heavy CPU loops) inside `async def`, as it freezes the event loop.

2. **Standard `def` endpoints:**
   - Use standard `def` for synchronous, blocking libraries. FastAPI automatically executes synchronous route handlers in an external thread pool.

3. **Heavy Compute Delegation:**
   - Offload heavy CPU/DSP/ML tasks to thread pools (`asyncio.to_thread`) or background workers (Celery/RQ).

---

## 5. Error Handling & Standard Responses

Always use explicit `HTTPException` with proper `status_code` constants:

```python
from fastapi import HTTPException, status

if not item:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error_code": "ITEM_NOT_FOUND", "message": f"Item {item_id} does not exist"},
    )
```

Use `response_model` on endpoints to filter and validate outgoing data, preventing accidental leakage of sensitive attributes.

