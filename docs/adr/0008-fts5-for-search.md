# Full-text search uses FTS5, not LIKE

Search is built on SQLite's FTS5 virtual tables.

This decision is forced by a platform limit and is worth recording, because otherwise a later reader will conclude that `LIKE '%term%'` would have been enough and try to simplify: **the underlying platform caps LIKE and GLOB patterns at 50 bytes.** Measured in UTF-8, that means a search phrase in a non-Latin script fails outright — not returning empty, but erroring — once it exceeds roughly sixteen characters.

Beyond the length cap, `LIKE '%...%'` cannot use an index and is already a full table scan at a few thousand rows. FTS5 resolves the length limit, the index problem, and relevance ranking in one move.

## Consequences

Each Collection explicitly declares which text-bearing Fields form its public search projection. The declaration accepts plain text, Markdown, and Rich Text Fields and rejects kinds whose values have no searchable text representation. Taxonomy names are filters and archives, not part of an Entry's full-text content.

Only published Entries are indexed. FTS5 tables are kept in sync with content tables through generated triggers covering insert, edit, publication, archival, and deletion, followed by a migration backfill for existing published Entries. Rich Text contributes text nodes and Media alternative text to the projection.

The first adapter uses the `unicode61` tokenizer with diacritic removal. It gives stable word search for the documentation Site and preserves short terms such as `D1` and `AI`; it does not claim language-aware segmentation for unspaced CJK prose. Changing tokenizer later requires rebuilding the index and therefore another explicit decision.

Reader input is split into contiguous Unicode letter, number, and private-use runs in application code. Each non-empty segment is quoted as one literal FTS phrase, and the phrases are joined by FTS5's implicit AND. Thus `edge runtime` means the literal terms `edge` and `runtime` may occur anywhere in the Entry, and `full-text` searches for the segments `full` and `text` without requiring phrase adjacency. This intentionally mirrors the chosen `unicode61` tokenizer for the supported reader inputs while avoiding runtime schema writes, which D1 does not authorize. Public search does not expose FTS operators, column filters, prefix search, or raw MATCH syntax. Input that produces no segment does not touch the Collection index.

Searchable Fields retain declaration order and begin with equal ranking weight. Results sort by FTS5 rank ascending, then by the source Entry's SQLite row identifier ascending as a stable tie-breaker. The cursor carries that pair opaquely; pages continue strictly after it. The first adapter returns 20 results by default and refuses to exceed 50. Match excerpts use FTS5's plain-text `snippet()` output with no injected highlighting markup and a maximum of 32 tokens.

The generated FTS table stores its own projected text, an unindexed Entry identifier, and the source Entry's SQLite row identifier as its rowid. Category and Tag filters are evaluated against the live Entry and relation tables and combine with each other using AND. Unknown public filter slugs are invalid filters and return no matches rather than silently widening to the unfiltered search. The adapter also rechecks Published status when reading, even though only Published Entries belong in the index.

The FTS5 tables and triggers are deterministic output of the content model's search declaration. A Site migration carries that output because migrations belong to Sites, but must not independently hand-maintain the same synchronization logic.
