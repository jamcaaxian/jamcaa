# Public entry addresses are resolved from the active permalink setting

**Status:** Accepted. The redirect-history consequence recorded below was superseded by [ADR-0026](./0026-former-addresses-point-to-entry-identity.md), which adds persisted Former Addresses while keeping the active permalink setting authoritative.

A Site declares one permalink setting for each Collection. That setting is authoritative for links, canonical metadata, and request resolution; it is not only a preview shown in the admin.

The platform compiles a configured pattern into two operations: building an address for an Entry and matching a requested path back to the tokens that identify one. Matching is exact for literal segments and validates date and Collection tokens after the Entry has been loaded. A Site supplies its Entry store and rendering, while the path semantics stay in the Worker-safe core.

Static Site routes remain authoritative. A Site exposes published Entries through a catch-all page only after Next.js has given its static routes priority, so `/admin`, `/api`, `/category`, `/tag`, `/search`, `/media`, `/login`, `/setup`, and static files cannot be claimed by an Entry permalink.

The Site validates the complete derived address before saving an Entry. When a generated or requested slug would place the Entry inside a reserved Site namespace, slug allocation advances to the next free, non-reserved candidate. This applies to both automatically generated and publisher-selected slugs, so the database cannot hold a Post whose canonical address is hidden behind a static route.

## Considered Options

- **Keep a fixed `/posts/{slug}` route and use the setting only for display.** Rejected because an editable setting that nothing reads is a false promise.
- **Generate Next.js route files for every offered pattern.** Rejected because settings are operational data and can change without rebuilding or redeploying the Site.
- **Store the complete public path on every Entry.** Rejected because the path is derived from the Entry and the active setting. Persisting both would introduce a second source of truth before redirect history exists.
- **Resolve configured paths through one catch-all Site route** (adopted). The core owns pattern compilation and matching; the Site owns database access and presentation.

## Consequences

The following two paragraphs record the historical consequence before ADR-0026 and are no longer the active Platform behavior:

> Changing a Collection's permalink setting changes the canonical address of all its Entries immediately. The Platform does not yet retain earlier paths, so old addresses are not redirected in this slice. Redirect history requires its own persisted model and lifecycle rules and will be added separately rather than implied by stale route files.
>
> Changing an Entry's slug has the same consequence. Sites should expose canonical links generated from the current setting and must return not found when a requested path does not match it exactly.

Patterns may contain literal path segments and the tokens `{slug}`, `{collection}`, `{year}`, `{month}`, and `{day}`. Tokens occupy complete path segments. Query strings and fragments are not part of a permalink pattern.

Choosing a slug is a publishing capability. Authors without that capability receive a slug generated from the title for a new Entry and retain the existing slug while editing. The server enforces this rule independently of the editing control.

The docs Site keeps its home page as a static route and resolves Entry pages below every other static route. This lets the Site dogfood configurable addresses without moving Next.js routing concerns into `@jamcaa/core`.
