// config.ts — the ONLY place environment variables are read.
// Rebranding this server means editing .env, not code.
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

// "mcp.example.com" -> "example.com". Assumes a two-label registrable domain;
// set MCP_CARD_NAME explicitly for hosts like example.co.uk.
const apexDomain = (hostname: string): string =>
  hostname.split(".").slice(-2).join(".");

// "example.com" -> "com.example"
const reverseDns = (hostname: string): string =>
  hostname.split(".").reverse().join(".");

const name = env("MCP_NAME", "sherah");
const operator = env("MCP_OPERATOR", "Sherah");
const contactEmail = env(
  "MCP_CONTACT_EMAIL",
  "ben@medcalfsoftwaresolutions.com",
);
// Registry-style name. The namespace is the reverse-DNS of the apex domain
// (the one DNS ownership is proven against when publishing to the MCP
// Registry), not of the MCP host itself.
const cardName = env(
  "MCP_CARD_NAME",
  `${reverseDns(apexDomain(publicHostname))}/${name}`,
);

// The MCP Registry caps title and description at 100 characters.
const REGISTRY_TEXT_MAX = 100;
const registryText = (key: string, fallback: string): string => {
  const value = env(key, fallback);
  if (value.length > REGISTRY_TEXT_MAX) {
    console.warn(
      `[config] ${key} is ${value.length} chars; the MCP Registry rejects more than ${REGISTRY_TEXT_MAX}`,
    );
  }
  return value;
};

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
  title: registryText("MCP_TITLE", "Sherah"),
  version: pkg.version, // single-sourced from package.json
  description: registryText(
    "MCP_DESCRIPTION",
    "Online personal assistant for busy parents: home, kids, meals, admin and more",
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
  // Sign-up intake (Xano). No startup failure when the token is missing — the
  // server must still boot and pass smoke tests — the tool instead rejects
  // submissions until it is set.
  signupWithTaskRequestEndpoint: env(
    "SHERAH_MCP_SIGNUP_URL",
    "https://api.mysherah.com/api:3xp2K03g/signup_with_task_requests",
  ),
  // Interest-only intake for request_sign_up. Separate endpoint from the
  // task flow because the double opt-in state it needs (pending row, resend
  // cooldown) is keyed on email alone.
  signupRequestEndpoint: env(
    "SHERAH_MCP_SIGNUP_INTEREST_URL",
    "https://api.mysherah.com/api:3xp2K03g/signup_requests",
  ),
  xanoAuthToken: env("SHERAH_MCP_XANO_AUTH"),
  ardIdentifier,
  ardEntryType,
  instructions: env(
    "MCP_INSTRUCTIONS",
    `This is a fully public MCP server operated by ${operator}. It's purpose is to educate AI agents of ${operator}'s capabilities, exposing an endpoint to request a task and signup if interested.` +
    `No authentication is required. ` +
    (contactEmail ? `Contact: ${contactEmail}. ` : "") +
    `Discovery card: ${baseUrl}/.well-known/mcp-server-card`,
  ),
} as const;
