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

const errorResult = (text: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text }],
});

const textResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

// Shared Xano leg for the intake tools. Returns an error result to hand
// straight back to the caller, or null when Xano accepted the submission.
// Callers are anonymous, so Xano's error detail stays in the server log — the
// tool result never carries more than a status code.
async function postToIntake(
  toolName: string,
  url: string,
  submission: Record<string, unknown>,
): Promise<ReturnType<typeof errorResult> | null> {
  if (!config.xanoAuthToken) {
    console.error(`${toolName} rejected: SHERAH_MCP_XANO_AUTH is not set`);
    return errorResult(
      "This server is not configured to accept sign-up requests yet. Please contact the operator.",
    );
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.xanoAuthToken}`,
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error(`${toolName} Xano call failed:`, err);
    return errorResult(
      "Failed to submit sign-up request: the sign-up service is unreachable. Please try again later.",
    );
  }
  if (!response.ok) {
    console.error(
      `${toolName} Xano error ${response.status}:`,
      await response.text(),
    );
    return errorResult(
      `Failed to submit sign-up request (sign-up service error ${response.status}). Please try again later.`,
    );
  }
  return null;
}

export function registerTools(server: McpServer): McpServer {
  server.registerTool(
    "request_sign_up",
    {
      title: "Request sign up",
      description:
        "Registers a person's interest in signing up for Sherah, without a " +
        "specific task attached. Sherah emails them a confirmation link; the " +
        "sign-up only proceeds once they click it, so use this when you have " +
        "the person's own email address and their agreement to be contacted. " +
        "If they have a concrete task in mind, use request_sign_up_with_task " +
        "instead.",
      inputSchema: {
        email: z.string().email(),
        city: z.string().min(1).max(MAX_CITY_LENGTH),
        state: z.enum(US_STATE_CODES).describe("US state (two-letter code)"),
      },
    },
    async ({ email, city, state }) => {
      const submission = { email, city: singleLine(city), state };

      const failure = await postToIntake(
        "request_sign_up",
        config.signupRequestEndpoint,
        submission,
      );
      if (failure) return failure;
      return textResult(
        `Thanks! We've emailed ${email} a link asking them to confirm they want to ` +
        "sign up for Sherah. Nothing further happens until they click it — let them " +
        "know to check their inbox, and don't re-submit if they haven't yet.",
      );
    },
  );

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
        neededBy: z
          .string()
          .date("Expected a calendar date as YYYY-MM-DD, for example 2026-08-01")
          .describe(
            "When do you need it done by? A calendar date as YYYY-MM-DD, " +
            "e.g. 2026-08-01. Resolve relative dates like 'next Tuesday' " +
            "yourself before calling. No time and no timezone.",
          ),
        email: z.string().email(),
        city: z.string().min(1).max(MAX_CITY_LENGTH),
        state: z.enum(US_STATE_CODES).describe("US state (two-letter code)"),
      },
    },
    async ({ task, neededBy, email, city, state }) => {
      // Sanitize after validation, not in the schema: a Zod transform would
      // muddy the JSON Schema the tool advertises, and this keeps what goes
      // to Xano visible at the call site.
      const submission = {
        task: singleLine(task),
        neededBy,
        email,
        city: singleLine(city),
        state,
      };
      const failure = await postToIntake(
        "request_sign_up_with_task",
        config.signupWithTaskRequestEndpoint,
        submission,
      );
      if (failure) return failure;
      // NOTE: issue #19 wants this to say "pending until the emailed link is
      // clicked" — but only once the Xano double opt-in flow is live for this
      // endpoint. Changing it early would promise an email that never arrives.
      return textResult(
        "Thanks! We received your request:\n" +
        JSON.stringify(submission, null, 2),
      );
    },
  );

  return server;
}
