# OpenNext Starter

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server:

```bash
npm run dev
# or similar package manager command
```

Open [http://localhost:2727](http://localhost:2727) with your browser to see the result.

## Database declarations

Run `pnpm db:generate` after changing a Collection. Drizzle generates ordinary table migrations, then the search migration check verifies each searchable Collection against the append-only ledger in `migrations/search-manifest.json`.

If the search declaration or generator changed, the command prints the current canonical artifact SHA-256 and generated SQL. Add a new numbered SQL migration that carries those statements verbatim apart from SQL formatting, then append a ledger record; never edit a registered migration such as `0009_search.sql`. Removing search prints the required drop statements and artifact hash. Set `SEARCH_MIGRATION_BASE_REF` when the comparison branch is not `origin/develop`; the check still protects records already registered on `HEAD`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
npm run preview
# or similar package manager command
```

## Deploy

Deploy the application to Cloudflare:

```bash
npm run deploy
# or similar package manager command
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
