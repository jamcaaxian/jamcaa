# The admin is guarded in the route, not at the edge

Access to `/admin` is decided by the admin layout, which validates the session and the explicit `console:access` capability against the database on every request. There is no proxy in front of it.

The obvious design was a proxy that redirects anyone without a session cookie before the route runs, with the route validating for real behind it — cheap rejection at the edge, authority in the route. That is what Better Auth recommends for Next, and it was built and working in development. **It cannot be deployed.**

## Why it cannot be deployed

Next 16 renamed middleware to proxy and made it Node-runtime only; declaring `runtime: "edge"` is rejected outright with "Proxy does not support Edge runtime". OpenNext for Cloudflare refuses to bundle a Node-runtime proxy and exits the build. There is no flag on either side. The two constraints are exactly opposed, so on this platform a Next 16 proxy is unavailable at any price.

## Considered Options

- **Keep the proxy and pin Next to 15.** Middleware still ran on the edge there. Rejected: ADR-0003 chose Next on Workers for the current version, and freezing the framework to keep an optimisation inverts that priority.
- **Keep the proxy for development only.** Rejected outright — a guard that exists in development and not in production trains everyone to reason about the wrong system.
- **Guard in the route** (adopted): the layout's session check is the only gate, which is what it already was.

## Consequences

**Nothing about the authority boundary changes.** The proxy was never a security boundary: `getSessionCookie` reads a cookie without verifying it, so anyone could forge their way past it and be turned away by the route regardless. The route validates both identity and Console access. Removing the proxy removes an optimisation, not a control.

**Adding a route under `/admin` is not enough to protect it.** Protection is inherited from the layout's session check, so a route group that opts out of that layout opts out of authentication. This was true with the proxy too, and is now the only thing that is true.

A signed-out visitor is redirected after the layout begins rendering rather than before the route is reached. No content is disclosed, but the database is consulted on a request that could have been refused earlier.

**A deep link into the admin returns to `/admin` after signing in, not to the page that was asked for.** The proxy was what captured the attempted path. The login page still honours a `next` parameter, and filters it to in-site paths so it cannot become an open redirect, but nothing generates it automatically now.

This decision should be revisited if OpenNext gains Node proxy support.
