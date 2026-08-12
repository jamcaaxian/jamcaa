# jamcaa

A publishing Platform for the edge.

jamcaa is a schema-driven publishing Platform built for Cloudflare Workers. A Site declares its Collections and Fields in TypeScript; the Platform derives storage tables, Editing Controls, validation, typed Entry access, Revision snapshots, and Search migration artifacts from those declarations.

> **Status: pre-alpha.** Nothing here is stable yet. The public API is still being shaped, and breaking changes should be expected on every release until 1.0.

## Why this exists

Established publishing platforms assume a long-running Node.js process. That assumption does not hold on stateless, short-lived edge runtimes. jamcaa targets Cloudflare Workers directly rather than treating the runtime as a deployment afterthought.

## Design principles

**One declaration, many artifacts.** A Site declares each Collection once. Storage, Editing Controls, validation, Entry types, Revision snapshots, and Search migration verification derive from that declaration rather than being maintained independently.

**The Platform knows nothing specific about your Site.** Site-only presentation and policy stay in the Site rather than branching generic Platform modules around one implementation.

**Runtime boundaries stay explicit.** Object storage and Search use replaceable adapters, while Site-owned D1 integration and Cloudflare bindings remain at their runtime boundary. Generic logic stays testable without depending on one Site's tables.

**Public surfaces stay deliberate.** The Platform is pre-alpha; reusable modules are kept narrow while extension contracts are still being designed.

## Documentation

The reference Docs Site under [`apps/docs`](./apps/docs) is built with jamcaa itself. Repository guidance and architectural records remain as Markdown under [`docs/`](./docs), while the Site exercises the implemented content, administration, Search, Feed, Preview, and Revision paths.

Architectural decisions and their trade-offs are recorded in [`docs/adr/`](./docs/adr). Start there if you want to understand why something is the way it is.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first — note that a Contributor License Agreement is required.

## License

[Apache License 2.0](./LICENSE).
