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
                        group_concat (nodes.value, ' ')
                FROM
                        json_tree (`post`.`body__value`, '$.blocks[0].props.document') AS nodes
                WHERE
                        nodes.type = 'text'
                        AND (
                                nodes.key = 'alt'
                                OR typeof (nodes.key) = 'integer'
                        )
        )
WHERE
        `body__value` IS NOT NULL;

DROP TRIGGER `_jamcaa_post_fts_ai`;
DROP TRIGGER `_jamcaa_post_fts_ad`;
DROP TRIGGER `_jamcaa_post_fts_au`;
DROP TABLE `_jamcaa_post_fts`;

ALTER TABLE `post` DROP COLUMN `body`;
