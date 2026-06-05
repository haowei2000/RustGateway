# Implementation Plan

Status snapshot (2026-06-05) and a sequenced plan to take the project from
"schema + admin CRUD + static proxy" to a working, quota-enforcing LLM gateway.

Priority track for this plan: **Quotas & Usage** (rate limits, token caps,
audit persistence, usage accounting). Because enforcement happens in the data
plane, this track has a hard dependency on the gateway becoming config-aware,
so Phase 0 below is the unavoidable prerequisite and is scoped as tightly as
possible.

---

## 1. Where the project is today

### Implemented
- **`crates/common`** — shared domain types, SHA-256 API-key hashing, `AuditEvent`.
- **`admin-api` (Axum)** — full CRUD over Postgres (`sqlx`, runtime-checked
  queries) for epichust-models, providers, provider-models, model-mappings,
  api-keys; live upstream `/v1/models` fetch; `/healthz`, `/readyz`,
  OpenAPI/Swagger at `/docs`.
- **`gateway` (Pingora)** — `POST /v1/chat/completions` proxy: path/method
  guards, bearer parse + SHA-256, **static** env key allow-list, forwards to a
  **single** `OPENAI_BASE_URL` with a **single** static `OPENAI_API_KEY`,
  Prometheus metrics, body probe for `model`/`stream`, JSON audit line to stdout.
- **`admin-web`** — React/Vite/TanStack Query/Zustand, three management surfaces.
- **`deploy`** — Docker Compose, Helm chart, `001_init.sql` (normalized schema
  with routing weight/priority, per-key model configs, audit table w/ token cols).

### Gaps (the reason this plan exists)
1. **Data plane ignores the control plane.** Gateway never reads Postgres/Redis;
   routing config, mappings, and per-key model access are unused. Redis keyspace
   in `docs/ARCHITECTURE.md` is unimplemented (`redis_url` parsed, never used).
2. **No quota/rate-limit model.** README promises RPM, per-call max-token, and
   daily-token caps per key-model. No such columns or code exist anywhere.
3. **Audit logs never persisted.** Gateway logs to stdout; nothing writes the
   `audit_logs` table; admin `audit-logs` endpoint reads an always-empty table.
4. **No token usage accounting.** Token columns exist; nothing parses upstream
   `usage` to populate them; usage views are empty.
5. **Provider keys not encrypted.** `provider_key_ciphertext BYTEA` stores raw
   `into_bytes()` and reads `from_utf8_lossy` (`repositories.rs:114,175`).
6. **No auth on admin-api.** `jwt_secret` configured/reported but no middleware.
7. **No tests; runtime-checked SQL.**

---

## 2. Phase 0 — Make the gateway config-aware (prerequisite)

Goal: the gateway resolves an incoming request to a concrete upstream using the
control-plane data, so that quota enforcement and usage accounting have
something to hang off of. Keep this minimal — full routing polish comes later.

1. **Redis cache layer (shared).**
   - Add a Redis client to both services (`redis` or `fred` crate).
   - admin-api publishes on every mutation; gateway reads on the request path.
   - Keyspace (from `docs/ARCHITECTURE.md`):
     - `gateway:api_key:{sha256}` → api_key_id + enabled
     - `gateway:api_key_policy:{api_key_id}` → per-model configs + quotas
     - `gateway:model_sources:{api_key_id}:{epichust_model_id}` → routes
     - `gateway:provider_key:{key_ref}` → (decrypted) upstream key + base URL
   - Provide a `cold-load from Postgres` fallback in the gateway when a key is
     missing from Redis, then backfill the cache.

2. **Gateway resolution path** (`gateway/src/proxy.rs`):
   - Replace the static `internal_api_key_hashes` check with a Redis lookup of
     `gateway:api_key:{hash}`.
   - Parse `model` from the body **before** `upstream_peer` (the body probe
     already exists; promote it to a blocking read of the JSON body for the
     chat-completions path).
   - Resolve `model` → allowed `epichust_model` for this key → pick a route
     (start with `priority`, lowest number wins; weighted can come later).
   - Set the upstream host/port/TLS and `Authorization` from the resolved route
     instead of env.
   - Reject with structured errors: unknown model, model not permitted for key,
     no enabled route.

3. **admin-api Redis-sync module** (`admin-api/src/cache_sync.rs`): functions
   called from each mutating repository fn to upsert/delete the relevant keys.

Acceptance: a request with a DB-provisioned key + model is routed to the mapped
provider with that provider's key; revoking access in admin reflects within the
cache TTL.

---

## 3. Phase 1 — Quotas & Usage (priority track)

### 3.1 Schema & domain (`deploy/sql/002_quotas.sql`, `crates/common/models.rs`)
- Add to `api_key_model_configs`:
  - `rpm_limit INTEGER NULL`          (requests per minute; NULL = unlimited)
  - `max_tokens_per_call INTEGER NULL`
  - `daily_token_cap BIGINT NULL`
- Extend `ApiKeyModelConfig` + `AttachApiKeyEpichustModelRequest` with these
  fields; thread through `repositories.rs` attach/list and the web form.
- Migration is additive (NULLable), so it is safe on existing rows.

### 3.2 Enforcement in the gateway (Redis counters)
- On the resolved request, read the per-model quota from
  `gateway:api_key_policy:{api_key_id}`.
- **RPM:** `INCR gateway:rate_limit:{api_key_id}:{epichust_model_id}:{minute}`
  with `EXPIRE 60`; reject with `429` + `Retry-After` when over.
- **max_tokens_per_call:** validate request `max_tokens` (and reject if the
  caller omits it but a cap is set, or clamp — decide policy; default: reject
  over-cap, allow omitted).
- **daily_token_cap:** check a running daily counter
  `gateway:tokens:{api_key_id}:{epichust_model_id}:{yyyy-mm-dd}` before
  proxying; increment in the response/usage step (3.4). Reject `429` when the
  prior total already exceeds the cap.

### 3.3 Audit log persistence
- Decide the writer. **Recommended:** gateway pushes audit events to Redis
  Stream / list; a small writer in admin-api (or a background task) drains to
  Postgres `audit_logs`. This keeps DB credentials out of the data plane and
  avoids blocking the proxy on DB writes.
- Map the existing `AuditEvent` fields to columns; fill `api_key_id`,
  `epichust_model_id/name`, `provider_id`, `provider_model_id/name` from the
  resolution step (Phase 0).

### 3.4 Token usage accounting
- **Non-streaming:** parse the upstream JSON `usage` object in
  `response_body_filter`; record `prompt_tokens`, `completion_tokens`,
  `total_tokens` into the audit event and the daily counter.
- **Streaming (SSE):** request `stream_options:{include_usage:true}` upstream
  when the client streams, then read `usage` from the final data frame; if the
  upstream doesn't support it, fall back to a tokenizer estimate (flagged as
  estimated) or leave NULL.
- Increment `gateway:tokens:...:{day}` by `total_tokens` after each call.

### 3.5 Usage views (admin-api + web)
- Add `GET /v1/usage` aggregations (by api-key, by epichust-model, by provider,
  by day) backed by `audit_logs`.
- Wire the audit/usage views in `admin-web` with the filters described in
  `docs/ARCHITECTURE.md`.

Acceptance: exceeding RPM returns 429; daily cap blocks further calls; the
`audit_logs` table fills and usage endpoints/views show real token totals.

---

## 4. Phase 2 — Security hardening

- **Encrypt provider keys at rest.** Use `pgcrypto` (already enabled) with
  `pgp_sym_encrypt`/`pgp_sym_decrypt` and a `PROVIDER_KEY_ENCRYPTION_KEY`, or
  AES-GCM in Rust. Migrate existing rows; fix the misleading
  `into_bytes()`/`from_utf8_lossy` round-trip. The gateway should receive the
  **decrypted** key only via the Redis `provider_key` entry, written by
  admin-api.
- **Admin auth.** Add JWT verification middleware (wire existing `jwt_secret`)
  and a minimal RBAC (admin vs read-only). Protect all `/v1/*` admin routes.

---

## 5. Phase 3 — Quality & ops

- Tests: gateway resolution + quota logic (unit), repositories against an
  ephemeral Postgres (e.g. `sqlx::test` or testcontainers), an end-to-end proxy
  test with a mock upstream.
- Switch `sqlx` raw queries to compile-time `query!`/`query_as!` (needs
  `DATABASE_URL` at build or `cargo sqlx prepare` offline data).
- CI (`.github/workflows`): `cargo fmt --check`, `cargo clippy -D warnings`,
  `cargo check --workspace`, `admin-web` typecheck + build.
- Resolve the dirty working tree: review and commit (or revert) the pending
  `admin-web` item-list refactor before layering new UI work.

---

## 6. Dependency order (summary)

```
Phase 0 (gateway config-aware)  ──►  Phase 1 (quotas & usage)  ──►  Phase 1.5 (usage views)
        │                                   │
        └──────────────► Phase 2 (security) ┘   (can run in parallel after Phase 0)
Phase 3 (quality/ops) — continuous, start CI immediately
```

## 7. Open decisions
- **max_tokens policy:** reject over-cap vs. clamp vs. require-explicit. Default
  proposed: reject when over cap, allow when omitted.
- **Audit writer:** gateway→Redis→admin-api drain (recommended) vs. gateway
  writes Postgres directly.
- **Streaming usage:** force `include_usage` upstream vs. tokenizer estimate
  fallback when unsupported.
- **Key encryption:** `pgcrypto` (less Rust code) vs. app-side AES-GCM (keys
  never leave the app; DB never sees plaintext).
