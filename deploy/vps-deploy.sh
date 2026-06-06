#!/bin/bash
# Deploy to VPS via SSH + Docker Compose
# Usage: ./deploy/vps-deploy.sh <vps-host>

set -e
HOST=${1:?Usage: $0 <user@host>}
COMPOSE_FILE="deploy/docker-compose-vps.yml"

echo "==> Pulling latest images on $HOST..."
ssh "$HOST" "docker compose -f - pull" < "$COMPOSE_FILE"

echo "==> Restarting services..."
ssh "$HOST" "docker compose -f - up -d --remove-orphans" < "$COMPOSE_FILE"

echo "==> Done. Services:"
ssh "$HOST" "docker compose -f - ps" < "$COMPOSE_FILE"
