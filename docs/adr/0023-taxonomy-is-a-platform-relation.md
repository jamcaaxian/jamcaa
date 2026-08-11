# Taxonomy is a platform relation, not a Collection Field

Taxonomy is a platform concept shared by every Site. Categories and tags belong to the Site: a Category is hierarchical and every Entry belongs to exactly one, while Tags are flat and an Entry may carry many.

Category membership is part of the Entry row so the database can guarantee that exactly one Category is present. Tag membership uses a relation table derived for each Collection, so the database can enforce real foreign keys without a polymorphic identifier that could point at nothing.

The platform owns the taxonomy tables, tree invariants, slug uniqueness, and typed store interfaces. A Site owns the names and terms it creates, its default Category, Editing Controls, public archives, and presentation.

## Considered Options

- **Declare Category and Tags as ordinary Fields.** Rejected because Category hierarchy, one-per-Entry membership, many Tags, deletion rules, and archive queries are shared publishing semantics rather than Site-specific field shapes.
- **Store term identifiers in JSON arrays on each Entry.** Rejected because SQLite could not enforce that referenced terms exist, prevent duplicates, or efficiently query a Tag archive.
- **Use one polymorphic relation table with Collection and Entry identifiers.** Rejected because SQLite could not attach the Entry identifier to a real foreign key across arbitrary Collection tables.
- **Keep one Category foreign key on each Entry and derive one Tag relation table per Collection** (adopted).

## Consequences

Category becomes a system Field on every Entry. D1 allows 100 columns per table; the platform therefore spends eight columns and a Collection may declare at most 92 Fields.

Sites installed before taxonomy exists need a migration that creates a default Category and assigns every existing Entry before Category membership becomes non-null. The install plan must also seed that Site-owned default for a fresh installation.

A Category cannot become its own descendant. A Category or Tag that is still in use cannot be deleted. Moving terms and replacing Tag membership go through platform stores rather than Site-authored SQL.

Category and Tag archives contain only Entries assigned directly to that term. A Category page may link to its children, but descendants are not silently folded into the parent's result set.
