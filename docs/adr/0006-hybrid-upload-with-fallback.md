# Uploads take a hybrid path by size, degrading on failure

Small files upload through the server; large files switch to a presigned address that the browser writes to directly. Neither path works alone: proxying through the server is bounded by request body and CPU limits and cannot carry large video, while routing everything direct makes small files pay an extra round trip and removes the server's opportunity to validate.

## Consequences

Direct upload introduces two failure modes that must be handled explicitly rather than assumed away:

- **Upload succeeds but the callback is lost**, leaving an orphaned object nobody claims. There must be a reclamation path rather than letting these accumulate.
- **Partial failure on poor connections.** Uploads must support chunking with resumption and automatic retry; when one path fails repeatedly past a threshold, it must fall back to the other and retry there, surfacing clear progress and failure reasons to the user rather than stalling in silence.

These behaviours are functional requirements, not optional polish. Upload is the most failure-prone step in the content authoring flow, and a silent stall on a poor connection drives authors away outright — so failures must be visible, retryable, and self-healing.
