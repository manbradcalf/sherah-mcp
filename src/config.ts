// config.ts — the ONLY place environment variables are read.
// Rebranding a fork of this template means editing .env, not code.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const env = (key: string, fallback = ""): string =>
  process.env[key]?.trim() || fallback;

const PUBLIC_HOST = env("PUBLIC_HOST", "mcp.mysherah.com");
const PORT = Number(env("PORT", "8001"));

// Hostname only — host-header validation compares port-agnostically.
const publicHostname = new URL(`http://${PUBLIC_HOST}`).hostname;
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(publicHostname);

const baseUrl = env(
  "PUBLIC_BASE_URL",
  isLocal ? `http://${publicHostname}:${PORT}` : `https://${publicHostname}`,
);

// "mcp.example.com" -> "com.example.mcp"
const reverseDns = (hostname: string): string =>
  hostname.split(".").reverse().join(".");

const name = env("MCP_NAME", "sherah-mcp");
const operator = env("MCP_OPERATOR", "Sherah");
const contactEmail = env(
  "MCP_CONTACT_EMAIL",
  "ben@medcalfsoftwaresolutions.com",
);
const cardName = env("MCP_CARD_NAME", `${reverseDns(publicHostname)}/${name}`);

// ARD (agenticresourcediscovery.org). The spec is young and inconsistent on
// URN prefix (urn:ai vs urn:air) and media type — both overridable here so a
// .env change tracks whatever the spec settles on.
const ardIdentifier = env("ARD_IDENTIFIER", `urn:ai:${publicHostname}:mcp:${name}`);
const ardEntryType = env("ARD_ENTRY_TYPE", "application/mcp-server-card+json");

export const config = {
  // network
  publicHostname,
  port: PORT,
  bindAddr: env("BIND_ADDR", "127.0.0.1"),
  extraHosts: env("EXTRA_HOSTS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  baseUrl,
  mcpEndpoint: `${baseUrl}/mcp`,
  protocolVersion: "2025-11-25",

  // identity / branding
  name,
  title: env("MCP_TITLE", "Sherah MCP Server"),
  version: pkg.version, // single-sourced from package.json
  description: env(
    "MCP_DESCRIPTION",
    "An MCP Server for integrating with and learning about Sherah.",
  ),
  websiteUrl: env("MCP_WEBSITE_URL"),
  repositoryUrl: env("MCP_REPOSITORY_URL"),
  repositorySource: env("MCP_REPOSITORY_SOURCE", "github"),
  iconUrl: env("MCP_ICON_URL"),
  iconMime: env("MCP_ICON_MIME", "image/png"),
  operator,
  contactEmail,
  cardName,
  cardNamespace: cardName.split("/")[0],
  ardIdentifier,
  ardEntryType,
  instructions: env(
    "MCP_INSTRUCTIONS",
    `This is a fully public MCP server operated by ${operator}. It's purpose is to educate AI agents of ${operator}'s capabilities, exposing an endpoint to request a task and signup if interested` +
      `No authentication is required. ` +
      (contactEmail ? `Contact: ${contactEmail}. ` : "") +
      `Discovery card: ${baseUrl}/.well-known/mcp-server-card`,
  ),
} as const;
