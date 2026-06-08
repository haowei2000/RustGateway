#!/bin/bash
# One-time VPS setup. Run on the VPS:
#   curl -fsSL https://raw.githubusercontent.com/haowei2000/RustGateway/main/deploy/vps-setup.sh | bash

set -e

echo "==> Installing Docker..."
command -v docker &>/dev/null || curl -fsSL https://get.docker.com | sh

echo "==> Creating project directory..."
mkdir -p /opt/llm-gateway/backups

echo "==> Cloning repo (deploy files only)..."
cd /opt/llm-gateway
if [ -d .git ]; then
  git pull
else
  git clone --depth 1 https://github.com/haowei2000/RustGateway.git .
fi

echo "==> Setup done!"
echo ""
echo "Next steps:"
echo "  1. Edit Caddyfile: cd /opt/llm-gateway/deploy && vi Caddyfile"
echo "  2. Point DNS to this server"
echo "  3. Start: docker compose -f deploy/docker-compose-vps.yml up -d"
echo ""
echo "GitHub Actions auto-deploy needs these secrets:"
echo "  VPS_HOST      = $(curl -s ifconfig.me)"
echo "  VPS_USER      = root"
echo "  VPS_SSH_KEY   = (cat ~/.ssh/id_ed25519)"
