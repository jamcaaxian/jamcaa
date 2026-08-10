# Rich Text is stored as ProseMirror JSON

Every Rich Text Field is stored as validated ProseMirror JSON. The Worker-safe core owns the persisted schema, validation, plain-text extraction, and DOM-free allowlist renderer; the optional browser Editing Control edits that representation through Tiptap. This keeps the persisted schema independent of HTML, makes Media references stable by identifier, and prevents browser dependencies from entering the core.

Media nodes store only the Media identifier and alternative text. A Site adapter derives browser and public addresses, so neither the persisted document nor the Editing Control assumes a route layout. The browser schema and the core schema are one compatibility contract: upgrading Tiptap or adding a node must not change stored JSON without updating core validation and rendering in the same change. Core parsing returns the canonical ProseMirror representation, including schema defaults required by the browser and omitting empty child arrays that ProseMirror omits, so loading and emitting a valid document does not silently rewrite it.

Markdown remains an import and export format. Existing Markdown bodies are migrated as plain text so no source content is discarded.

This supersedes ADR-0013 only where it says content is Markdown underneath. The documentation site still dogfoods the platform and remains the official example.
