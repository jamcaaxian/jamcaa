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

## First run

Start the development server and open [http://localhost:2727/setup](http://localhost:2727/setup). The setup flow creates the first administrator account and applies the install plan (buckets, capabilities). After that the administration lives at [http://localhost:2727/admin](http://localhost:2727/admin).

## Repository documentation

`CONTEXT.md`, `docs/adr/*.md`, and `docs/agents/*.md` remain Markdown in the repository and are migrated into this Site as Posts (ADR-0013). After editing one of those files:

```bash
pnpm test:docs:migrate        # verify conversion against an isolated D1
pnpm db:docs:migrate          # apply to the local development D1
pnpm db:docs:migrate:remote   # apply to the deployed D1
```

## Customizing the Site

Everything Site-specific lives under `src/content`:

- `collections.ts` declares the Collections and Fields; `schema.ts` assembles them into the ContentModel.
- `settings.ts` declares Site settings; the admin Settings page edits their values (title, description, permalink pattern, theme accent, date and time formats).
- `install.ts` declares the install plan (buckets and capabilities); `storage.ts` declares Media buckets.
- `public-*.ts`, `feed.ts`, and `taxonomy.ts` own presentation and reading paths.

Change the declarations, regenerate migrations with `pnpm db:generate`, and apply them with `pnpm db:migrate`.

## One-time production setup

Create these resources in the target Cloudflare account, then keep their identifiers in sync with the configs:

| Resource    | Name to create          | Where it is referenced                                                     |
| ----------- | ----------------------- | -------------------------------------------------------------------------- |
| D1 database | `jamcaa-docs`           | `wrangler.jsonc` → `d1_databases[DB]`                                      |
| D1 database | `jamcaa-docs-tag-cache` | `wrangler.jsonc` → `d1_databases[NEXT_TAG_CACHE_D1]`                       |
| R2 bucket   | `jamcaa-docs-inc-cache` | `wrangler.jsonc` → `r2_buckets[NEXT_INC_CACHE_R2_BUCKET]`                  |
| R2 bucket   | `jamcaa-docs-media`     | `wrangler.jsonc` → `r2_buckets[MEDIA_BUCKET]` and `src/content/storage.ts` |
| Worker      | `jamcaa-docs`           | created by `pnpm deploy`                                                   |
| Worker      | `jamcaa-docs-counters`  | `wrangler.counters.jsonc`                                                  |

After creating the two D1 databases, copy their `database_id` values from the dashboard into `wrangler.jsonc`.

Set the production secrets on the docs Worker (the values in `.dev.vars` are local only):

```bash
wrangler secret put BETTER_AUTH_SECRET       # at least 32 random characters
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID         # R2 API token, "Object Read & Write", scoped to jamcaa-docs-media
wrangler secret put R2_SECRET_ACCESS_KEY
```

The R2 credentials let the server sign addresses for browser uploads. Also add CORS rules to the media bucket for every admin origin that performs direct uploads, including `http://localhost:2727` while developing locally.

Add GitHub Secrets when CI should deploy automatically: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the deploy workflow), and `NPM_TOKEN` (the release workflow). The Cloudflare token needs Workers deploy, D1 edit, and the resource access required by the configured bindings. Until the secrets exist, the affected steps are skipped.

## Deploy

The Site expects the D1, R2, Durable Object, service, and image bindings declared in `wrangler.jsonc`. After those resources and secrets exist in the target Cloudflare account:

```bash
pnpm db:migrate:remote
pnpm run deploy
```

Deploy the counters Worker alongside it:

```bash
pnpm exec wrangler deploy --config wrangler.counters.jsonc
```

Use `pnpm run upload` instead when the deployment artifact should be uploaded without immediately deploying it.

On every push to `develop`, the deploy workflow verifies the repository, applies pending Docs D1 migrations, then deploys both Workers automatically once the Cloudflare secrets are configured.

After the first deploy: run `pnpm db:docs:migrate:remote` to publish the documentation, and open `/setup` on the deployed address to create its administrator. Manual deployments must apply `pnpm db:migrate:remote` before publishing a Worker that depends on a new schema.

View counts appear once the counters Worker is deployed; local `wrangler dev` does not start it, and the admin list simply omits the Views column until the `COUNTERS` service binding resolves.
