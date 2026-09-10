# Sherah MCP

Sherah's public MCP server. It tells AI agents what [Sherah](https://mysherah.com)
does and lets them sign a person up. No authentication, anywhere.

Endpoint: `https://mcp.mysherah.com/mcp` (Streamable HTTP)

```bash
claude mcp add --transport http sherah https://mcp.mysherah.com/mcp
```

Listed on the MCP Registry as
[`com.mysherah/sherah`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.mysherah).

## Tools

### `get_available_task_types`

No arguments. Returns the categories of tasks Sherah helps with (home,
admin, kids, pets, meals, travel, shopping, finances, and more) with example
tasks under each. Call this to check whether a request is something Sherah
does before using `request_sign_up_with_task`. Same JSON as the resource
below, for clients (e.g. ChatGPT) that can call tools but can't read resources.

### `request_sign_up`

Registers interest without a task attached. Sherah emails the person a
confirmation link and nothing happens until they click it.

| Field | Type |
|---|---|
| `email` | valid email |
| `city` | string, max 100 chars |
| `state` | two-letter US state code |

### `request_sign_up_with_task`

Submits a task request with contact and location.

| Field | Type |
|---|---|
| `task` | string, max 2000 chars |
| `neededBy` | calendar date `YYYY-MM-DD`, no time, no timezone |
| `email` | valid email |
| `city` | string, max 100 chars |
| `state` | two-letter US state code |

Both sign-up tools forward to Sherah's Xano intake. Free-text fields are
collapsed to a single line before submission.

## Resources

### `sherah://tasks-we-help-with`

`application/json`. The task categories from
https://www.mysherah.com/tasks-we-help-with.

## Discovery

- `GET /` — JSON summary: name, description, contact, endpoint
- `GET /.well-known/mcp-server-card` — server card (draft SEP-2127), also at `/.well-known/mcp.json`
- `GET /.well-known/ai-catalog.json` — ARD catalog
- `GET /robots.txt`

## Development

```bash
cp .env.example .env
npm install
npm run dev       # tsx watch on src/server.ts
npm run smoke     # or: npm run smoke -- https://mcp.mysherah.com
```

All env vars are read in `src/config.ts`. Sign-up tools reject submissions
until `SHERAH_MCP_XANO_AUTH` is set.

```
src/
  server.ts      Express app, transport sessions, routes
  config.ts      env-var reads
  discovery.ts   server card + root summary
  tools.ts       the three tools
  resources.ts   the tasks-we-help-with resource
  data/          task categories, US state codes
scripts/smoke.mjs   end-to-end check, zero credentials
```

See `SECURITY.md` for the threat model.

## License

MIT
