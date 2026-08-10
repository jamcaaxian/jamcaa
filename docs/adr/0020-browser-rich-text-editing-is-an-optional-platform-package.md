# Browser Rich Text editing is an optional platform package

The reusable Rich Text Editing Control lives in `@jamcaa/editor`, separate from both the Worker-safe core and any Site. The package encapsulates the React and Tiptap implementation, browser Media transfer, default Media library interaction, and editor styles behind a small Site-configured interface; it depends on `@jamcaa/core/content`, while the core never depends on it.

## Considered Options

- **Keep the Editing Control in the documentation Site**: avoids a package initially, but every new Site must copy the editor, Media picker, and multipart state machine, so fixes diverge.
- **Put Tiptap in the core**: gives one import path, but makes Worker-safe content validation and rendering depend on React, the DOM, and a browser editing library.
- **Use an optional browser package** (adopted): keeps the core portable while giving every Site the same maintained Editing Control.

## Consequences

Sites provide the Field name, accessible label, localised messages, Media collection context, HTTP endpoints, and Media address derivation through configuration or an adapter. Authentication, capabilities, route handlers, Cloudflare bindings, Collection-specific validation, and form composition remain in the Site. Tiptap instances, extension arrays, and Site UI modules are implementation details and are not part of the public interface.

Client editing and server-safe Rich Text rendering use separate package entry points so public pages do not acquire a Tiptap client boundary. Framework packages version together; the example Site may use workspace links, while independent Sites will consume matching published versions once the Platform's package-release pipeline is introduced. Until then the package remains private and source-exported like `@jamcaa/core`, but its Site-facing interface is isolated so publishing does not require another architectural move.
