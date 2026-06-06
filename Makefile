.PHONY: dev dev-debug dev-infra dev-api dev-web stop clean helm-up helm-down build check lint fmt

# ── Local Development ──────────────────────────────────────────────

# Start everything locally (Postgres + Redis via Docker, API + Web native)
dev: dev-infra
	@echo "==> Starting admin-api (RUST_LOG=info)..."
	@RUST_LOG=info cargo run -p axum-admin-api &
	@sleep 2
	@echo "==> Starting admin-web (Vite dev server on :5173)..."
	@cd admin-web && npm run dev &
	@echo ""
	@echo "  Admin API:    http://localhost:9000"
	@echo "  Swagger UI:   http://localhost:9000/docs"
	@echo "  Admin Web:    http://localhost:5173/admin/"
	@echo ""
	@echo "  Press Ctrl+C or run 'make stop' to shut down."
	@trap 'make stop' EXIT; wait

# Start everything with DEBUG logging + backtrace
dev-debug: dev-infra
	@echo "==> Starting admin-api (RUST_LOG=debug + backtrace)..."
	@RUST_LOG=debug,tower_http=debug RUST_BACKTRACE=1 cargo run -p axum-admin-api &
	@sleep 2
	@echo "==> Starting admin-web (Vite dev server on :5173)..."
	@cd admin-web && npm run dev &
	@echo ""
	@echo "  Admin API:    http://localhost:9000  (RUST_LOG=debug, RUST_BACKTRACE=1)"
	@echo "  Swagger UI:   http://localhost:9000/docs"
	@echo "  Admin Web:    http://localhost:5173/admin/"
	@echo ""
	@trap 'make stop' EXIT; wait

# Start only Postgres + Redis in Docker (for running API/Web manually)
dev-infra:
	@echo "==> Starting Postgres on :5432..."
	@docker rm -f llm-postgres-dev 2>/dev/null || true
	@docker run -d --name llm-postgres-dev \
		-e POSTGRES_USER=llm -e POSTGRES_PASSWORD=llm -e POSTGRES_DB=llm_gateway \
		-p 5432:5432 postgres:16-alpine
	@echo "==> Starting Redis on :6379..."
	@docker rm -f llm-redis-dev 2>/dev/null || true
	@docker run -d --name llm-redis-dev -p 6379:6379 redis:7-alpine
	@echo "==> Waiting for Postgres to be ready..."
	@until docker exec llm-postgres-dev pg_isready -U llm -d llm_gateway 2>/dev/null; do sleep 1; done
	@echo "==> Postgres ready. Exporting DATABASE_URL..."
	$(eval export DATABASE_URL=postgres://llm:llm@localhost:5432/llm_gateway)
	$(eval export REDIS_URL=redis://localhost:6379)
	$(eval export DATABASE_AUTO_MIGRATE=true)
	$(eval export JWT_SECRET=dev-secret)
	@echo "    DATABASE_URL=$(DATABASE_URL)"
	@echo "    REDIS_URL=$(REDIS_URL)"

# Run only the admin API (assumes infra is already running)
dev-api:
	@echo "==> Starting admin-api..."
	DATABASE_URL=postgres://llm:llm@localhost:5432/llm_gateway \
	DATABASE_AUTO_MIGRATE=true \
	REDIS_URL=redis://localhost:6379 \
	JWT_SECRET=dev-secret \
	RUST_LOG=info \
	cargo run -p axum-admin-api

# Run only the admin API in DEBUG mode
dev-api-debug:
	@echo "==> Starting admin-api (DEBUG)..."
	DATABASE_URL=postgres://llm:llm@localhost:5432/llm_gateway \
	DATABASE_AUTO_MIGRATE=true \
	REDIS_URL=redis://localhost:6379 \
	JWT_SECRET=dev-secret \
	RUST_LOG=debug,tower_http=debug,sqlx=debug \
	RUST_BACKTRACE=1 \
	cargo run -p axum-admin-api

# Run only the admin web (assumes infra is already running)
dev-web:
	@echo "==> Starting admin-web (Vite :5173)..."
	cd admin-web && npm run dev

# Stop all local dev services
stop:
	@echo "==> Killing cargo / node processes..."
	@pkill -f "axum-admin-api" 2>/dev/null || true
	@pkill -f "pingora-gateway" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "==> Stopping dev containers..."
	@docker rm -f llm-postgres-dev llm-redis-dev 2>/dev/null || true
	@echo "==> Stopped."

# ── Build ──────────────────────────────────────────────────────────

build:
	cargo build --workspace
	cd admin-web && npm run build

check:
	cargo check --workspace

lint:
	cargo clippy --workspace
	cd admin-web && npm run lint

fmt:
	cargo fmt --all

# ── Helm / K8s Deployment ──────────────────────────────────────────

KIND_CLUSTER := llm-gateway

# Bootstrap: create kind cluster, build images, load, install
helm-up:
	@kind get clusters 2>/dev/null | grep -q $(KIND_CLUSTER) || kind create cluster --name $(KIND_CLUSTER)
	@echo "==> Building images..."
	docker build -f admin-web/Dockerfile -t llm-gateway/admin-web:local .
	docker build -f admin-api/Dockerfile -t llm-gateway/admin-api:local .
	docker build -f gateway/Dockerfile -t llm-gateway/pingora-gateway:local .
	@echo "==> Loading images into kind..."
	kind load docker-image llm-gateway/admin-web:local --name $(KIND_CLUSTER)
	kind load docker-image llm-gateway/admin-api:local --name $(KIND_CLUSTER)
	kind load docker-image llm-gateway/pingora-gateway:local --name $(KIND_CLUSTER)
	@echo "==> Installing Helm chart..."
	helm upgrade --install llm-gateway deploy/helm/llm-gateway -f deploy/helm/llm-gateway/values-local.yaml
	@echo ""
	@echo "==> Done. Port forward with:"
	@echo "    kubectl port-forward svc/admin-api 9000:9000 &"
	@echo "    kubectl port-forward svc/admin-web 3000:80 &"

# Tear down Helm release and kind cluster
helm-down:
	helm uninstall llm-gateway 2>/dev/null || true
	kind delete cluster --name $(KIND_CLUSTER)

# ── Clean ───────────────────────────────────────────────────────────

clean:
	cargo clean
	rm -rf admin-web/dist admin-web/node_modules
