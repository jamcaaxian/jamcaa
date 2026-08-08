# Interface copy is localised; content fields are not

Interface copy is available in several languages, but an entry itself exists in exactly one version — no per-language variants of titles, bodies, or other fields.

This "no" is recorded because it is not cheaply reversible in the data model: field-level localisation requires content tables to be laid out along a language dimension from the outset, and retrofitting it amounts to rebuilding both the schema and the entire editing interface. Most sites do not need their bodies authored per language, and paying that complexity up front for a requirement that has not appeared is a poor trade.

## Consequences

The content schema should leave room for a language dimension later, but the first version implements no translation editor, translation progress tracking, or fallback strategy in the admin interface.
