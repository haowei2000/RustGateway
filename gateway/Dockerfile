FROM rust:1.95-slim AS builder

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ca-certificates cmake pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY admin-api ./admin-api
COPY gateway ./gateway
COPY deploy/sql ./deploy/sql

RUN cargo build --release -p pingora-gateway

FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/target/release/pingora-gateway /usr/local/bin/pingora-gateway

EXPOSE 8080 9090
ENTRYPOINT ["/usr/local/bin/pingora-gateway"]
