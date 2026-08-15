---
status: accepted
supersedes: ADR-0009
---

# Content variants are separate localized identities

Entries and Pages may have one independently authored variant per Locale. Variants are separate rows so each language can have its own Fields, publication state, slug or address, while a stable Translation Set links variants that represent the same content. Locale is therefore part of public content identity: Entry Summaries, Search, canonical addresses, and Former Addresses are partitioned by Locale, and pagination cursors are invalid outside the Locale that created them.

## Considered Options

- **Store translated values inside every Field.** Rejected because it multiplies Field storage, validation, Revision, Search, and Editing Control complexity, including for Sites that use only one Locale.
- **Keep one Entry and fall back to another language when content is missing.** Rejected because a localized URL would claim a translation that was never authored and would make publication state ambiguous.
- **Use separate Entries and Pages linked by a Translation Set.** Adopted because existing content behavior stays intact within each Locale while translation relationships remain explicit and optional.

## Consequences

Sites declare a finite Locale catalogue with canonical BCP 47 tags and stable lowercase URL keys. Existing nonlocalized Sites remain compatible through the `und` Locale; a Site adopting Locales migrates existing content to an explicit default Locale. A Translation Set contains at most one variant per Locale. Locale and Translation Set identity do not change through ordinary Entry or Page updates or Revision Restore.

Public URL prefixes are Site presentation, not stored content addresses. A missing variant does not render another Locale's body. Navigation may offer only translations that actually exist, and `x-default` may point to a language selector rather than a content fallback.
