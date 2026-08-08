# Full-text search uses FTS5, not LIKE

Search is built on SQLite's FTS5 virtual tables.

This decision is forced by a platform limit and is worth recording, because otherwise a later reader will conclude that `LIKE '%term%'` would have been enough and try to simplify: **the underlying platform caps LIKE and GLOB patterns at 50 bytes.** Measured in UTF-8, that means a search phrase in a non-Latin script fails outright — not returning empty, but erroring — once it exceeds roughly sixteen characters.

Beyond the length cap, `LIKE '%...%'` cannot use an index and is already a full table scan at a few thousand rows. FTS5 resolves the length limit, the index problem, and relevance ranking in one move.

## Consequences

The FTS5 tables must be kept in sync with the content tables through triggers. That synchronisation is emitted by the content model's generator alongside the tables themselves and must not be hand-maintained.
