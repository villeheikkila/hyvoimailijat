UPDATE "_emdash_collections"
SET
	"url_pattern" = '/posts/{slug}',
	"has_seo" = 1
WHERE "slug" = 'posts';

UPDATE "_emdash_collections"
SET
	"url_pattern" = '/pages/{slug}',
	"supports" = '["drafts","revisions","search","seo"]',
	"has_seo" = 1
WHERE "slug" = 'pages';

INSERT INTO "_emdash_menus" (
	"id",
	"name",
	"label",
	"locale",
	"translation_group",
	"created_at",
	"updated_at"
)
VALUES
	(
		'hyv-primary-fi',
		'primary-fi',
		'Primary Navigation (Finnish)',
		'fi',
		'hyv-primary',
		CURRENT_TIMESTAMP,
		CURRENT_TIMESTAMP
	),
	(
		'hyv-primary-en',
		'primary-en',
		'Primary Navigation (English)',
		'en',
		'hyv-primary',
		CURRENT_TIMESTAMP,
		CURRENT_TIMESTAMP
	)
ON CONFLICT("name", "locale") DO UPDATE SET
	"id" = excluded."id",
	"label" = excluded."label",
	"translation_group" = excluded."translation_group",
	"updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "_emdash_menu_items"
WHERE "menu_id" IN ('hyv-primary-fi', 'hyv-primary-en');

INSERT INTO "_emdash_menu_items" (
	"id",
	"menu_id",
	"parent_id",
	"sort_order",
	"type",
	"custom_url",
	"label",
	"locale",
	"translation_group",
	"created_at"
)
VALUES
	('hyv-primary-fi-home', 'hyv-primary-fi', NULL, 0, 'custom', '/', 'Etusivu', 'fi', 'hyv-nav-home', CURRENT_TIMESTAMP),
	('hyv-primary-fi-posts', 'hyv-primary-fi', NULL, 1, 'custom', '/posts', 'Uutiset', 'fi', 'hyv-nav-posts', CURRENT_TIMESTAMP),
	('hyv-primary-fi-results', 'hyv-primary-fi', NULL, 2, 'custom', '/tulokset', 'Tulokset', 'fi', 'hyv-nav-results', CURRENT_TIMESTAMP),
	('hyv-primary-fi-rules', 'hyv-primary-fi', NULL, 3, 'custom', '/hyv-voimaliiga-saannot', 'Voimaliiga', 'fi', 'hyv-nav-rules', CURRENT_TIMESTAMP),
	('hyv-primary-fi-about', 'hyv-primary-fi', NULL, 4, 'custom', '/seura', 'Seura', 'fi', 'hyv-nav-about', CURRENT_TIMESTAMP),
	('hyv-primary-fi-join', 'hyv-primary-fi', NULL, 5, 'custom', '/liity-jaseneksi', 'Liity', 'fi', 'hyv-nav-join', CURRENT_TIMESTAMP),
	('hyv-primary-fi-ranking', 'hyv-primary-fi', NULL, 6, 'custom', '/ranking', 'Ranking', 'fi', 'hyv-nav-ranking', CURRENT_TIMESTAMP),
	('hyv-primary-en-home', 'hyv-primary-en', NULL, 0, 'custom', '/en', 'Home', 'en', 'hyv-nav-home', CURRENT_TIMESTAMP),
	('hyv-primary-en-posts', 'hyv-primary-en', NULL, 1, 'custom', '/posts', 'News', 'en', 'hyv-nav-posts', CURRENT_TIMESTAMP),
	('hyv-primary-en-results', 'hyv-primary-en', NULL, 2, 'custom', '/en/results', 'Results', 'en', 'hyv-nav-results', CURRENT_TIMESTAMP),
	('hyv-primary-en-rules', 'hyv-primary-en', NULL, 3, 'custom', '/en/rules', 'Rules', 'en', 'hyv-nav-rules', CURRENT_TIMESTAMP),
	('hyv-primary-en-about', 'hyv-primary-en', NULL, 4, 'custom', '/en/about', 'About', 'en', 'hyv-nav-about', CURRENT_TIMESTAMP),
	('hyv-primary-en-join', 'hyv-primary-en', NULL, 5, 'custom', '/en/become-a-member', 'Join', 'en', 'hyv-nav-join', CURRENT_TIMESTAMP),
	('hyv-primary-en-ranking', 'hyv-primary-en', NULL, 6, 'custom', '/en/ranking', 'Ranking', 'en', 'hyv-nav-ranking', CURRENT_TIMESTAMP);
