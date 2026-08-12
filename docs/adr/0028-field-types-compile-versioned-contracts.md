# Field types compile into versioned storage, Revision, Search, and Editing Control contracts

A Field represents one logical Entry value but may compile into multiple physical SQL columns. Third-party Field types are installed statically with the Site, expose Worker-safe contracts rather than Drizzle or React implementations, and use a Site-owned explicit browser registry for their Editing Controls.

## Considered Options

- **Keep one Field equal to one SQL column.** Rejected because compound domain values would have to leak physical slots into Collections and Entry types.
- **Let Field types return Drizzle builders or raw SQL.** Rejected because those are implementation details that would lock public extensions to dependency versions and unsafe migration context.
- **Install plugins through global registration, import side effects, or database state.** Rejected because order-dependent discovery conflicts with deterministic Worker bundles, migrations, and static Entry types.
- **Give Search separate JavaScript and SQLite implementations.** Rejected because the two projections can drift. One restricted expression tree must drive both execution paths.

## Consequences

The Platform owns physical column naming, column-budget accounting, null-shape validation, atomic encoding, expression validation, and SQLite compilation. A logical Field update always writes every physical slot together. Optional Fields use an all-NULL physical shape; non-null values must satisfy every required slot.

Storage, Revision, Search, and Editing Control wire contracts version independently. Storage changes require a Site migration. New Revision snapshots use versioned per-Field envelopes while the existing format remains readable. Search projection changes require the existing append-only Site migration handoff. Editing Control requests declare the protocol version that the Site registry must support.

Search extensions use a restricted, deterministic expression algebra over only the current Field's physical slots. The algebra has no raw SQL, arbitrary function names, table aliases, joins, DDL, DML, or access to other Fields. Complex JSON text extraction is represented by explicit high-level operations that the Platform evaluates in JavaScript and compiles to SQLite.

Built-in Field behavior moves behind the compiler before `defineFieldType()` is exported. This first preserves existing factory calls, Entry types, physical schema, stored values, Revision reads, and Search behavior; only after those contracts are characterized and verified does the third-party interface become public.
