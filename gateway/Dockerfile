# ── Builder ────────────────────────────────────────────────────────
FROM rust:1.95-slim AS builder

WORKDIR /workspace

# System deps (cached layer)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        build-essential ca-certificates cmake golang libssl-dev pkg-config

# Dependencies first (cached unless Cargo.toml/Cargo.lock change)
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY gateway ./gateway
# admin-api is a workspace member referenced by the root manifest, so cargo
# needs its manifest present even when building only -p pingora-gateway.
COPY admin-api ./admin-api
COPY deploy/sql ./deploy/sql

# Build with sccache for faster rebuilds
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/workspace/target \
    cargo build --release -p pingora-gateway && \
    cp /workspace/target/release/pingora-gateway /usr/local/bin/pingora-gateway

# ── Runtime ────────────────────────────────────────────────────────
FROM debian:trixie-slim

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl libssl3

COPY --from=builder /usr/local/bin/pingora-gateway /usr/local/bin/pingora-gateway

EXPOSE 8080 9090
ENTRYPOINT ["/usr/local/bin/pingora-gateway"]
