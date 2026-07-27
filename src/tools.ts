import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { US_STATE_CODES } from "./data/us-states.js";
import { config } from "./config.js";

// Free-text fields on a public, unauthenticated tool are attacker-controlled:
// `task` is whatever an LLM was told to write, and the caller is anonymous.
// The caps are advertised in the tool's JSON Schema so clients can self-limit;
// the express.json() 100kb default is an accidental backstop, not the contract.
const MAX_TASK_LENGTH = 2000;
const MAX_CITY_LENGTH = 100;

// Control characters collapse to spaces so embedded CRLF can't reach a
// downstream header (an email subject line is the obvious one). Newlines go
// too — a task description reads fine as one paragraph, and keeping them
// would keep the injection. Relax this only if the consumer is header-safe.
const singleLine = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

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
        task: z
          .string()
          .min(1)
          .max(MAX_TASK_LENGTH)
          .describe("What do you need done?"),
        // A calendar date, not an instant — coercing to a Date forced a
        // timezone the caller never gave us, landing UTC midnight on the
        // previous local day. Passed through to Xano unconverted.
        neededBy: z
          .string()
          .date()
          .describe(
            "When do you need it done by? Calendar date as YYYY-MM-DD.",
          ),
        email: z.string().email(),
        city: z.string().min(1).max(MAX_CITY_LENGTH),
        state: z.enum(US_STATE_CODES).describe("US state (two-letter code)"),
      },
    },
    async ({ task, neededBy, email, city, state }) => {
      if (!config.xanoAuthToken) {
        console.error(
          "request_sign_up_with_task rejected: SHERAH_MCP_XANO_AUTH is not set",
        );
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "This server is not configured to accept sign-up requests yet. Please contact the operator.",
            },
          ],
        };
      }
      // Sanitize after validation, not in the schema: a Zod transform would
      // muddy the JSON Schema the tool advertises, and this keeps what goes
      // upstream visible at the call site.
      const submission = {
        task: singleLine(task),
        neededBy,
        email,
        city: singleLine(city),
        state,
      };
      if (!submission.task || !submission.city) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Both task and city must contain readable text.",
            },
          ],
        };
      }
      let response: Response;
      try {
        response = await fetch(config.signupUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.xanoAuthToken}`,
          },
          body: JSON.stringify(submission),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        console.error("request_sign_up_with_task upstream call failed:", err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Failed to submit sign-up request: the sign-up service is unreachable. Please try again later.",
            },
          ],
        };
      }
      if (!response.ok) {
        // Callers are anonymous — upstream error bodies stay in the server log.
        console.error(
          `request_sign_up_with_task upstream error ${response.status}:`,
          await response.text(),
        );
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to submit sign-up request (upstream error ${response.status}). Please try again later.`,
            },
          ],
        };
      }
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
