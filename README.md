# jamcaa

A content platform for the edge.

jamcaa is a schema-driven content management framework built for Cloudflare Workers. You declare your content model in TypeScript, and the framework derives the database schema, migrations, admin forms, and end-to-end types from that single declaration.

> **Status: pre-alpha.** Nothing here is stable yet. The public API is still being shaped, and breaking changes should be expected on every release until 1.0.

## Why this exists

Established content management frameworks assume a long-running Node.js process. That assumption does not hold on stateless, short-lived edge runtimes, which leaves teams building on Cloudflare Workers without a usable option. jamcaa targets that runtime directly rather than treating it as a deployment afterthought.

## Design principles

**One declaration, many artifacts.** A content model is written once. The database schema, migration files, admin interface, and TypeScript types are derived from it — not maintained in parallel.

**The core knows nothing about your site.** Anything true of only one site belongs in that site's configuration, never in a branch inside the core.

**Runtime dependencies sit behind ports.** Database, cache, object storage, counters, and search are reached through interfaces. Cloudflare adapters ship first; the indirection also makes the core testable without a cloud environment.

**Extension points are part of the public API.** Field types, content lifecycle hooks, admin panels, storage adapters, auth providers, API routes, and front-end components are all pluggable, and are versioned as public surface.

## Documentation

Documentation is built with jamcaa itself and doubles as the reference example site. Until the content pipeline lands, docs live as Markdown under [`docs/`](./docs).

Architectural decisions and their trade-offs are recorded in [`docs/adr/`](./docs/adr). Start there if you want to understand why something is the way it is.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first — note that a Contributor License Agreement is required.

## License

[Apache License 2.0](./LICENSE).
