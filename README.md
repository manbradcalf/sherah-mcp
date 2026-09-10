# Sherah MCP

Sherah's public, no-auth MCP server — a self-describing "billboard" endpoint
meant to be discovered by AI agents wandering the open MCP ecosystem. Its job
is to be easy to find, easy to size up in one request, and to leave a good
impression (and a way to make contact) on behalf of Sherah. This is a lead-gen
surface, not a private tool server: **there is intentionally no authentication
anywhere.**

```
agent ──HTTPS──▶ nginx ──▶ Express (host check) ──▶ MCP Streamable HTTP (/mcp)
                                   ├─▶ GET /                         JSON summary
                                   └─▶ GET /.well-known/mcp-server-card   discovery card
```

## Features

- **Public by design** — zero credentials on every endpoint; the smoke test fails if anything returns 401/403
- **Discovery card** at `/.well-known/mcp-server-card` (draft SEP-2127), plus a `/.well-known/mcp.json` alias
- **Root JSON summary** at `GET /` — name, description, contact, endpoint, in one request
- **Config-driven branding** — every name, description, and contact field comes from env vars, read in one file
- Fleshed-out `initialize` response: `serverInfo` (name, title, version, description, websiteUrl, icons) + `instructions`
- Wildcard CORS so browser-based agents can connect
- Sessioned Streamable HTTP transport (`@modelcontextprotocol/sdk`), host-header validation against DNS rebinding
- Two sign-up tools — `request_sign_up` (email, city, state) and `request_sign_up_with_task` — using the `registerTool` + Zod pattern
- `get_available_task_types` tool — same JSON as the `tasks-we-help-with` resource, for clients (e.g. ChatGPT) that can call tools but not read resources
- `npm run smoke` — end-to-end no-auth + discovery verification

## Requirements

Node.js 20+ (the smoke test uses global `fetch`).

## Quick start

```bash
cp .env.example .env    # then edit — see Configuration
npm install
npm run dev             # tsx watch on src/server.ts
npm run smoke           # verify discovery + credential-free handshake
```

For the MCP Inspector against a local server: `npm run inspect-local`.

## Configuration

Everything an agent (or human) sees about this server comes from these env
vars, read in exactly one file: `src/config.ts`. In production, `.env` is
loaded via `EnvironmentFile=` in the systemd unit; locally it's
`set -a; source .env; set +a`.

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_HOST` | `mcp.mysherah.com` | Public hostname — Host-header allowlist, derived URLs, derived card name |
| `PUBLIC_BASE_URL` | `https://$PUBLIC_HOST` (`http://…:$PORT` if localhost) | Override the derived base URL |
| `PORT` | `8001` (production is set to `3000` — see the nginx `proxy_pass` target) | Listen port |
| `BIND_ADDR` | `127.0.0.1` | Listen address — keep on localhost behind nginx |
| `EXTRA_HOSTS` | (empty) | Comma-separated extra allowed `Host` hostnames |
| `MCP_NAME` | `sherah` | Machine name (`serverInfo.name`, card name slug) |
| `MCP_TITLE` | `Sherah` | Human display name |
| `MCP_DESCRIPTION` | `Online personal assistant for busy parents: home, kids, meals, admin and more` | One-line description, shown everywhere |
| `MCP_OPERATOR` | `Sherah` | Who runs this server (instructions, root JSON, card `_meta`) |
| `MCP_CONTACT_EMAIL` | `ben@medcalfsoftwaresolutions.com` | Contact for humans — surfaces in instructions, root JSON `contact`, card `_meta` |
| `MCP_WEBSITE_URL` | (empty, omitted) | "Learn more" link (`serverInfo.websiteUrl`, card, root JSON) |
| `MCP_REPOSITORY_URL` / `MCP_REPOSITORY_SOURCE` | (empty) / `github` | Card `repository` block |
| `MCP_ICON_URL` / `MCP_ICON_MIME` | (empty) / `image/png` | Icon for `serverInfo.icons` and the card |
| `MCP_CARD_NAME` | reverse-DNS of `PUBLIC_HOST`'s apex domain + `/$MCP_NAME` (`com.mysherah/sherah`) | Override the card's registry-style name. Title and description must stay under 100 chars for the MCP Registry |
| `MCP_INSTRUCTIONS` | composed from operator/contact/card URL | Override the `initialize` `instructions` text |

The server **version** is single-sourced from `package.json` — bump it there.

To change branding (name, description, contact, etc.), edit `.env` — no code
changes needed. Then verify with zero credentials:

```bash
# The discovery card — no credentials, CORS *
curl -s https://mcp.mysherah.com/.well-known/mcp-server-card | jq

# The MCP handshake — still no credentials. Note the Mcp-Session-Id header:
curl -si https://mcp.mysherah.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.0"}}}'

# tools/list, using the session id from the previous response's headers:
curl -s https://mcp.mysherah.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: <id from above>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

## Discovery: what's standard and what isn't

As of mid-2026 there is **no finalized well-known discovery standard for MCP
servers**. What this server serves, and why:

- **`initialize` response** — the only *standardized* discovery surface
  (MCP spec 2025-11-25). `serverInfo` carries `name`, `title`, `version`,
  `description`, `websiteUrl`, and `icons`; `instructions` carries the
  operator/contact blurb. Every compliant client sees this.
- **`/.well-known/mcp-server-card`** — implements **SEP-2127 "MCP Server
  Cards"**, which is a **DRAFT**: the path and schema may change before it
  merges. The document is a subset of the MCP Registry's `server.json` schema
  (`$schema` pinned to `2025-12-11`). Served with `Access-Control-Allow-Origin: *`
  and no auth, per the draft.
- **`/.well-known/mcp.json`** — a **non-standard convenience alias** for the
  same document; agents in the wild are known to probe this path.
- Deliberately **not** served: OAuth discovery documents
  (`oauth-protected-resource`, `oauth-authorization-server`) — those are for
  authenticated servers (RFC 9728), and this server has no auth; and
  `ai-plugin.json` — a defunct OpenAI Plugins artifact with no standing in MCP.

## Smoke test

```bash
npm run smoke                          # against http://localhost:$PORT
npm run smoke -- https://mcp.mysherah.com
```

Asserts, with zero credentials sent: the card and its alias return 200 with
config-driven content; `GET /` works; CORS preflight works; `initialize` →
`notifications/initialized` → `tools/list` → `DELETE` all succeed; and **no
response in the entire run was 401/403**. Exits non-zero on any failure —
usable in CI or post-deploy.

## Connecting a client

No headers, no tokens, anywhere:

```bash
# Claude Code
claude mcp add --transport http sherah https://mcp.mysherah.com/mcp

# MCP Inspector
npx @modelcontextprotocol/inspector    # transport: Streamable HTTP, URL as above
```

claude.ai web/mobile custom connectors can use the URL directly — no-auth
remote servers connect without an OAuth flow.

## Production deployment

1. Node 20+ on the box; clone the repo; `npm install && npm run build`.
2. Create `.env` from `.env.example` (see Configuration).
3. Run under a systemd unit with `EnvironmentFile=/path/to/.env` pointed at
   `node build/server.js`. (`ecosystem.config.cjs` is a leftover pm2 config
   from before this was set up under systemd — not currently wired to
   anything in production.)
4. nginx in front: copy `deploy/nginx.conf.example`. Note it proxies
   **`location /`** — not just `/mcp` — so the discovery endpoints work, and
   includes a `limit_req` rate limit since the endpoint is anonymous.
5. Verify end to end: `npm run smoke -- https://mcp.mysherah.com`.

## MCP Registry

This server is published to the official MCP Registry as
[`com.mysherah/sherah`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.mysherah),
authenticated by an Ed25519 DNS TXT record at the apex of `mysherah.com`
(`v=MCPv1; k=ed25519; p=...`). The private key authorizes every
`com.mysherah/*` name and is kept out of the repo.

Registry entries are immutable per version. To republish after a change:

1. Bump `version` in `package.json` (the registry `server.json` version must be
   new and should match).
2. Sign a fresh timestamp with the key, exchange it at `/v0.1/auth/dns` for a
   token, and `POST` the `server.json` to `/v0.1/publish`. The full script is
   `deploy/registry-publish.sh` (run with `VERSION=x.y.z`). It signs and
   exchanges in one go; the timestamp is only valid for 15 seconds.
3. `title` and `description` are capped at 100 characters. `src/config.ts`
   warns at startup if the defaults exceed that.

If the key is ever rotated, remove the old TXT record or verification fails.

## Adding tools

Tools live in `src/tools.ts`:

```ts
server.registerTool(
  "echo",
  {
    title: "echo",
    description: "Repeats the string back to the caller",
    inputSchema: { input: z.string() },   // Zod raw shape
  },
  async ({ input }) => ({ content: [{ type: "text", text: input }] }),
);
```

## Security notes

Everything on this server is **public by design** — treat it accordingly:

- Never register tools that expose secrets, private data, or state-changing
  side effects a stranger shouldn't be able to trigger — this server has no
  auth to gate them.
- Host-header validation is kept (DNS-rebinding mitigation); add hostnames via
  `EXTRA_HOSTS` if it's ever served under more than one name.
- **There is no rate limiting in the app** — every route (including
  state-changing tools) is open to anonymous callers with no throttling in
  Express. Abuse protection is handled entirely at nginx via `limit_req` (see
  `deploy/nginx.conf.example` and Production deployment below). If this is
  ever deployed without nginx or another rate-limiting reverse proxy in
  front, it has **no** protection against being hammered.
- Sessions live in an in-memory `Map` with no idle eviction — fine for
  lightweight billboard tools; add a sweep if the tool set gets heavier.

See `SECURITY.md` for the fuller threat-model writeup.

## Project layout

```
src/
  server.ts      Express app, transport sessions, routes
  config.ts      ALL env-var reads — the single branding/config surface
  discovery.ts   server card + root summary builders
  cors.ts        wildcard CORS middleware
  tools.ts       sign-up intake tools (Xano-backed)
scripts/
  smoke.mjs      no-auth + discovery verification
deploy/
  nginx.conf.example
ecosystem.config.cjs   pm2 process file (unused in production — see Production deployment)
.env.example
```

## License

MIT
