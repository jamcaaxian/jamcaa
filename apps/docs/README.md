# jamcaa Docs Site

The official documentation and reference Site for jamcaa. It exercises the Platform's declared Collections, administration, Taxonomy, Media, public addresses, Search, Feed, Preview, and Revisions on Next.js and Cloudflare Workers.

## Prerequisites

- Install dependencies from the repository root with `pnpm install`.
- Copy `.dev.vars.example` to `.dev.vars` and provide the required local secrets.
- Enable Windows Developer Mode before OpenNext builds, as described in the repository [contribution guide](../../CONTRIBUTING.md#on-windows-enable-developer-mode-first).

## Develop

From this directory, start the Node.js development server on port 2727:

```bash
pnpm dev
```

Open [http://localhost:2727](http://localhost:2727) in a browser.

Apply Site migrations to the local D1 database when needed:

```bash
pnpm db:migrate
```

This command is local-only. Remote migration remains the explicit `pnpm db:migrate:remote` command and must not be used as part of ordinary development or automated verification.

## Collection Declarations

Run `pnpm db:generate` after changing a Collection. Drizzle generates ordinary table migrations, then the Search migration check verifies each searchable Collection against the append-only ledger in `migrations/search-manifest.json`.

If the Search declaration or generator changed, the command prints the current canonical artifact SHA-256 and generated SQL. Add a new numbered SQL migration that carries those statements verbatim apart from SQL formatting, then append a ledger record; never edit a registered migration such as `0009_search.sql`.

Removing Search prints the required drop statements and artifact hash. Set `SEARCH_MIGRATION_BASE_REF` when the comparison branch is not `origin/develop`; the check still protects records already registered on `HEAD`.

Run only the Search migration handoff check with:

```bash
pnpm db:search:check
```

## Verify

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The test command runs the Cloudflare Worker integration suite and the isolated Node.js Search migration workflow tests.

## Preview

Build and preview through OpenNext on the Cloudflare runtime:

```bash
pnpm preview
```

On Windows, the current OpenNext/workerd toolchain may fail to resolve generated server manifests. Use WSL or CI when that existing platform limitation appears; `pnpm dev` remains the local browser-acceptance path.

## Deploy

The Site expects the D1, R2, Durable Object, service, and image bindings declared in `wrangler.jsonc`. After those resources and secrets exist in the target Cloudflare account:

```bash
pnpm deploy
```

Use `pnpm upload` instead when the deployment artifact should be uploaded without immediately deploying it.
