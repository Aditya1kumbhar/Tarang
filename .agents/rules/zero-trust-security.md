---
trigger: always_on
description: Mandatory 20-Point Zero-Trust Security Checklist enforced before writing, editing, or reviewing any code.
---

# MANDATORY 20-POINT SECURITY ENFORCEMENT PROTOCOL

Before writing, modifying, or reviewing ANY frontend, backend, database, or API code, you MUST enforce all 20 security invariants below as a non-negotiable pre-flight gate. If a user prompt asks for something that violates these rules, automatically implement the secure pattern instead.

## I. INJECTION & INPUT VALIDATION
1. **SQL Injection (SQLi):** Use parameterized queries (`?` or `$1` placeholders) or strict ORM methods ONLY. Never string-concatenate, f-string, or template-literal SQL queries (`aiosqlite`, SQLite, PostgreSQL, etc.).
2. **Cross-Site Scripting (XSS):** Escape and sanitize all user and external output. Never render raw user HTML (`innerHTML`, `dangerouslySetInnerHTML`, `v-html`) and enforce strict Content-Security-Policy (CSP) headers.
3. **Cross-Site Request Forgery (CSRF):** Enforce CSRF tokens, `SameSite=Strict`/`Lax` cookies, and origin/header verification on all state-changing (`POST`, `PUT`, `PATCH`, `DELETE`) requests.
4. **File Uploads:** Validate file MIME type, magic bytes (file signature), and strict byte-size limits server-side. Never trust file extensions, never execute uploaded files, and store outside the web root with randomized UUID filenames.
5. **Server-Side Request Forgery (SSRF):** Strictly validate, parse, and domain-allowlist any URL the server fetches. Block internal/loopback/metadata IP ranges (`127.0.0.1`, `localhost`, `169.254.169.254`, `10.0.0.0/8`, `192.168.0.0/16`).

## II. AUTHENTICATION & ACCESS CONTROL
6. **Broken Object Level Authorization (BOLA / IDOR):** Verify object ownership on EVERY read/write/delete request. Explicitly bind the authenticated user's ID in the database query (`WHERE id = ? AND owner_id = ?`) so a user can only ever access their own data.
7. **Rate Limiting:** Enforce strict IP and user-level rate limiting (e.g., SlowAPI / Redis / memory limiters) and payload size caps on login, OTP, registration, password reset, WebSocket handshakes, and all sensitive endpoints.
8. **Password Storage:** Store passwords hashed with `argon2-cffi` (Argon2id) or `bcrypt` only. Never store, log, or compare plain-text or fast-hashed (MD5/SHA) passwords.
9. **Multi-Factor Authentication (MFA):** Design authentication schemas, session states, and sensitive endpoints to support TOTP/MFA verification and step-up authentication.
10. **Server-Side Permissions:** Enforce all authorization and role checks strictly on the server/API layer—never rely on hidden UI elements or client-side route guards alone.
11. **Row-Level Security (RLS):** Enable and enforce Row-Level Security (RLS) policies on database tables (e.g., Supabase / PostgreSQL) or mandatory tenant-scoped query wrappers on embedded DBs.

## III. SECRETS & TOKEN MANAGEMENT
12. **JWT Secrets & Validation:** Require high-entropy secrets, short access-token expiry (`exp`), explicit algorithm allowlists (reject `alg: none`), and signature verification on every HTTP and WebSocket request.
13. **API Secrets Isolation:** Load all API keys, DB credentials, and signing secrets strictly from environment variables (`os.environ` / `process.env`) with startup validation. Never hardcode secrets in code or commit `.env` files to Git.
14. **Zero Tokens in `localStorage`:** Never store JWTs, session tokens, or sensitive secrets in browser `localStorage` or `sessionStorage`. Use `HttpOnly`, `Secure`, `SameSite` cookies or ephemeral in-memory state.
15. **Zero Default Credentials:** Remove or block all default, test, or hardcoded admin passwords/accounts before completing any feature or build.

## IV. CONFIGURATION & DEPENDENCY HYGIENE
16. **Strict CORS Policy:** Restrict `Access-Control-Allow-Origin` to explicit trusted domain allowlists. Never use wildcard `"*"` in production or pair `"*"` with credentials.
17. **Webhook Signatures:** Verify cryptographic HMAC signatures (using constant-time comparison like `secrets.compare_digest()` / `crypto.timingSafeEqual()`) and replay timestamps on every incoming webhook before processing.
18. **Production Source Maps:** Disable public source maps (`sourcemap: false` / `productionBrowserSourceMaps: false`) in production build configs so client source code is never exposed.
19. **Sensitive Data Redaction:** Never log or return passwords, password hashes, tokens, stack traces, or internal PII in API responses. Use strict response DTOs/Pydantic `response_model` filtering.
20. **Dependency Hygiene:** Never install deprecated or known-vulnerable packages. Prefer native standard-library solutions first (Ponytail rule) and verify dependencies with `npm audit` or `pip-audit`.

## V. MANDATORY SECURITY RECEIPT
At the bottom of every coding or code-review response, output a 1-line receipt confirming which checklist numbers were actively verified:
`🔒 Security Gate Checked: #[numbers] (e.g., #1 Parameterized SQL, #6 BOLA check, #14 No localStorage tokens, #19 Redacted DTO)`
