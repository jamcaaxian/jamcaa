# Post Revisions are append-only snapshots restored through current rules

A Revision stores one successfully saved Entry state together with its Tag membership. The snapshot includes declared Fields, status, slug, publication time, and Category identity. It excludes Entry identity, creation time, and author ownership, because restoring content must not silently transfer ownership or change the Entry's lifecycle identity.

Restoring a Revision submits that snapshot as the desired state of the current Entry. The source Revision remains immutable. Current update, publish, Taxonomy, and public-address rules still apply, so deleted Taxonomy references refuse the Restore and an occupied historical address receives the same safe slug allocation as an ordinary save. A successful Restore appends the actual resulting state as a new Revision.

D1's Worker binding does not support an interactive `BEGIN` / application work / `COMMIT` transaction. Post writes therefore read and validate current state first, then submit Entry, Tag, Former Address, Revision, and public-address revision statements in one `D1Database.batch()`. D1 executes the batch as one SQL transaction and rolls back the entire sequence when any statement fails. Entry and public-address compare-and-swap statements reject stale plans, including content-only saves that calculated Former Address cleanup from an older permalink, so a concurrent writer cannot silently overwrite state calculated from an older read.

## Considered Options

- **Store only the previous state before an update.** Rejected because a newly created Entry would have no Revision, and the latest successful state would need special treatment outside Revisions.
- **Restore by replacing the current Revision pointer.** Rejected because it discards the record of the Restore and makes later tracing ambiguous.
- **Include author identity in the snapshot.** Rejected because author ownership controls `own` capabilities and must change only through a separate, explicit operation.
- **Use SQL `BEGIN IMMEDIATE` around application callbacks.** Rejected because the D1 Worker binding supports atomic batches, not interactive transactions across multiple binding calls.
- **Submit the Revision snapshot from a browser form.** Rejected because clients could alter historical content; Restore submits only Entry and Revision identifiers and rereads the snapshot server-side.

## Consequences

Revision tables are derived per Collection and cascade with their Entry. They keep a strict append order separate from timestamps, store versioned JSON snapshots, and expose only append and Entry-scoped read operations. Taxonomy identifiers inside snapshots are intentionally not foreign keys, so removing an unused term does not rewrite Revisions; a later Restore reports that the historical reference no longer exists.

Collection Field changes may make older snapshot formats unreadable under future declarations. The stored format version preserves a seam for compatibility work, but retention policies, field-by-field diffs, Revision deletion, and Media preservation remain separate decisions.
