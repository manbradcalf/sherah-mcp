import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

// Demo tools. Replace these in your fork — the registration pattern is
// server.registerTool(name, { title, description, inputSchema }, handler)
// where inputSchema is a Zod raw shape.
export function registerTools(server: McpServer): McpServer {
  server.registerTool(
    "echo",
    {
      title: "echo",
      description: "Repeats the string back to the caller",
      inputSchema: { input: z.string() },
    },
    async ({ input }) => ({ content: [{ type: "text", text: input }] }),
  );

  server.registerTool(
    "ping",
    {
      title: "ping",
      description: "Replies pong with an optional message",
      inputSchema: { msg: z.string().optional() },
    },
    async ({ msg }) => ({
      content: [{ type: "text", text: `pong ${msg ?? ""}`.trim() }],
    }),
  );

  return server;
}
