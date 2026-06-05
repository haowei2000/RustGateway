# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Rust (workspace root)

```bash
brew install cmake           # required for Pingora on macOS (one-time)
cargo fmt --all
cargo check --workspace
cargo build --workspace
cargo clippy --workspace
```

Run a single crate:
```bash
cargo run -p axum-admin-api
cargo run -p pingora-gateway
```

### Frontend (admin-web/)

```bash
cd admin-web
npm install
npm run dev      # dev server on :3000
npm run build    # tsc + vite build
npm run lint
```

### Full stack (Docker)

```bash
cp .env.example .env         # fill in OPENAI_API_KEY
docker compose -f deploy/docker-compose.yml up -d --build
```

Service endpoints:
- Gateway proxy: `http://localhost:8080`
- Gateway metrics (Prometheus): `http://localhost:9090`
- Admin API + Swagger UI: `http://localhost:9000` (`/docs` for OpenAPI)
- Admin Web: `http://localhost:3000`

## Architecture

### Data plane — `gateway/` (`pingora-gateway`)

Pingora HTTP reverse proxy. All traffic enters via `/v1/chat/completions`. Key behaviours implemented in `gateway/src/proxy.rs` (the `ProxyHttp` impl):

1. **Auth** — reads `Authorization: Bearer <key>`, SHA-256 hashes it, checks against the set loaded from `INTERNAL_API_KEYS` (hashed at startup) and `INTERNAL_API_KEY_HASHES` (pre-hashed).
2. **Provider key substitution** — replaces the client's bearer token with the upstream `OPENAI_API_KEY` before forwarding.
3. **SSE passthrough** — streams responses without buffering.
4. **Prometheus metrics** — `gateway_requests_total`, `gateway_auth_failures_total`, `gateway_upstream_errors_total`, `gateway_active_requests`, `gateway_request_duration_seconds`.
5. **Structured audit log** — emits JSON audit events to stdout.

Config comes entirely from environment variables (`gateway/src/config.rs`).

### Control plane — `admin-api/` (`axum-admin-api`)

Axum REST API, backed by PostgreSQL via `sqlx` (no ORM — raw SQL in `repositories.rs`). OpenAPI docs generated with `utoipa`. Routes are declared in `routes.rs`; all DB access goes through `repositories.rs`. `upstream_models.rs` handles fetching `/v1/models` from upstream providers.

`DATABASE_AUTO_MIGRATE=true` runs migrations on startup from `deploy/sql/`.

### Shared types — `crates/common/` (`llm-gateway-common`)

- `models.rs` — all domain structs shared between gateway and admin-api (serialised with serde, documented with utoipa). **The TypeScript types in `admin-web/src/lib/api.ts` are hand-mirrored from these Rust structs; keep them in sync manually.**
- `api_key.rs` — `hash_api_key` (SHA-256 hex), `hash_prefix`, `parse_bearer_token`.
- `audit.rs` — `AuditEvent`, `AuthResult`.

### Admin web — `admin-web/` (React + Vite + TypeScript)

Single-page app, no router. Navigation state lives in Zustand (`stores/admin-store.ts`): `sidebarResource` ("keys" | "providers" | "models") and `selectedSidebarItemId` drive which page renders.

All API calls go through `lib/api.ts`. TanStack Query is used for server state: there is **one primary query** (`getAdminData`, key `["admin-data"]`) that fetches everything; mutations invalidate this query on success. Hooks are in `hooks/use-admin-data.ts`.

UI is shadcn/ui components under `components/ui/`, with layout pieces in `components/layout/`. Feature pages live in `features/admin/`.

### Database schema

Six main tables in PostgreSQL (`deploy/sql/001_init.sql`):

```
epichust_models          — business-facing models (e.g. "epichust-chat")
providers                — upstream API providers (key stored as ciphertext)
provider_models          — models discovered/registered per provider
model_mappings           — links epichust_model ↔ provider_model
epichust_api_keys        — client API keys (stored as SHA-256 hash + prefix)
api_key_model_configs    — per-key per-model quota + routing config
api_key_model_routes     — weighted/priority routing rows within a config
audit_logs               — one row per proxied request
```

IDs are prefixed strings generated in `repositories.rs` (e.g., `"em-<uuid>"` for epichust models).

## Key design constraints

- The gateway currently does **not** read from PostgreSQL or Redis at request time — auth keys are baked into env vars at startup. The planned next step is to load per-key model quotas and provider key mappings from Redis.
- `OPENAI_KEY_REF` is a label logged in audit events to identify which upstream key was used, without logging the key itself.
- Provider keys are stored as `BYTEA` (`provider_key_ciphertext`) — encryption/decryption logic is not yet implemented; the column name is forward-looking.
