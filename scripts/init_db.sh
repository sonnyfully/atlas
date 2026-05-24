#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Atlas DB Init ==="

# Check if helix CLI is installed
if ! command -v helix &> /dev/null; then
    echo "ERROR: 'helix' CLI not found."
    echo "Install HelixDB from: https://github.com/HelixDB/helix-db"
    echo "  curl -sSL https://install.helix-db.com | bash"
    exit 1
fi

echo "Found helix CLI: $(which helix)"

# Navigate to project root (helix.toml lives here)
cd "$PROJECT_ROOT"

DEV_CONTAINER_NAME="helix-atlas-dev"
DEV_APP_CONTAINER_NAME="helix-atlas-dev_app"
DEV_COMPOSE_FILE="$PROJECT_ROOT/.helix/dev/docker-compose.yml"
DEV_VOLUME_DIR="$PROJECT_ROOT/.helix/.volumes/dev"

if [[ "${ATLAS_PRESERVE_DEV_DB:-0}" != "1" ]]; then
    echo "Resetting local dev DB to an empty state..."
    if [[ -f "$DEV_COMPOSE_FILE" ]]; then
        docker compose -f "$DEV_COMPOSE_FILE" down --volumes --remove-orphans >/dev/null 2>&1 || true
    fi
    docker rm -f "$DEV_CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm -f "$DEV_APP_CONTAINER_NAME" >/dev/null 2>&1 || true
    rm -rf "$DEV_VOLUME_DIR"
else
    echo "Preserving existing local dev DB state because ATLAS_PRESERVE_DEV_DB=1"
fi

echo "Building and deploying schema + queries to local dev instance..."
helix push dev

echo ""
echo "=== Done ==="
echo "HelixDB should now be running on http://localhost:6969"
echo "Schema and queries have been loaded."
echo ""
echo "Run 'pnpm smoke-test' to verify connectivity."
