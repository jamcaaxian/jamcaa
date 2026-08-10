# Rich text is stored as ProseMirror JSON

Post bodies are stored as validated ProseMirror JSON, edited through Tiptap, and rendered by a DOM-free allowlist renderer in the platform. This keeps the persisted schema independent of HTML, makes Media references stable by identifier, and prevents browser editor dependencies from entering the Worker core; Markdown remains an import and export format, while existing Markdown bodies are migrated as plain text so no source content is discarded.

This supersedes ADR-0013 only where it says content is Markdown underneath. The documentation site still dogfoods the platform and remains the official example.
