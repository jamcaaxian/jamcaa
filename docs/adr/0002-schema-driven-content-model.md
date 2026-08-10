# Schema-driven content model

A Site's content structure is defined in a single TypeScript declaration, from which the database schema, migration files, Editing Control requirements, and static types are all derived. A new Site takes on its own content shape by rewriting that declaration, not by modifying the core. The declaration identifies the Field kind; reusable browser packages supply compatible Editing Controls, while each Site currently owns control selection, form composition, and its domain rules.

## Considered Options

- **Fixed schema**: content tables hard-coded. Queries and types are optimal, but every new site means editing the core's table definitions — in direct conflict with the portability goal in ADR-0001.
- **WordPress-style `post_meta` key-value table**: fields can be added and removed at runtime with no migration. But every custom field degrades to a string, and queries require extensive joins. This is precisely why WordPress slows down as data grows.
- **Schema-driven, generating real tables** (adopted): flexible and type-safe together, at the cost of having to build the declaration-to-schema generator and its migration handoff ourselves.

## Consequences

Each collection becomes a real table and is therefore bound by the underlying limit of 100 columns per table. The declaration layer must validate field counts at build time and fail with a clear message, rather than letting the migration blow up later.
