UPDATE `post`
SET
    `body` = json_object (
        'type',
        'doc',
        'content',
        json_array (
            json_object (
                'type',
                'paragraph',
                'content',
                CASE
                    WHEN length (`body`) = 0 THEN json_array ()
                    ELSE json_array (json_object ('type', 'text', 'text', `body`))
                END
            )
        )
    );