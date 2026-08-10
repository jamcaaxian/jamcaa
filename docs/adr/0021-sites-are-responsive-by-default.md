# Sites are responsive by default

All official Site pages and reusable browser packages are mobile-first and must remain usable at 320, 375, 390, and 768 CSS pixels as well as desktop widths. This applies to public pages, authentication, installation, administration, Editing Controls, Media workflows, Sheets, Dialogs, tables, empty states, and error pages rather than treating responsive behaviour as a Site-specific enhancement.

## Consequences

Pages must not create viewport-level horizontal scrolling. Long text, Media, and code use safe wrapping or local scrolling; data tables provide an explicit small-screen presentation; the administration sidebar remains a drawer at tablet width; form surfaces fit the viewport; and primary touch targets provide a coarse-pointer hit area of roughly 44 CSS pixels. Full-height surfaces use dynamic or small viewport units where appropriate.

Responsive acceptance includes real browser checks at each required width in light and dark themes. Reusable browser packages own the responsive behaviour of their implementation, while a Site remains responsible for the surrounding layout and for preserving those guarantees when it supplies adapters or overrides.
