import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TASKS_WE_HELP_WITH } from "./data/tasks.js";

// Registration pattern: server.registerResource(name, uri, metadata, readCallback)
// for static, argument-free content. Use a ResourceTemplate instead of a plain
// URI string if a resource ever needs to be parameterized.
export function registerResources(server: McpServer): McpServer {
  server.registerResource(
    "tasks-we-help-with",
    "sherah://tasks-we-help-with",
    {
      title: "Tasks Sherah helps with",
      description:
        "The categories of tasks Sherah helps with, sourced from " +
        "https://www.mysherah.com/tasks-we-help-with",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(TASKS_WE_HELP_WITH, null, 2),
        },
      ],
    }),
  );

  return server;
}
