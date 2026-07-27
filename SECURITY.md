# Security notes

This server is a fully public, no-auth "billboard" — see the README for why
that's the intended design, not an oversight. This file covers the specific
questions that come up because of that design, plus the parts of the setup
that are easy to get wrong: a public MCP endpoint, behind nginx with TLS and
rate limiting, calling a private backend (Xano) on your behalf.

## Is the data encrypted in transit?

Yes, on both hops:

- **Agent ↔ this server**: nginx terminates TLS using a certbot/Let's Encrypt
  certificate (`deploy/nginx.conf.example`). nginx then proxies to the Node
  app over `127.0.0.1` only — that hop never leaves the box, so there's
  nothing for a network observer to see beyond the outside of the TLS
  connection.
- **This server ↔ Xano**: the signup tool (`src/tools.ts`) calls
  `https://api.mysherah.com/...` — also TLS, and Node's `fetch` validates the
  certificate chain by default. Nothing in this codebase disables that
  verification.

Net effect: a passive eavesdropper on the wire (public wifi, a bot scanning
traffic, an ISP) can't read the task/email/city/state a user submits, or
Xano's response, on either leg.

TLS only covers data *in transit*. It says nothing about who can see the data
once it's logged, stored, or displayed — see the next two sections.

## Does anything log the submission or Xano's response?

The submission itself, no — nothing prints the task/email/city/state. On the
happy path it exists only in the request/response bodies of the two TLS
connections above, and in the MCP tool result handed back to the calling agent.

Two error paths do log, deliberately (`src/tools.ts`):

- An upstream non-2xx logs Xano's **response body** via `console.error`. The
  caller is anonymous, so error detail stays server-side rather than being
  echoed back — the tool returns only a status code. Xano's error bodies
  shouldn't contain submitted fields, but that's Xano's contract, not a
  guarantee this repo can make.
- A failed `fetch` logs the exception, which can include the request URL.

Neither logs the submission, but both mean "nothing about this request ever
reaches the server log" is false. Treat the server log as sensitive.

(Xano's own logging/dashboard is outside this repo's control — same
visibility any backend has into requests it receives.)

## Does the wildcard CORS leak anything?

No — and this is worth spelling out because "any origin can read the
response" sounds alarming out of context:

- CORS (`src/cors.ts`, `Access-Control-Allow-Origin: *`) only controls whether
  a **browser** lets its own JS read **the response to a request that browser
  itself made**. It does not let one origin read another origin's data, or
  intercept traffic in flight.
- This server has **no cookies, sessions, or credentials** at all, so there's
  no ambient authority for a malicious page to ride on — the classic
  CORS/CSRF risk (stealing a *logged-in* user's data) doesn't apply here
  because there's no logged-in state to steal.
- Every caller — browser, curl, another agent — gets an identical, public
  response for the discovery endpoints, and only ever sees the echo of *their
  own* submission for the signup tool.

## No rate limiting in the app — is that a gap?

By itself, yes — but it's handled at the layer in front of the app, not
inside it. There is no throttling in Express; every route, including the
state-changing signup tool, will accept calls as fast as they arrive. Abuse
protection is nginx's job: `deploy/nginx.conf.example` sets
`limit_req_zone ... rate=10r/s` with a burst of 20 on `location /`.

**Implication for deployment**: if this is ever run without nginx (or another
rate-limiting reverse proxy) in front, there is *no* protection against
someone hammering the signup endpoint. The app should never be exposed
directly to the internet on its own.

## What's intentionally *not* protected

Because the whole point of this server is to be a discoverable, anonymous
front door:

- No authentication anywhere — don't add tools here that expose secrets,
  private data, or side effects a stranger shouldn't be able to trigger.
- No per-caller throttling or abuse scoring beyond nginx's IP-based rate
  limit — a determined abuser with many IPs could still submit many signup
  requests. There's no CAPTCHA or similar in front of the tool.
- Sessions live in an in-memory `Map` with no idle eviction (fine for a
  lightweight billboard; would need a sweep if tools got heavier).

If a future tool needs to keep something private or gate who can call it,
that tool doesn't belong on this server — build it behind real auth instead.
