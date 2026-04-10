#!/bin/bash
# ─────────────────────────────────────────────────────────────
# EIS Dashboard v2 — Deploy script for Linux dev server
# Run as: bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -e

DEPLOY_DIR="/opt/ckd/eis-dashboard-v2"
REPO_URL="https://github.com/mashudizaini/eis-dashboard-v2.git"

echo "=== EIS Dashboard Deploy ==="

# 1. Create directory if needed
sudo mkdir -p /opt/ckd
sudo chown user:user /opt/ckd

# 2. Clone or pull
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo ">> Pulling latest..."
  cd "$DEPLOY_DIR"
  git pull origin master
else
  echo ">> Cloning repo..."
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# 3. Create .env if not exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo ">> Creating .env from .env.server template..."
  cp "$DEPLOY_DIR/.env.server" "$DEPLOY_DIR/.env"
  echo ""
  echo "!! PERHATIAN: Edit .env dan isi ORACLE_PASSWORD + SECRET_KEY + KEYCLOAK_CLIENT_SECRET"
  echo "   nano $DEPLOY_DIR/.env"
  echo ""
fi

# 4. Docker compose up
echo ">> Starting containers..."
cd "$DEPLOY_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

# 5. Wait for postgres to be healthy
echo ">> Waiting for PostgreSQL..."
sleep 10
docker compose ps

echo ""
echo "=== Deploy selesai ==="
echo "Frontend : http://172.21.2.209:8090"
echo "API      : http://172.21.2.209:8090/api/v1/eis"
echo "API Docs : http://172.21.2.209:8090/docs"
echo ""
echo "Untuk lihat log: docker compose logs -f --tail=50"
