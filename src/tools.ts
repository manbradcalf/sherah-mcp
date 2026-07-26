import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { US_STATE_CODES } from "./data/us-states.js";
import { config } from "./config.js";

// Demo tools. Replace these in your fork — the registration pattern is
// server.registerTool(name, { title, description, inputSchema }, handler)
// where inputSchema is a Zod raw shape.
export function registerTools(server: McpServer): McpServer {
  server.registerTool(
    "request_sign_up_with_task",
    {
      title: "Request sign up with task",
      description:
        "Submits a request for Sherah to help with a task, along with the " +
        "requester's contact and location details.",
      inputSchema: {
        task: z.string().describe("What do you need done?"),
        neededBy: z.coerce.date().describe("When do you need it done by?"),
        email: z.string().email(),
        city: z.string(),
        state: z.enum(US_STATE_CODES).describe("US state (two-letter code)"),
      },
    },
    async ({ task, neededBy, email, city, state }) => {
      const submission = {
        task,
        neededBy,
        email,
        city,
        state,
      };
      const response = await fetch(
        "https://api.mysherah.com/api:3xp2K03g/signup_with_task_requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.xanoAuthToken}`,
          },
          body: JSON.stringify(submission),
        },
      );
      if (!response.ok) {
        const errorBody = await response.text();
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to submit sign-up request (${response.status}): ${errorBody}`,
            },
          ],
        };
      }
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
