# Plugin extension points are defined before the core sets

The core exposes seven kinds of extension point: field types, content lifecycle hooks, admin panel registration, storage adapters, authentication providers, custom API routes, and front-end component overrides.

These have to be designed alongside the core rather than added afterwards. Carving extension points into an already-closed core usually demands restructuring its control flow, because "let a third party intervene here" and "call this directly" are structurally different ways of writing the same code. Waiting until someone asks for an extension generally costs more than writing it extensibly from the start.

Field types matter most among them. The content model is itself declarative, and if the set of field types is closed, much of that model's value is lost — users could only pick from presets and would have no way to express concepts from their own domain.

## Consequences

Extension points are public API and fall under semantic versioning. Their signatures therefore need to be right before the first stable release; changing them afterwards is a breaking change. Internal implementation details must not leak through an extension point, or the core will be unable to refactor without breaking plugins.

A front-end component override may replace an entire Editing Control. Internal editor-library extensions are not plugin extension points: a new Rich Text node must contribute its persisted schema, validation, rendering, text extraction, and editing behaviour as one compatible capability rather than injecting browser behaviour alone.
