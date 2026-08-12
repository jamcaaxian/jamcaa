# Former Addresses point to Entry identity rather than another address

A Former Address stores its exact path and owning Entry, but not a redirect target. Public resolution loads the owning Entry and derives its current canonical address from active Site settings, so repeated slug or permalink changes always redirect directly to the latest address without rewriting history or creating chains.

## Considered Options

- **Store source and target paths.** Rejected because every later address change would have to rewrite all earlier rows or tolerate redirect chains.
- **Store former slugs only.** Rejected because permalink changes can alter literal and date segments even when a slug stays unchanged.
- **Keep history only in Next.js routes.** Rejected because addresses are operational Site data and change without a deployment.

## Consequences

Former Addresses are retained while an Entry is draft or archived but resolve only when it is published. They are deleted with the Entry. Static Site namespaces and current canonical addresses remain authoritative, so a write that would make a current or Former Address ambiguous is refused atomically.

Public address resolution reads the active permalink setting without the general settings cache. Entry address changes and permalink changes use a public-address revision compare-and-swap in the same D1 batch as history and content writes. Concurrent writers therefore retry from current state rather than dropping an intermediate canonical address.
