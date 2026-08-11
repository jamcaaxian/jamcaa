# The public feed is JSON Feed built from Entry Summaries

A Site publishes its recent Entries at `/feed.json` as [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/), served as `application/feed+json`. The feed is a rendering of the same Entry Summaries the public lists read, not a second content path with its own projection.

The feed reuses the Entry Summary reader described in ADR-0018. It therefore inherits published-only visibility, the declared summary Fields, and the public publication order, and it inherits the guarantee that long-form content is never fetched or parsed to produce it. A Collection that declares no summary has no feed.

Absolute addresses are derived from the incoming request rather than from a new setting. JSON Feed requires `home_page_url` and `feed_url` to be absolute, but a Site's public origin is already implied by the request that asked for the feed. Introducing a configurable base URL would add a setting that can disagree with reality, and a wrong value is worse than a derived one: it produces a feed whose links point at a host the reader cannot reach.

## Considered Options

- **RSS or Atom.** Rejected for the first feed because both require XML escaping rules and date formats that invite subtle encoding defects, while the platform already models Entry Summaries as data. JSON Feed maps onto that data directly. This decision does not preclude adding RSS later; it chooses which format to get right first.
- **Serve the full Rich Text body as `content_html`.** Rejected because rendering Rich Text to HTML for every item reintroduces exactly the cost ADR-0018 removed from public lists, and because the platform has no HTML rendering seam that is safe to expose to arbitrary readers yet. The feed carries the declared summary text instead, and readers follow `url` for the whole Entry.
- **Add a `site.url` setting for absolute addresses.** Rejected because it duplicates information the request already carries and can be left stale after a domain change, silently producing a feed full of unreachable links.
- **Paginate the feed with `next_url`.** Rejected for now. The specification treats feed pagination as optional and rarely used by readers; a single page of recent Entries is what subscribers need. Entry Summary keyset pagination already exists if this changes.

## Consequences

The feed reports the most recent published Entries up to the Entry Summary maximum, which keeps it comfortably inside the size the specification recommends. Older Entries are reached by browsing rather than by subscribing.

Because the addresses are derived from the request, the same deployment serves a correct feed on every hostname that reaches it, including preview and custom domains, without configuration.

`feed.json` joins the reserved public namespaces. An Entry permalink cannot claim it, for the same reason it cannot claim `/search` or `/admin`.

Public pages advertise the feed with a `rel="alternate"` link of type `application/feed+json`, which is the discovery mechanism readers already use for RSS and Atom.
