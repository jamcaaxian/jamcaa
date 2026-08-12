# Capabilities are declared in code; role grants live in the database

The vocabulary of what can be granted — resources and their actions — is declared in TypeScript by the core and by plugins. Which capabilities each role holds is stored in the database and can be changed from the admin interface.

This split looks odd at first glance, so it is worth stating why neither half sits on the other side.

**The vocabulary belongs in code** because a capability only means something if something enforces it. `post:publish-any` exists because there is a code path that checks it; letting an operator invent a capability in the database would produce a grant that nothing honours. Declaring it in code also lets a plugin ship the capabilities its own screens require, which ADR-0011 requires of extension points.

**The grants belong in the database** because deciding whether an editor may moderate comments is an operational choice, not an engineering one. Sites differ, and requiring a code change and a deployment to adjust a role would put that decision in the wrong hands.

## Considered Options

- **Both in code**: smallest implementation, no queries on the permission path, fully type-checked. Rejected because an operator could not adjust a role without a developer.
- **Both in the database** (a general capability table): closest to established platforms, where plugins register capabilities at runtime. Rejected because a capability nothing enforces is a false promise, and because every check would query a database that serves queries one at a time.
- **Vocabulary in code, grants in the database** (adopted): operators adjust roles freely, but only within the set of capabilities the installed code actually enforces.

## Consequences

Grants are read on nearly every authenticated request, so they are cached in memory per worker instance with a short expiry. A Role change clears the cache in the Worker instance that accepted it, while other instances may keep serving the previous grants until their cache expires. This is a deliberate trade against querying on every request; permission edits are not expected to need immediate global effect.

Only an unseeded database falls back to the system Roles defined in code. Once Role rows exist, a Role with no capability rows is deliberately a zero-capability Role rather than an instruction to restore code defaults.

Grants naming a resource or action that no catalogue declares are rejected when written, rather than being silently ignored at check time.

System Role grants are replaced atomically. The Administrator's `role:read` and `role:manage` capabilities are recovery grants and cannot be removed, including by a forged request, so an operator can always inspect and repair Role capabilities.

Installation upgrades add capability grants as explicit versioned deltas. They do not synchronize the current default grant set over an existing Site, because doing so would restore capabilities an operator intentionally removed.

The access controller builds roles from plain objects when called, with no build-time step, which is what makes database-defined roles possible at all. A future version of that library that resolved roles statically would break this decision.
