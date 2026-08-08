# Next.js on Cloudflare Workers via the OpenNext adapter

The platform is deployed to Cloudflare Workers, with Next.js running through the `@opennextjs/cloudflare` adapter rather than being exported as a static site. The project is scaffolded with the official C3 command (`npm create cloudflare@latest -- <dir> --framework=next`) — `wrangler init` is no longer the official path for framework projects.

## Considered Options

- **Static export plus a hand-written Worker for dynamic requests**: no adapter required, but this abandons server rendering and incremental regeneration, leaving the admin interface and search to fall back to client rendering.
- **Cloudflare Pages with next-on-pages**: placed in maintenance mode upstream, and unsuitable for a new project.
- **The OpenNext adapter** (adopted): full support for the App Router, server rendering, incremental regeneration, and server actions, at the cost of a larger build artifact and one extra build step.

## Consequences

The development server is not equivalent to production. Day-to-day work uses the Next.js dev server, but integration checks must go through `preview`, because only that executes the code in the real `workerd` runtime.

The Next.js version is pinned exactly. The adapter patches Next's server to keep native image-processing binaries out of the Workers bundle, and that patch is version-specific — it fails silently against untested versions. Bump Next only together with the adapter, and verify with `preview` afterwards.
