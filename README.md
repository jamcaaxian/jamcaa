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

## Using the framework

The Docs Site doubles as the reference example (ADR-0013): [its guide](./apps/docs/README.md) walks through local development, first-run setup, content migration, Site customization, one-time Cloudflare resource creation, production secrets, and deployment — the same path any Site author follows. Read it top to bottom to deploy and customize your own Site.

Everything an adopter must do by hand is listed there, summarized here:

- **Local**: copy `.dev.vars.example` to `.dev.vars`, generate a `BETTER_AUTH_SECRET`, add local R2 credentials for signed uploads.
- **Cloudflare resources**: two D1 databases, two R2 buckets, the counters Worker; copy generated `database_id` values into `wrangler.jsonc`.
- **Production secrets** on the docs Worker: `BETTER_AUTH_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
- **GitHub Secrets** for CI: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `NPM_TOKEN`.
- **After first deploy**: `db:migrate:remote`, `db:docs:migrate:remote`, then `/setup` on the deployed address.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first — note that a Contributor License Agreement is required.

## Releasing

- [changesets](https://github.com/changesets/changesets) drives versions and changelogs. Run `pnpm changeset` alongside each pull request with public-facing changes.
- On every push to `develop`, GitHub Actions applies version bumps, commits them, and publishes `@jamcaaxian/core` and `@jamcaaxian/editor` to npm, and deploys the docs Site and its counters Worker to Cloudflare.
- The workflows read three GitHub Secrets: `NPM_TOKEN` (an npm automation token), `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`. Until they are configured, the steps that need them are skipped.
- The packages are published source-exported: consumers compile the TypeScript sources, so Next.js Sites must list them in [`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages).

## License

[Apache License 2.0](./LICENSE).
