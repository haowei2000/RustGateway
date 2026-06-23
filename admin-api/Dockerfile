# ── Builder ────────────────────────────────────────────────────────
FROM rust:1.95-slim AS builder

WORKDIR /workspace

# System deps (cached layer)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl libssl-dev pkg-config

# Dependencies first (cached unless Cargo.toml/Cargo.lock change)
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY admin-api ./admin-api
# gateway is a workspace member referenced by the root manifest, so cargo
# needs its manifest present even when building only -p axum-admin-api.
COPY gateway ./gateway
COPY deploy/sql ./deploy/sql

# Build with cargo cache mounts
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/workspace/target \
    cargo build --release -p axum-admin-api && \
    cp /workspace/target/release/axum-admin-api /usr/local/bin/axum-admin-api

# ── Runtime ────────────────────────────────────────────────────────
FROM debian:trixie-slim

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates

COPY --from=builder /usr/local/bin/axum-admin-api /usr/local/bin/axum-admin-api

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/axum-admin-api"]
