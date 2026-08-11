CREATE VIRTUAL TABLE `_jamcaa_post_fts` USING fts5 (
    entry_id UNINDEXED,
    `title`,
    `excerpt`,
    `body`,
    tokenize = 'unicode61 remove_diacritics 2'
);

--> statement-breakpoint
CREATE TRIGGER `_jamcaa_post_fts_ai` AFTER INSERT ON `post` WHEN new.status = 'published' BEGIN
INSERT INTO
    `_jamcaa_post_fts` (rowid, entry_id, `title`, `excerpt`, `body`)
SELECT
    new.rowid,
    new.id,
    coalesce(new."title", ''),
    coalesce(new."excerpt", ''),
    (
        SELECT
            trim(coalesce(group_concat (group_text, char(10)), ''))
        FROM
            (
                SELECT
                    min(position) AS position,
                    group_concat (piece, '') AS group_text
                FROM
                    (
                        SELECT
                            nodes.id AS position,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN nodes.fullkey
                                ELSE nodes.path
                            END AS scope,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'text' THEN coalesce(json_extract (nodes.value, '$.text'), '')
                                WHEN json_extract (nodes.value, '$.type') = 'hardBreak' THEN char(10)
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN coalesce(json_extract (nodes.value, '$.attrs.alt'), '')
                                ELSE ''
                            END AS piece
                        FROM
                            json_tree (new."body") AS nodes
                        WHERE
                            nodes.type = 'object'
                            AND json_extract (nodes.value, '$.type') IN ('text', 'hardBreak', 'mediaImage')
                        ORDER BY
                            nodes.id
                    )
                GROUP BY
                    scope
                ORDER BY
                    position
            )
    );

END;

--> statement-breakpoint
CREATE TRIGGER `_jamcaa_post_fts_ad` AFTER DELETE ON `post` WHEN old.status = 'published' BEGIN
DELETE FROM `_jamcaa_post_fts`
WHERE
    rowid = old.rowid;

END;

--> statement-breakpoint
CREATE TRIGGER `_jamcaa_post_fts_au` AFTER
UPDATE ON `post` BEGIN
DELETE FROM `_jamcaa_post_fts`
WHERE
    rowid = old.rowid;

INSERT INTO
    `_jamcaa_post_fts` (rowid, entry_id, `title`, `excerpt`, `body`)
SELECT
    new.rowid,
    new.id,
    coalesce(new."title", ''),
    coalesce(new."excerpt", ''),
    (
        SELECT
            trim(coalesce(group_concat (group_text, char(10)), ''))
        FROM
            (
                SELECT
                    min(position) AS position,
                    group_concat (piece, '') AS group_text
                FROM
                    (
                        SELECT
                            nodes.id AS position,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN nodes.fullkey
                                ELSE nodes.path
                            END AS scope,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'text' THEN coalesce(json_extract (nodes.value, '$.text'), '')
                                WHEN json_extract (nodes.value, '$.type') = 'hardBreak' THEN char(10)
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN coalesce(json_extract (nodes.value, '$.attrs.alt'), '')
                                ELSE ''
                            END AS piece
                        FROM
                            json_tree (new."body") AS nodes
                        WHERE
                            nodes.type = 'object'
                            AND json_extract (nodes.value, '$.type') IN ('text', 'hardBreak', 'mediaImage')
                        ORDER BY
                            nodes.id
                    )
                GROUP BY
                    scope
                ORDER BY
                    position
            )
    )
WHERE
    new.status = 'published';

END;

--> statement-breakpoint
INSERT INTO
    `_jamcaa_post_fts` (rowid, entry_id, `title`, `excerpt`, `body`)
SELECT
    entry.rowid,
    entry.id,
    coalesce(entry."title", ''),
    coalesce(entry."excerpt", ''),
    (
        SELECT
            trim(coalesce(group_concat (group_text, char(10)), ''))
        FROM
            (
                SELECT
                    min(position) AS position,
                    group_concat (piece, '') AS group_text
                FROM
                    (
                        SELECT
                            nodes.id AS position,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN nodes.fullkey
                                ELSE nodes.path
                            END AS scope,
                            CASE
                                WHEN json_extract (nodes.value, '$.type') = 'text' THEN coalesce(json_extract (nodes.value, '$.text'), '')
                                WHEN json_extract (nodes.value, '$.type') = 'hardBreak' THEN char(10)
                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN coalesce(json_extract (nodes.value, '$.attrs.alt'), '')
                                ELSE ''
                            END AS piece
                        FROM
                            json_tree (entry."body") AS nodes
                        WHERE
                            nodes.type = 'object'
                            AND json_extract (nodes.value, '$.type') IN ('text', 'hardBreak', 'mediaImage')
                        ORDER BY
                            nodes.id
                    )
                GROUP BY
                    scope
                ORDER BY
                    position
            )
    )
FROM
    `post` AS entry
WHERE
    entry.status = 'published';