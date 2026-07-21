import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { TASKS_WE_HELP_WITH } from "./data/tasks.js";
import { US_STATE_CODES } from "./data/us-states.js";

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

  server.registerTool(
    "list_available_tasks",
    {
      title: "List available tasks",
      description:
        "Returns the categories of tasks Sherah helps with, sourced from " +
        "https://www.mysherah.com/tasks-we-help-with",
      inputSchema: {},
    },
    async () => ({
      content: [
        { type: "text", text: JSON.stringify(TASKS_WE_HELP_WITH, null, 2) },
      ],
    }),
  );

  server.registerTool(
    "request_sign_up_with_task",
    {
      title: "Request sign up with task",
      description:
        "Submits a request for Sherah to help with a task, along with the " +
        "requester's contact and location details.",
      inputSchema: {
        task: z.string().describe("What do you need done?"),
        neededBy: z.coerce
          .date()
          .describe("When do you need it done by?"),
        email: z.string().email(),
        city: z.string(),
        state: z.enum(US_STATE_CODES).describe("US state (two-letter code)"),
      },
    },
    async ({ task, neededBy, email, city, state }) => {
      const submission = {
        task,
        neededBy: neededBy.toISOString(),
        email,
        city,
        state,
      };
      // TODO: replace with a call to Xano to store this submission as a row
      // in the sign-ups table, once the Xano schema/endpoint is finalized.
      console.log("Sign-up request received:", submission);
      return {
        content: [
          {
            type: "text",
            text:
              "Thanks! We received your request:\n" +
              JSON.stringify(submission, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
