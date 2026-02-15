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

echo "Building and deploying schema + queries to local dev instance..."
helix push dev

echo ""
echo "=== Done ==="
echo "HelixDB should now be running on http://localhost:6969"
echo "Schema and queries have been loaded."
echo ""
echo "Run 'pnpm smoke-test' to verify connectivity."
