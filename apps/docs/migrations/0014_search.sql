CREATE VIRTUAL TABLE "_jamcaa_post_fts" USING fts5(
    entry_id UNINDEXED,
    "title",
    "excerpt",
    "body",
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER "_jamcaa_post_fts_ai" AFTER INSERT ON "post"
WHEN new.status = 'published'
BEGIN
    INSERT INTO "_jamcaa_post_fts"(rowid, entry_id, "title", "excerpt", "body")
    SELECT new.rowid,
        new.id,
            coalesce(new."title", ''),
            coalesce(new."excerpt", ''),
            coalesce(new."body__plain", '');
END;

CREATE TRIGGER "_jamcaa_post_fts_ad" AFTER DELETE ON "post"
WHEN old.status = 'published'
BEGIN
    DELETE FROM "_jamcaa_post_fts" WHERE rowid = old.rowid;
END;

CREATE TRIGGER "_jamcaa_post_fts_au" AFTER UPDATE ON "post"
BEGIN
    DELETE FROM "_jamcaa_post_fts" WHERE rowid = old.rowid;
    INSERT INTO "_jamcaa_post_fts"(rowid, entry_id, "title", "excerpt", "body")
    SELECT new.rowid,
        new.id,
            coalesce(new."title", ''),
            coalesce(new."excerpt", ''),
            coalesce(new."body__plain", '')
    WHERE new.status = 'published';
END;

INSERT INTO "_jamcaa_post_fts"(rowid, entry_id, "title", "excerpt", "body")
SELECT entry.rowid,
        entry.id,
        coalesce(entry."title", ''),
        coalesce(entry."excerpt", ''),
        coalesce(entry."body__plain", '')
FROM "post" AS entry
WHERE entry.status = 'published';