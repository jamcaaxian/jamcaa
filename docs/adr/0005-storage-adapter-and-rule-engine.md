# Storage adapter and rule engine

The platform can address several buckets at once: buckets inside the account go through the native binding, external S3-compatible endpoints go through request signing, and a single storage adapter interface hides the difference. Which bucket a file lands in is decided by storage rules configured in the admin interface — rules may match on the owning collection, category, tag, author role, author account, file type, file size, and upload date. Rules are ordered by priority and the first match wins.

Both paths are kept for a reason. The native binding is faster and incurs no egress charge, but its bucket list is fixed at deploy time. Supporting an administrator who adds a bucket at runtime requires the ability to sign S3 requests.

## Consequences

**Every media record stores the bucket it actually lives in.** This is a hard requirement of the data model: when an administrator adjusts the rules, the addresses of existing files must not break. Rules decide where new files go and are never applied retroactively.

The fallback rule is distinguished by a marker field, with the data layer guaranteeing exactly one exists. The delete endpoint refuses it, while allowing its target bucket to be changed.
