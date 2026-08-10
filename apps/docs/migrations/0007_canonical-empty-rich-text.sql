UPDATE `post`
SET
	`body` = json_set (
		`body`,
		'$.content[0]',
		json_object ('type', 'paragraph')
	)
WHERE
	json_extract (`body`, '$.type') = 'doc'
	AND json_array_length (json_extract (`body`, '$.content')) = 1
	AND json_extract (`body`, '$.content[0].type') = 'paragraph'
	AND json_array_length (json_extract (`body`, '$.content[0].content')) = 0;