// discovery.ts — public discovery documents, all driven by config.
//
// The server card follows SEP-2127 "MCP Server Cards" (DRAFT — path and
// schema may change before it merges into the spec). Its shape is a subset
// of the MCP Registry's server.json schema. Optional fields are omitted
// entirely when unset — never emitted as empty strings.
import { config } from "./config.js";
import { TASKS_WE_HELP_WITH } from "./data/tasks.js";

export function buildServerCard(): Record<string, unknown> {
  const card: Record<string, unknown> = {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: config.cardName, // reverse-DNS of the apex domain, e.g. "com.example/public-mcp-starter"
    version: config.version,
    description: config.description,
    title: config.title,
    remotes: [
      {
        type: "streamable-http",
        url: config.mcpEndpoint,
        supportedProtocolVersions: [config.protocolVersion],
      },
    ],
  };
  if (config.websiteUrl) card.websiteUrl = config.websiteUrl;
  if (config.repositoryUrl) {
    card.repository = {
      url: config.repositoryUrl,
      source: config.repositorySource,
    };
  }
  if (config.iconUrl) {
    card.icons = [{ src: config.iconUrl, mimeType: config.iconMime }];
  }
  if (config.operator || config.contactEmail) {
    card._meta = {
      [`${config.cardNamespace}/operator`]: {
        name: config.operator,
        ...(config.contactEmail ? { email: config.contactEmail } : {}),
      },
    };
  }
  return card;
}

// ARD capability manifest (https://agenticresourcediscovery.org/), served at
// /.well-known/ai-catalog.json so ARD registries can crawl this server.
// Catalog-specific copy lives here, not in config: it describes what Sherah
// does (for semantic indexing), not what this server is.
const ARD_DESCRIPTION =
  "Sherah is a personal-assistant and task-concierge service for busy " +
  "parents. This MCP server lets AI agents browse the categories of " +
  "household and life-admin tasks Sherah handles (home care, kids, pets, " +
  "travel, meals, shopping, party planning, and more) and submit a sign-up " +
  "request with a task on a user's behalf.";

const REPRESENTATIVE_QUERIES = [
  "Find a personal assistant service that can book house cleaners and lawn care",
  "Who can help me plan and book a family vacation?",
  "I need someone to manage my kids' activities, appointments, and school calendar",
  "Service to handle gift shopping, wrapping, and holiday cards for me",
  "Delegate errands like grocery ordering, pet care booking, and prescription pickup",
];

// Update when tools (src/tools.ts) or resources (src/resources.ts) change.
const CAPABILITIES = [
  "get_available_task_types",
  "request_sign_up",
  "request_sign_up_with_task",
  "tasks-we-help-with",
];

// "Admin & Organization" -> "admin-organization"
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function buildAiCatalog(): Record<string, unknown> {
  return {
    specVersion: "1.0",
    host: {
      displayName: config.operator,
      identifier: config.publicHostname,
    },
    entries: [
      {
        identifier: config.ardIdentifier,
        displayName: config.title,
        description: ARD_DESCRIPTION,
        type: config.ardEntryType,
        url: `${config.baseUrl}/.well-known/mcp-server-card`,
        capabilities: CAPABILITIES,
        representativeQueries: REPRESENTATIVE_QUERIES,
        tags: [
          "mcp",
          "personal-assistant",
          "task-concierge",
          ...TASKS_WE_HELP_WITH.categories.map((c) => slug(c.category)),
        ],
      },
    ],
  };
}

// Agentmap is ARD's secondary discovery hint for crawlers.
export function buildRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nAgentmap: ${config.baseUrl}/.well-known/ai-catalog.json\n`;
}

export function buildRootSummary(): Record<string, unknown> {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    version: config.version,
    operator: config.operator,
    ...(config.contactEmail ? { contact: config.contactEmail } : {}),
    ...(config.websiteUrl ? { website: config.websiteUrl } : {}),
    mcp: {
      endpoint: config.mcpEndpoint,
      transport: "streamable-http",
      protocolVersion: config.protocolVersion,
      authentication: "none",
    },
    discovery: [
      "/.well-known/mcp-server-card",
      "/.well-known/mcp.json",
      "/.well-known/ai-catalog.json",
    ],
  };
}
