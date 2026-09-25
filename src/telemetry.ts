// telemetry.ts — request telemetry to Azure Application Insights.
// Imported first in server.ts so the SDK is registered before anything else
// loads. The distro's HTTP instrumentation creates one request span per HTTP
// call (it patches node:http, which works without a node --import flag);
// mcpTracing() then names and tags that span with the JSON-RPC details.
// With no connection string nothing is registered and this is all a no-op.
import {
  shutdownAzureMonitor,
  useAzureMonitor,
} from "@azure/monitor-opentelemetry";
import { trace } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { NextFunction, Request, Response } from "express";
import type { RequestOptions } from "node:http";
import { config } from "./config.js";

// The exporter probes the Azure VM metadata service; off Azure it fails and
// would log a failed dependency plus an exception on every start.
const AZURE_METADATA_HOST = "169.254.169.254";

if (config.appInsightsConnectionString) {
  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: config.appInsightsConnectionString,
    },
    resource: resourceFromAttributes({ "service.name": config.name }),
    enableLiveMetrics: true,
    // Keep every request. The default rate limiter (5/sec) drops the first
    // spans after startup, and Sherah's traffic is far below any limit.
    tracesPerSecond: 0,
    samplingRatio: 1,
    instrumentationOptions: {
      http: {
        enabled: true, // replacing the http options drops the default
        ignoreOutgoingRequestHook: (req: RequestOptions) =>
          (req.hostname ?? req.host) === AZURE_METADATA_HOST,
      } as object, // the distro types this as the base InstrumentationConfig
    },
  });
  // systemd stops the service with SIGTERM; flush buffered spans first.
  process.once("SIGTERM", () => {
    shutdownAzureMonitor().finally(() => process.exit(0));
  });
}

// Clients choose these strings, so cap them before they become telemetry.
const clip = (value: unknown): string | undefined =>
  typeof value === "string" ? value.slice(0, 100) : undefined;

// Names and tags the current request span with the JSON-RPC method, tool and
// client. Never records params.arguments — that is where sign-up PII is.
// clientInfo is only sent on initialize, so later requests look the client up
// by session via clientForSession.
export function mcpTracing(
  clientForSession: (sessionId: string | undefined) => string | undefined,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const span = trace.getActiveSpan();
    if (span) {
      const body = req.body ?? {};
      const method = clip(body.method);
      const tool = method === "tools/call" ? clip(body.params?.name) : undefined;
      if (method) {
        span.updateName([method, tool].filter(Boolean).join(" "));
        span.setAttribute("mcp.method", method);
      }
      if (tool) span.setAttribute("mcp.tool", tool);
      // Set now: the HTTP instrumentation ends the span as the response
      // finishes. initialize has no session ID yet (the response assigns it).
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const client =
        clip(body.params?.clientInfo?.name) ?? clip(clientForSession(sessionId));
      if (client) span.setAttribute("mcp.client", client);
      if (sessionId) span.setAttribute("mcp.session", sessionId);
    }
    next();
  };
}
