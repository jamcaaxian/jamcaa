# Public listings enhance cursor pagination rather than replacing it

Public home, Category, and Tag listings keep their cursor-addressed server pages as the authoritative reading path and progressively enhance them with automatic loading when a browser supports it. Each automatic request reads the same Entry Summary keyset page as the corresponding public address, while the real Next page link remains available in the server-rendered document for navigation without JavaScript and for recovery from network or browser failures.

The enhancement is owned by the Site rather than core. Core already owns the Collection-derived Entry Summary projection and opaque cursor semantics; the Site owns permalink and date presentation, public archive addresses, browser state, and accessibility. A small Site route returns that prepared presentation to a Client island without exposing Rich Text or recreating the summary query.

## Considered Options

- **Replace pagination with a client-only feed.** Rejected because public addresses would stop being independently refreshable, shareable, indexable, and usable without JavaScript.
- **Fetch and interpret Next.js Server Component payloads.** Rejected because that would couple the Site to an internal transport instead of a small explicit interface.
- **Navigate to every next page through the App Router.** Rejected because route replacement discards the accumulated list, while route pushes would fill browser history with automatic actions.
- **Expose the enhancement as a reusable browser package now.** Rejected until a second Site proves that its interface is genuinely shared; the current requirement is presentation owned by the official Site.

## Consequences

The browser appends pages serially, deduplicates them by Entry identifier, and stops automatic retries after a failure. It never moves focus or scroll position. Loading and completion are announced politely, and focusing the real Next page link suspends automatic loading so keyboard activation remains predictable.

After a page is appended, the browser uses `history.replaceState` with that page's canonical cursor address. Automatic loading therefore leaves the Back stack unchanged while keeping the visible address meaningful. No Entry data is stored in browser history, and a cold visit to any cursor address still renders a complete server page.

The enhancement adds no view-count writes. ADR-0007 remains authoritative if listing exposure counters are introduced later.
