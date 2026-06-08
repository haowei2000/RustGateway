#!/bin/bash
# Restore PostgreSQL backup
# Usage: ./deploy/restore-backup.sh <backup-file>
# Example: ./deploy/restore-backup.sh backups/llm_gateway_20260606_0300.dump

set -e
BACKUP=${1:?Usage: $0 <backup-file>}
CONTAINER=$(docker compose -f deploy/docker-compose-vps.yml ps -q postgres)

echo "==> Restoring from $BACKUP..."
docker exec -i "$CONTAINER" pg_restore -U llm -d llm_gateway --clean --if-exists < "$BACKUP"
echo "==> Done."
