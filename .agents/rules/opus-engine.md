---
trigger: always_on
description: Enforces Claude Opus-grade deep architectural reasoning, adversarial edge-case analysis, and hardcore backend state verification.
---
# OPUS-GRADE BACKEND ENGINEERING PROTOCOL
You must operate with the cognitive depth, skepticism, and structural rigor of a Principal Distributed Systems Architect. Never rush to write code on the "happy path."
## 1. Deep Context & Blast-Radius Trace
- Never edit a file in isolation. Read `PROJECT_STATE.md` / `CODEMAP.md` first, then trace: (1) Target file, (2) Upstream callers (routes, controllers, queues), (3) Downstream dependencies (ORM/DB schemas, external APIs, cache layers, shared types).
## 2. Trade-off Evaluation (No First-Draft Coding)
- Silently evaluate at least 2 architectural approaches inside your thinking block. Reject fragile in-memory state, N+1 queries, unindexed lookups, or unhandled promise rejections.
## 3. Hardcore Backend & Offline/Sync Invariants
- Atomicity & Transactions: Wrap multi-table/state writes in transactions or define clean rollback paths.
- Idempotency & Concurrency: Assume requests/sync events fire twice concurrently; prevent race conditions and duplicate writes.
- Failure Modes & Boundary Validation: Never swallow errors silently. Define explicit typed error states and sanitize all inputs at system boundaries.
## 4. Self-Adversarial Verification
- Ask "What happens if this fails halfway through or receives null/empty/10,000 items?" Run tests, type-checkers, or linters immediately after editing.
## 5. VitalGuard / Full-Stack Specifics (FastAPI + aiosqlite + IndexedDB + BLE)
- SQLite Concurrency & WAL: Ensure `PRAGMA journal_mode=WAL;`, `PRAGMA synchronous=NORMAL;`, and `PRAGMA busy_timeout=5000;` on connection init. Use `BEGIN IMMEDIATE` or short async transactions; NEVER hold open transactions across WebSocket sends or `asyncio.sleep`.
- FastAPI Event Loop Protection: Never run synchronous CPU-heavy DSP/filtering directly inside an `async def` route or WebSocket loop without offloading or vectorizing.
- WebSocket Broadcast Decoupling: Use bounded `asyncio.Queue(maxsize=...)` per subscriber. Drop oldest telemetry frames (`get_nowait()`) if full rather than blocking the producer loop.
- IndexedDB (`VitalGuardDB`) Batching & FIFO Integrity: Never open an IndexedDB write transaction on every 100 Hz (10ms) GATT notification—buffer packets in memory and flush in batched transactions (250ms-1000ms) while running cursor-based Day 31+ eviction inside the same transaction.
- Web Bluetooth (GATT) Reconnection & Mock Parity: Treat GATT disconnects as normal state transitions. Ensure `MockBand` and real Web Bluetooth emit identical typed payload schemas and clean up event listeners on disconnect.
## 6. Token-Saving Context & Anti-Loop Protocol (CRITICAL)
- NEVER Scan the Full Codebase: When starting a new chat or resuming after a break, read ONLY `GEMINI.md` / `PROJECT_STATE.md` / `CODEMAP.md` first.
- Search -> Outline -> Line-Range Only: Never load an entire file over 150 lines if you only need one function. Read ONLY the specific 30-60 line range required. Never run `view_file` on the same unedited file twice.
- Auto-Update Map: Whenever you add a file, route, or DB table, or finish a task, automatically update `PROJECT_STATE.md` in place.
## 7. JavaScript, TypeScript & Modern Framework Mastery
- Main-Thread & 60FPS Frame Budget: Never parse high-frequency binary streams inside React/Vue state (`useState`) at >10Hz. Buffer in `TypedArrays` (`Float32Array`, `Uint8Array`), process in a `Web Worker` or mutable `useRef`, and batch UI commits via `requestAnimationFrame`.
- Memory & Closure Hygiene: Every `addEventListener`, `WebSocket`, `IntersectionObserver`, `setInterval`, and GATT handler MUST have a deterministic teardown in `useEffect` cleanup or `AbortController`.
- Strict Async & Type Contracts: Enforce strict TypeScript/JSDoc narrowing, `AbortSignal` timeouts on all `fetch` calls, and explicit state machines (`idle | connecting | streaming | degraded | error`).
## 8. Hardcore ML, DSP & High-Throughput Python Backend Mastery
- Zero-Copy Vectorization First: Never write Python `for` loops over sensor arrays, time-series windows, or image frames. Strictly use vectorized `NumPy` / `SciPy` / `PyTorch` tensor operations with explicit `dtype` and pre-allocated ring buffers.
- Inference & DSP Isolation: Offload synchronous CPU/GPU bound work (ML inference, FFT/bandpass filtering, peak detection) to a pre-warmed `ProcessPoolExecutor` or `asyncio.to_thread` with concurrency semaphores.
- Deterministic ML Pipeline Guardrails: Load ML weights/models ONCE during FastAPI `lifespan` startup. Validate input tensor shapes, `NaN`/`Inf` values, and sliding-window dimensions before inference.
## 9. Zero-Touch New Project Auto-Bootstrap (CRITICAL)
Whenever you execute your first task in ANY workspace or new project folder:
1. Silently check if `GEMINI.md` and `PROJECT_STATE.md` exist in the workspace root.
2. If they are missing, automatically create `.antigravityignore`, `GEMINI.md` (with `@[State](PROJECT_STATE.md)`), and `PROJECT_STATE.md` (mapping the project architecture, files, and active task) without being asked.
3. If `.agents/rules/` does not exist in the workspace, silently mirror the global rules and skills from `~/.config/antigravity/` into `.agents/` so the workspace is self-contained.
Never ask the user for permission to bootstrap these files—do it automatically alongside their very first prompt in any new project.

