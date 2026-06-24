# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Prerequisites (one-time)
```bash
brew install cmake               # required for Pingora on macOS
cd admin-web && npm install
```

### Local dev (recommended daily workflow)
```bash
make dev            # start Postgres, Redis, admin-api, admin-web
make dev-debug      # same, with RUST_LOG=debug + RUST_BACKTRACE=1
make stop           # stop everything
```

Individual components:
```bash
make dev-infra      # start only Postgres + Redis in Docker
make dev-api        # start admin-api (RUST_LOG=info)
make dev-api-debug  # start admin-api (RUST_LOG=debug, SQL queries visible)
make dev-web        # start admin-web (Vite HMR on :5173)
```

### Debugging in VSCode
- `Debug admin-api` — launch with lldb, breakpoints, RUST_LOG=debug
- `Debug admin-web (Chrome)` — launch Chrome with source maps
- See `.vscode/launch.json` and `.vscode/tasks.json`

### K8s deployment (Helm + kind)
```bash
make helm-up        # create kind cluster, build images, deploy
make helm-down      # tear down

# Manual port-forward after deploy:
kubectl port-forward svc/admin-api 9000:9000 &
kubectl port-forward svc/admin-web 3000:80 &
```

### Production deploy (Harbor + VPS, manual)

The live deploy is a manual flow: **build locally → push to Harbor → pull on the server → (edit config if needed) → restart**. The GitHub Actions workflow exists but the day-to-day path is the steps below.

Facts:
- **Harbor registry**: `47.99.42.4:5000`; images `rustgateway/gateway`, `rustgateway/admin-api`, `rustgateway/admin-web` (the local Docker daemon is already logged in — re-run `docker login 47.99.42.4:5000` if a push 401s).
- **Server**: SSH host `aliyun1`, deploy dir `/opt/llm-gateway/deploy`, Compose project `deploy`, files `docker-compose-vps.yml` + server-local override `docker-compose-aliyun.yml`.
- **Arch**: local dev machine is arm64, the server is amd64 — always build `--platform linux/amd64`, or the container won't start.
- Gateway is published on the server at `127.0.0.1:18080` (host 8080 is taken by another stack); public entry is `https://llm.epichust.com` via the host nginx.

**1. Build + push from the workspace root** (context is the repo root for all three images):
```bash
# gateway (repeat with the other Dockerfiles/names as needed)
docker buildx build --platform linux/amd64 \
  -f gateway/Dockerfile \
  -t 47.99.42.4:5000/rustgateway/gateway:latest \
  --push .

# admin-api
docker buildx build --platform linux/amd64 \
  -f admin-api/Dockerfile \
  -t 47.99.42.4:5000/rustgateway/admin-api:latest --push .

# admin-web
docker buildx build --platform linux/amd64 \
  -f admin-web/Dockerfile \
  -t 47.99.42.4:5000/rustgateway/admin-web:latest --push .
```

**2. Pull + restart on the server** (only the changed service; confirm the exact `-f` files with `docker compose ls`):
```bash
ssh aliyun1 'cd /opt/llm-gateway/deploy && \
  docker compose -f docker-compose-vps.yml -f docker-compose-aliyun.yml pull gateway && \
  docker compose -f docker-compose-vps.yml -f docker-compose-aliyun.yml up -d gateway'
```

**3. (If config changed)** edit env/ports in `docker-compose-vps.yml` (or the server-local `docker-compose-aliyun.yml`) on the server first; a plain `up -d <svc>` recreates the container so the new config takes effect.

**4. Verify**:
```bash
ssh aliyun1 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/healthz'  # expect 200
ssh aliyun1 'docker logs --tail 50 deploy-gateway-1'
```

Notes:
- `:latest` is what Compose pulls; also tag with a short SHA (`...:gateway:abc1234`) when you want a rollback target.
- After `pull`, an unchanged image is a no-op; if the digest didn't move, your push didn't land — re-check the build/push step.

### Rust (workspace root)
```bash
cargo fmt --all
make check          # cargo check --workspace
make build          # cargo build --workspace
make lint           # cargo clippy --workspace

cargo run -p axum-admin-api
cargo run -p pingora-gateway
```

### Frontend (admin-web/)
```bash
cd admin-web
npm run dev         # dev server on :5173
npm run build       # tsc + vite build
npm run lint
```

### Service endpoints
- Admin Web: `http://localhost:5173/admin/` (local dev) or `http://localhost:3000/admin/` (K8s)
- Admin API + Swagger UI: `http://localhost:9000` (`/docs` for OpenAPI)
- Gateway proxy: `http://localhost:8080`
- Gateway metrics (Prometheus): `http://localhost:9090`

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

Single-page app, no router. Navigation state lives in Zustand (`stores/admin-store.ts`): `sidebarResource` ("keys" | "providers" | "models" | "policies") and `selectedSidebarItemId` drive which page renders.

All API calls go through `lib/api.ts`. TanStack Query is used for server state: there is **one primary query** (`getAdminData`, key `["admin-data"]`) that fetches everything; mutations invalidate this query on success. Hooks are in `hooks/use-admin-data.ts`.

UI is shadcn/ui components under `components/ui/`, with layout pieces in `components/layout/`. Feature pages live in `features/admin/`.

### Database schema

PostgreSQL tables across three migration files (`deploy/sql/`):

```
epichust_models          — business-facing models (e.g. "epichust-chat")
providers                — upstream API providers (key stored as ciphertext)
provider_models          — models discovered/registered per provider
mapping_policies         — routing policy: strategy, enabled, model binding
mapping_policy_routes    — weighted/priority routing rows per policy
rate_limit_rules         — per-policy rate limits (multiple types allowed)
api_key_mapping_policies — links API keys to mapping policies
epichust_api_keys        — client API keys (stored as SHA-256 hash + prefix)
audit_logs               — one row per proxied request
```

IDs are prefixed strings generated in `repositories.rs` (e.g., `"em-<uuid>"` for epichust models).

## Key design constraints

- The gateway currently does **not** read from PostgreSQL or Redis at request time — auth keys are baked into env vars at startup. The planned next step is to load per-key model quotas and provider key mappings from Redis.
- `OPENAI_KEY_REF` is a label logged in audit events to identify which upstream key was used, without logging the key itself.
- Provider keys are stored as `BYTEA` (`provider_key_ciphertext`) — encryption/decryption logic is not yet implemented; the column name is forward-looking.
