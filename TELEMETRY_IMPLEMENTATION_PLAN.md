# Telemetry Implementation Plan

Goal: see each MCP request as it arrives (JSON-RPC method, tool name, client name) and query history later.

Every MCP call hits the same `POST /mcp`, so auto-instrumentation alone shows identical requests. Whichever backend we pick, one Express middleware on `/mcp` has to read the JSON-RPC body and record `method`, `params.name` (tool) and `params.clientInfo.name` (client). Never record `params.arguments`: that is where sign-up names and emails are.

The client name only arrives on `initialize`. To tag later requests with it, store it per session ID.

## Constraints

- Sherah stays where it is: a Linux VPS, a systemd service running node, nginx in front. Nothing moves to a cloud provider. The backend is only a destination for data.
- The start command must not change (no `node --import ...` / `--experimental-loader` flags).
- Traffic is tiny, so any free tier covers volume.

## The ESM flag problem (applies to every OpenTelemetry option)

The app is compiled to ESM. OpenTelemetry's docs: "If your application is written in JavaScript as ESM, or compiled to ESM from TypeScript, then a loader hook is required to properly patch instrumentation." That hook is a node flag, so **automatic** instrumentation is out.

What still works without flags:

- **Manual spans.** Start the OTel SDK in `telemetry.ts`, import it first in `server.ts`, and create one span per request in the `/mcp` middleware. The loader hook exists to patch libraries; manual spans patch nothing. No doc says this outright, so it is an inference. *Test before committing.*
- **Plain HTTP log shipping.** No OTel at all (see AWS).

`NODE_OPTIONS` loophole: OTel's docs say the flag "is often done as a startup command and/or in the `NODE_OPTIONS` environment variable". If the systemd unit loads `.env` via `EnvironmentFile=`, putting `NODE_OPTIONS` in `.env` would enable auto-instrumentation without editing the start command. Whether that counts as changing the command is Ben's call.

## Comparison

| | Azure App Insights | Grafana Cloud | AWS CloudWatch Logs | Honeycomb |
|---|---|---|---|---|
| Free allowance | 5 GB/month **per billing account** (shared with other Azure projects) | 50 GB traces + 50 GB logs/month | 5 GB/month (ingest + storage + Insights scans, one pool) | 20M events/month (1 span = 1 event) |
| Retention | 90 days | 14 days | Forever unless you set it | 60 days |
| Over the limit | Billed (~$2.30–2.76/GB); daily cap stops it | Dropped, never billed | Billed ($0.50/GB); no hard cap, budgets only alert | Throttled to 1 in 10 events after a grace period, not billed |
| Card needed | Yes (you have one) | No | Yes | Unverified |
| Watch live | Live Metrics (free); unverified with manual spans | Explore "Live" tail; unverified for Loki on Cloud | Live Tail: 1,800 min/month free, then $0.01/min | No live tail found |
| Query history | KQL | TraceQL / LogQL | Logs Insights | Query Builder, BubbleUp |
| Packages | `@azure/monitor-opentelemetry`, `@opentelemetry/api` | OTel SDK + OTLP exporter | **None** (built-in `fetch`) | OTel SDK + OTLP exporter |
| Auth | Connection string | Basic auth header (instance ID + token) | Logs API key (bearer), expires | Ingest key header |
| Already familiar | Yes | No | No | No |

## Option: Azure Application Insights (chosen, implemented 2026-09-25)

Implemented in `src/telemetry.ts`. Tested locally against a fake HTTPS ingestion endpoint (not real Azure yet). What the test showed:

- **No start flag needed.** The distro's HTTP instrumentation patches `node:http` even in ESM, so each HTTP call becomes one request span. The `/mcp` middleware renames and tags that span instead of creating a second one.
- **Default sampler drops the first spans after startup.** Fixed with `tracesPerSecond: 0, samplingRatio: 1`.
- **Off Azure, the exporter probes the Azure VM metadata service** (169.254.169.254), logging a failed dependency and exception on each start. Filtered with `ignoreOutgoingRequestHook`. Passing custom `http` options drops the default `enabled: true`, so it has to be set again.
- **`enableLiveMetrics` defaults to `false`** in the installed version (1.20.0), contrary to the README. Set to `true`.
- **Role name** defaults to `unknown_service:node`; set via `service.name` resource.
- **OTLP support toggle** at resource creation: leave **Off**. It is for OTLP ingestion via a collector with Entra auth; this distro uses the connection string.
- Live Metrics could not be verified locally (needs real Azure).

1. Free 5 GB/month is per billing account, shared with your other App Insights projects.
2. Daily cap must be set twice: "independently for both Application Insights and the underlying Log Analytics workspace."
3. Microsoft's ESM setup uses `node --import @azure/monitor-opentelemetry/loader` (Node 18.19+). Skip it and use manual spans.
4. Live Metrics is on by default (`enableLiveMetrics: true`) and has no data charge. Unverified: whether manual spans appear in Live Metrics as requests (probably need `SpanKind.SERVER`).
5. Default sampling: 5 traces/sec.

Setup:
1. Create a resource group, e.g. `sherah-rg`, so Sherah's costs show separately.
2. **Create a resource → Monitoring & Diagnostics → Application Insights** in that group. A Log Analytics workspace is created automatically if none is picked.
3. Set the daily cap on both the App Insights resource and its workspace.
4. Copy the **Connection String** from **Overview** into the server's `.env` as `APPLICATIONINSIGHTS_CONNECTION_STRING`.

Code: call `useAzureMonitor()` in `telemetry.ts` (imported first), then start a span per request in the `/mcp` middleware.

## Option: Grafana Cloud

1. Free tier: 50 GB logs, 50 GB traces, 10k metric series, 14-day retention, 3 users, no card. A Grafana staff answer: "Free plans are never billed for any usage, excess or otherwise."
2. Setup: Cloud Portal → launch stack → **Configure** on the OpenTelemetry tile → generate token. It gives `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `https://otlp-gateway-prod-us-east-0.grafana.net/otlp`), `OTEL_EXPORTER_OTLP_HEADERS`.
3. Header is `Authorization=Basic base64(instanceID:token)`. Source is a community forum answer, not official docs. Encode with `echo -n ... | base64 -w 0`; a trailing newline breaks it.
4. No Grafana-specific Node distro. Use upstream `@opentelemetry/sdk-node`, which defaults to OTLP http/protobuf driven by the env vars.
5. Alternative: Grafana Alloy (installs as a systemd service on Ubuntu) tails a JSON log file and ships to Loki. Unverified: Loki URL/credential config.
6. Live view: Explore has a "Live" tail button. Unverified which data sources support it on Cloud.

## Option: AWS CloudWatch Logs (no OTel)

AWS's OTel routes don't fit: ESM auto-instrumentation needs flags (AWS calls its ESM support "limited"), and the X-Ray OTLP endpoint requires SigV4 signing, which in the docs means running a collector on the box.

The route that fits: the middleware POSTs one JSON line per request to CloudWatch's **Structured JSON HTTP endpoint** with built-in `fetch` and a Logs API key. No packages, no flags, no agent.

Setup:
1. CloudWatch console → Settings → Logs → **Generate API key** (expiry 1–365 days). It creates an IAM user with `CloudWatchLogsAPIKeyAccess`. Tighter custom policy: `logs:CallWithBearerToken` + `logs:PutLogEvents`. The secret is shown once.
2. Create the log group and stream, enable bearer auth:
   ```
   aws logs create-log-group --log-group-name /sherah-mcp --region us-east-1
   aws logs create-log-stream --log-group-name /sherah-mcp --log-stream-name prod --region us-east-1
   aws logs put-bearer-token-authentication --log-group-identifier /sherah-mcp --bearer-token-authentication-enabled --region us-east-1
   ```
3. **Set a retention period** on the log group; the default is forever.
4. Set an AWS Budget alert. AWS cannot hard-cap spend.

Code shape:
```ts
fetch(`https://logs.${REGION}.amazonaws.com/ingest/json?logGroup=/sherah-mcp&logStream=prod`, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ timestamp: Date.now(), method, tool, client, status, ms }),
}).catch(() => {});
```

Gotchas: the API key expires and returns 401 after (plan rotation). Live Tail sessions bill per minute after 1,800 free minutes, so close them. Unverified: whether the 5 GB free tier is always-free or 12 months.

## Option: Honeycomb

1. Free plan: 20M events/month, 60-day retention, unlimited users, 2 triggers. Overage throttles (1 in 10 events accepted) instead of billing.
2. `@honeycombio/opentelemetry-node` was archived Aug 2025. Use upstream OTel packages: `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-proto`.
3. Setup: sign up (pick US or EU), name the team, create an **Ingest** key (Environments → Manage Environments → API Keys → Ingest). Enable "create dataset" on the key; key permissions are permanent.
4. Env vars:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io/   # EU: https://api.eu1.honeycomb.io/
   OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=<ingest key>
   OTEL_SERVICE_NAME=sherah-mcp
   ```
5. Gotchas: without `service.name`, data lands in `unknown_service`. Honeycomb only treats a dataset as traces if some event has `trace.parent_id`, so one root span per request may not get trace views (events are still queryable). No live tail found.

## Shared code shape (Azure, Grafana, Honeycomb)

1. `src/telemetry.ts` starts the SDK; `import "./telemetry.js"` is the first line of `server.ts`.
2. `/mcp` middleware after `express.json()`: start span, set `rpc.method` / `mcp.tool` / `mcp.client`, end it on `res.on("finish")`.
3. Call `sdk.shutdown()` on SIGTERM so systemd restarts don't drop buffered spans.

## Open questions

- Resolved: the systemd unit loads `.env` via `EnvironmentFile=` and builds in `ExecStartPre`. `ecosystem.config.cjs` (pm2) is stale.
- Resolved: the server's Node version meets the 18.19+ requirement.
- Outbound HTTPS from the box to whichever backend is picked.
- Test that manual spans export without the loader hook before committing to an OTel option.

## Sources

Azure
- https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=nodejs
- https://learn.microsoft.com/en-us/azure/azure-monitor/app/create-workspace-resource
- https://learn.microsoft.com/en-us/azure/azure-monitor/logs/cost-logs
- https://azure.microsoft.com/en-us/pricing/details/monitor/
- https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/monitor/monitor-opentelemetry

Grafana
- https://grafana.com/pricing/
- https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/
- https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/traces/
- https://community.grafana.com/t/what-happens-when-my-usage-exceed-the-free-plan-limitations/102795
- https://community.grafana.com/t/how-to-create-otlp-auth-header-otel-exporter-otlp-headers-for-grafana-cloud/128160/13
- https://grafana.com/docs/opentelemetry/instrument/node/
- https://grafana.com/docs/alloy/latest/set-up/install/linux/
- https://grafana.com/docs/grafana/latest/explore/logs-integration/

AWS
- https://aws.amazon.com/cloudwatch/pricing/
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_HTTP_Endpoints_StructuredJSON.html
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_HTTP_Endpoints_BearerTokenAuth.html
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogs_LiveTail.html
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTLPEndpoint.html
- https://aws-otel.github.io/docs/getting-started/js-sdk/trace-metric-auto-instr
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

Honeycomb
- https://www.honeycomb.io/pricing
- https://docs.honeycomb.io/get-started/manage-costs/how-honeycomb-calculates-usage
- https://docs.honeycomb.io/send-data/javascript-nodejs/opentelemetry-sdk/
- https://docs.honeycomb.io/get-started/configure/environments/manage-api-keys/
- https://docs.honeycomb.io/troubleshoot/common-issues/data-in-honeycomb
- https://github.com/honeycombio/honeycomb-opentelemetry-node

OpenTelemetry
- https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md
- https://opentelemetry.io/docs/languages/js/instrumentation/
