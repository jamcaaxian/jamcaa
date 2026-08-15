import type { Collection } from "../content/collection";
import { searchProjectionSql } from "./projection";

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
}

export function searchTableName(collection: Collection): string {
    if (collection.search === undefined) {
        throw new Error(`Collection "${collection.name}" has no search declaration.`);
    }

    return `_jamcaa_${collection.name}_fts`;
}

export function searchMigrationSql(collection: Collection): string {
    const entryTable = quoteIdentifier(collection.name);
    const ftsTableName = searchTableName(collection);
    const ftsTable = quoteIdentifier(ftsTableName);
    const searchableColumns = collection.search!.fields.map(fieldName => quoteIdentifier(fieldName));
    const entryProjection = searchProjectionSql(collection, "entry");
    const newProjection = searchProjectionSql(collection, "new");
    const insertColumns = ["entry_id", "locale", ...searchableColumns].join(", ");
    const selectProjection = ["entry.id", "entry.locale", ...entryProjection].join(",\n        ");
    const insertValues = ["new.id", "new.locale", ...newProjection].join(",\n            ");
    const prefix = `_jamcaa_${collection.name}_fts`;

    return `CREATE VIRTUAL TABLE ${ftsTable} USING fts5(
    entry_id UNINDEXED,
    locale UNINDEXED,
    ${searchableColumns.join(",\n    ")},
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER ${quoteIdentifier(`${prefix}_ai`)} AFTER INSERT ON ${entryTable}
WHEN new.status = 'published'
BEGIN
    INSERT INTO ${ftsTable}(rowid, ${insertColumns})
    SELECT new.rowid,
        ${insertValues};
END;

CREATE TRIGGER ${quoteIdentifier(`${prefix}_ad`)} AFTER DELETE ON ${entryTable}
WHEN old.status = 'published'
BEGIN
    DELETE FROM ${ftsTable} WHERE rowid = old.rowid;
END;

CREATE TRIGGER ${quoteIdentifier(`${prefix}_au`)} AFTER UPDATE ON ${entryTable}
BEGIN
    DELETE FROM ${ftsTable} WHERE rowid = old.rowid;
    INSERT INTO ${ftsTable}(rowid, ${insertColumns})
    SELECT new.rowid,
        ${insertValues}
    WHERE new.status = 'published';
END;

INSERT INTO ${ftsTable}(rowid, ${insertColumns})
SELECT entry.rowid,
        ${selectProjection}
FROM ${entryTable} AS entry
WHERE entry.status = 'published';`;
}
