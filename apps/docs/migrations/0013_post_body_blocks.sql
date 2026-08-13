ALTER TABLE `post` ADD `body__value` text;
ALTER TABLE `post` ADD `body__plain` text;

UPDATE `post`
SET
        `body__value` = json_object (
                'version',
                1,
                'blocks',
                json_array (
                        json_object (
                                'id',
                                'legacy-body',
                                'type',
                                'builtin.richText',
                                'props',
                                json_object ('document', json (`body`))
                        )
                )
        )
WHERE
        `body` IS NOT NULL
        AND length (`body`) > 0;

UPDATE `post`
SET
        `body__plain` = (
                SELECT
                        group_concat (piece, ' ')
                FROM
                        (
                                SELECT
                                        CASE
                                                WHEN json_extract (nodes.value, '$.type') = 'text' THEN coalesce(json_extract (nodes.value, '$.text'), '')
                                                WHEN json_extract (nodes.value, '$.type') = 'hardBreak' THEN ' '
                                                WHEN json_extract (nodes.value, '$.type') = 'mediaImage' THEN coalesce(json_extract (nodes.value, '$.attrs.alt'), '')
                                                ELSE NULL
                                        END AS piece
                                FROM
                                        json_tree (`post`.`body__value`, '$.blocks[0].props.document') AS nodes
                                WHERE
                                        nodes.type = 'object'
                                        AND json_extract (nodes.value, '$.type') IN ('text', 'hardBreak', 'mediaImage')
                        )
                WHERE
                        piece IS NOT NULL
                        AND piece <> ''
        )
WHERE
        `body__value` IS NOT NULL;

DROP TRIGGER `_jamcaa_post_fts_ai`;
DROP TRIGGER `_jamcaa_post_fts_ad`;
DROP TRIGGER `_jamcaa_post_fts_au`;
DROP TABLE `_jamcaa_post_fts`;

ALTER TABLE `post` DROP COLUMN `body`;
