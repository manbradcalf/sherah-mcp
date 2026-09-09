#!/usr/bin/env bash
# Publish (or republish) sherah-mcp to the official MCP Registry via DNS auth.
#
# Prereqs:
#   - sherah-registry-key.pem (Ed25519 private key) in the cwd. Its public half
#     is in a TXT record at the apex of mysherah.com: "v=MCPv1; k=ed25519; p=..."
#   - VERSION must be new: registry versions are immutable once published.
#
# Usage: VERSION=0.1.1 ./deploy/registry-publish.sh
set -euo pipefail

VERSION="${VERSION:?set VERSION to the new server.json version, e.g. 0.1.1}"
KEY="${KEY:-sherah-registry-key.pem}"
REGISTRY="https://registry.modelcontextprotocol.io/v0.1"

# Sign a fresh RFC3339 timestamp. The registry accepts it only within +/-15s,
# so signing and exchanging must happen in one go.
read -r TIMESTAMP SIGNED_HEX < <(node -e '
const { createPrivateKey, sign } = require("crypto");
const fs = require("fs");
const key = createPrivateKey(fs.readFileSync(process.argv[1]));
const ts = new Date().toISOString();
const sig = sign(null, Buffer.from(ts), key);
process.stdout.write(ts + " " + sig.toString("hex"));
' "$KEY")

REG_TOKEN=$(curl -sS -X POST "$REGISTRY/auth/dns" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"mysherah.com\",\"timestamp\":\"$TIMESTAMP\",\"signed_timestamp\":\"$SIGNED_HEX\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["registry_token"])')

SERVER_JSON=$(mktemp)
cat > "$SERVER_JSON" <<JSON
{
  "\$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.mysherah/sherah",
  "title": "Sherah",
  "description": "Online personal assistant for busy parents: home, kids, meals, admin and more",
  "version": "$VERSION",
  "websiteUrl": "https://mysherah.com",
  "repository": { "url": "https://github.com/manbradcalf/sherah-mcp", "source": "github" },
  "remotes": [
    { "type": "streamable-http", "url": "https://mcp.mysherah.com/mcp" }
  ]
}
JSON

curl -sS -X POST "$REGISTRY/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REG_TOKEN" \
  -d @"$SERVER_JSON"
echo
echo "Listing: $REGISTRY/servers?search=com.mysherah"
