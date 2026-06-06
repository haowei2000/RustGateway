FROM rust:1.95-slim AS builder

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY gateway ./gateway
COPY admin-api ./admin-api
COPY deploy/sql ./deploy/sql

RUN cargo build --release -p axum-admin-api

FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/target/release/axum-admin-api /usr/local/bin/axum-admin-api

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/axum-admin-api"]
