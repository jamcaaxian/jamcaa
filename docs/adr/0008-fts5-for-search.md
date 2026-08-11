# Full-text search uses FTS5, not LIKE

Search is built on SQLite's FTS5 virtual tables.

This decision is forced by a platform limit and is worth recording, because otherwise a later reader will conclude that `LIKE '%term%'` would have been enough and try to simplify: **the underlying platform caps LIKE and GLOB patterns at 50 bytes.** Measured in UTF-8, that means a search phrase in a non-Latin script fails outright — not returning empty, but erroring — once it exceeds roughly sixteen characters.

Beyond the length cap, `LIKE '%...%'` cannot use an index and is already a full table scan at a few thousand rows. FTS5 resolves the length limit, the index problem, and relevance ranking in one move.

## Consequences

Each Collection explicitly declares which text-bearing Fields form its public search projection. The declaration accepts plain text, Markdown, and Rich Text Fields and rejects kinds whose values have no searchable text representation. Taxonomy names are filters and archives, not part of an Entry's full-text content.

Only published Entries are indexed. FTS5 tables are kept in sync with content tables through generated triggers covering insert, edit, publication, archival, and deletion, followed by a migration backfill for existing published Entries. Rich Text contributes text nodes and Media alternative text to the projection.

The first adapter uses the `unicode61` tokenizer with diacritic removal. It gives stable word search for the documentation Site and preserves short terms such as `D1` and `AI`; it does not claim language-aware segmentation for unspaced CJK prose. Changing tokenizer later requires rebuilding the index and therefore another explicit decision.

Reader input is converted to a quoted literal FTS query and bound as a parameter. Public search does not expose FTS operators, column filters, or raw MATCH syntax. Empty queries do not touch the index.

The FTS5 tables and triggers are deterministic output of the content model's search declaration. A Site migration carries that output because migrations belong to Sites, but must not independently hand-maintain the same synchronization logic.
