# Uploads take a hybrid path by size and resume direct failures

Small files upload through the server; large files switch to a presigned address that the browser writes to directly. Neither path works alone: proxying through the server is bounded by request body and CPU limits and cannot carry large video, while routing everything direct makes small files pay an extra round trip and removes the server's opportunity to validate.

## Consequences

Direct upload introduces two failure modes that must be handled explicitly rather than assumed away:

- **Upload succeeds but the callback is lost**, leaving an orphaned object nobody claims. There must be a reclamation path rather than letting these accumulate.
- **Partial failure on poor connections.** Uploads must support chunking with resumption and automatic retry. A resumable upload is identified by a content-related digest scoped to its uploader, so a different file can never inherit already-recorded parts merely because its filename and timestamps match. Expired or failed part addresses are replaced by requesting a fresh plan, which omits parts the server already recorded.

Fallback is asymmetric. If multipart cannot be established, the browser may still try the server path because no remote parts exist yet. Once multipart exists, failure must stay on that path: retry, refresh the plan, and eventually surface a retryable error. Sending the whole file through the server at that point both risks duplicating Media and reintroduces the request-body limit that multipart exists to avoid.

These behaviours are functional requirements, not optional polish. Upload is the most failure-prone step in the content authoring flow, and a silent stall on a poor connection drives authors away outright — so failures must be visible, retryable, and self-healing.
