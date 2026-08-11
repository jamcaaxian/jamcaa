# A collection's types are derived; its table is assembled

A collection is declared once, in TypeScript. From that declaration the platform assembles a real table at runtime and derives the entry's static type. Neither is written by hand, and neither is generated into a file that could drift.

The two halves are built by different means, and it is worth saying why.

## The table is assembled, the type is mapped

Drizzle's table builders carry column types in their own generics, which only survive if the table is written out literally. A table assembled from a loop cannot keep them: by the time the columns are values in a record, their types have been widened away.

Rather than fight that, the two concerns are separated. **The assembled table is deliberately loose** and exists so queries have something real to run against. **`EntryOf<typeof collection>` is a mapped type** over the declaration, and it is what application code reads an entry's shape from. Each does the job it is suited to, and both come from the same declaration, so they cannot disagree about which fields exist.

## Considered Options

- **Generate a `.ts` schema file from the declaration.** Full Drizzle inference, no type gymnastics. Rejected because a generated file in the tree is a second source of truth that is correct only until someone forgets to regenerate it.
- **Carry Drizzle's inference through the builder with heavy generics.** Rejected after attempting it: the types become unreadable in errors, and every Drizzle upgrade risks breaking them in ways a site author cannot diagnose.
- **Assemble loosely, map the types separately** (adopted).

## Consequences

**A collection's entries are reached through `entryStore`, not through Drizzle.** The assembled table's columns are typed generically, so a hand-written query against one is checked by SQLite at runtime rather than by the compiler. The store is where the declaration's types are put back: it takes and returns `EntryOf`, and keeps the untyped columns to itself. A site that reaches past it gives up the type safety this decision exists to provide.

`Collection` is covariant in its fields, which cost a design constraint: `titleField` is narrowed to the declared keys while authoring but widens to `string` afterwards. Keeping `keyof TFields` on the resolved type made `Collection` invariant, and a specific collection could then not be passed to anything that accepts collections in general.

A collection is checked the moment it is declared — names, collisions with the fields every entry already has, and the column budget. **D1 allows 100 columns per table**, of which the platform spends eight including the Entry's Category relation, so a declaration is refused at 93 fields with a message saying what the remaining budget is. This is the build-time validation ADR-0002 required, and it happens at import time so a site fails to start rather than failing when a migration runs.

The model also derives one Tag relation table per Collection. The internal table name starts with `_jamcaa_`, which a Collection name cannot use, and connects the Collection's real Entry table to the platform's Tag table with foreign keys.

A Collection may declare the Fields in its public Entry Summary. The declaration must include the resolved title Field, may include scalar Fields, and rejects Markdown and Rich Text because a summary must not read or parse long-form content. `EntrySummaryOf<typeof collection>` derives the resulting type from the same declaration.

Entry Summaries are read through the core summary reader. It performs an exact column projection, returns Published Entries only, applies direct Category and Tag filters with AND semantics, and orders by the public publication moment descending with the Entry identifier as the stable tie-breaker. Site list and feed code must not recreate that query with Drizzle; doing so would give up both the derived type and the guarantee that long-form content is omitted.

References are checked when the model is assembled rather than when a collection is declared, since a collection may legitimately point at one that has not been declared yet.
