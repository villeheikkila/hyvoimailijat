UPDATE "_emdash_collections"
SET "label" = 'Legacy Events', "label_singular" = 'Legacy Event', "description" = 'Legacy WordPress Events Calendar rows kept for migration reference.'
WHERE "slug" = 'tribe_events';

UPDATE "_emdash_collections"
SET "label" = 'Legacy Venues', "label_singular" = 'Legacy Venue', "description" = 'Legacy WordPress Events Calendar venue rows kept for migration reference.'
WHERE "slug" = 'tribe_venue';

ALTER TABLE "ec_posts" ADD COLUMN "event" TEXT;

CREATE TABLE IF NOT EXISTS "ec_venues" (
	"id" text primary key,
	"slug" text,
	"status" text default 'draft',
	"author_id" text,
	"primary_byline_id" text,
	"created_at" text default (datetime('now')),
	"updated_at" text default (datetime('now')),
	"published_at" text,
	"scheduled_at" text,
	"deleted_at" text,
	"version" integer default 1,
	"live_revision_id" text,
	"draft_revision_id" text,
	"locale" text default 'fi' not null,
	"translation_group" text,
	"title" TEXT NOT NULL DEFAULT '',
	"address" TEXT,
	"city" TEXT,
	"country" TEXT,
	"map_url" TEXT,
	"website_url" TEXT,
	"content" JSON,
	"legacy_wp_id" TEXT,
	constraint "ec_venues_slug_locale_unique" unique ("slug", "locale")
);

CREATE TABLE IF NOT EXISTS "ec_events" (
	"id" text primary key,
	"slug" text,
	"status" text default 'draft',
	"author_id" text,
	"primary_byline_id" text,
	"created_at" text default (datetime('now')),
	"updated_at" text default (datetime('now')),
	"published_at" text,
	"scheduled_at" text,
	"deleted_at" text,
	"version" integer default 1,
	"live_revision_id" text,
	"draft_revision_id" text,
	"locale" text default 'fi' not null,
	"translation_group" text,
	"title" TEXT NOT NULL DEFAULT '',
	"start_at" TEXT NOT NULL,
	"end_at" TEXT,
	"timezone" TEXT,
	"venue" TEXT,
	"event_status" TEXT,
	"event_type" TEXT,
	"summary" TEXT,
	"content" JSON,
	"featured_image" TEXT,
	"registration_url" TEXT,
	"results_url" TEXT,
	"hide_from_upcoming" INTEGER DEFAULT 0,
	"legacy_wp_id" TEXT,
	"legacy_slug" TEXT,
	constraint "ec_events_slug_locale_unique" unique ("slug", "locale")
);

CREATE INDEX IF NOT EXISTS "idx_ec_events_start" ON "ec_events" ("start_at", "id");
CREATE INDEX IF NOT EXISTS "idx_ec_events_status_start" ON "ec_events" ("event_status", "start_at");
CREATE INDEX IF NOT EXISTS "idx_ec_events_venue" ON "ec_events" ("venue");

INSERT INTO "_emdash_collections" ("id", "slug", "label", "label_singular", "description", "icon", "supports", "source", "created_at", "updated_at", "search_config", "has_seo", "url_pattern", "comments_enabled", "comments_moderation", "comments_closed_after_days", "comments_auto_approve_users")
VALUES
	('hyv-collection-events', 'events', 'Events', 'Event', 'Structured club competitions and events.', NULL, '["drafts","revisions","search","seo"]', 'manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{"enabled":true}', 1, '/tapahtumat/{slug}', 0, 'first_time', 90, 1),
	('hyv-collection-venues', 'venues', 'Venues', 'Venue', 'Event venues used by club competitions and events.', NULL, '["drafts","revisions","search"]', 'manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{"enabled":true}', 0, NULL, 0, 'first_time', 90, 1)
ON CONFLICT("slug") DO UPDATE SET
	"label" = excluded."label",
	"label_singular" = excluded."label_singular",
	"description" = excluded."description",
	"supports" = excluded."supports",
	"search_config" = excluded."search_config",
	"has_seo" = excluded."has_seo",
	"url_pattern" = excluded."url_pattern",
	"updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "_emdash_fields" WHERE "collection_id" IN ('hyv-collection-events', 'hyv-collection-venues');
DELETE FROM "_emdash_fields" WHERE "id" = 'hyv-field-posts-event';

INSERT INTO "_emdash_fields" ("id", "collection_id", "slug", "label", "type", "column_type", "required", "unique", "default_value", "validation", "widget", "options", "sort_order", "created_at", "searchable", "translatable")
VALUES
	('hyv-field-posts-event', (SELECT "id" FROM "_emdash_collections" WHERE "slug" = 'posts'), 'event', 'Event', 'reference', 'TEXT', 0, 0, NULL, NULL, 'reference', '{"collection":"events","required":false}', 99, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-venues-title', 'hyv-collection-venues', 'title', 'Title', 'string', 'TEXT', 1, 0, NULL, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-venues-address', 'hyv-collection-venues', 'address', 'Address', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 1, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-venues-city', 'hyv-collection-venues', 'city', 'City', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 2, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-venues-country', 'hyv-collection-venues', 'country', 'Country', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 3, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-venues-map-url', 'hyv-collection-venues', 'map_url', 'Map URL', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 4, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-venues-website-url', 'hyv-collection-venues', 'website_url', 'Website URL', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 5, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-venues-content', 'hyv-collection-venues', 'content', 'Content', 'portableText', 'JSON', 0, 0, NULL, NULL, NULL, NULL, 6, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-venues-legacy-wp-id', 'hyv-collection-venues', 'legacy_wp_id', 'Legacy WordPress ID', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 7, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-title', 'hyv-collection-events', 'title', 'Title', 'string', 'TEXT', 1, 0, NULL, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-events-start-at', 'hyv-collection-events', 'start_at', 'Start Time', 'datetime', 'TEXT', 1, 0, NULL, NULL, 'datetime', NULL, 1, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-end-at', 'hyv-collection-events', 'end_at', 'End Time', 'datetime', 'TEXT', 0, 0, NULL, NULL, 'datetime', NULL, 2, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-timezone', 'hyv-collection-events', 'timezone', 'Timezone', 'string', 'TEXT', 0, 0, '"Europe/Helsinki"', NULL, NULL, NULL, 3, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-venue', 'hyv-collection-events', 'venue', 'Venue', 'reference', 'TEXT', 0, 0, NULL, NULL, 'reference', '{"collection":"venues","required":false}', 4, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-event-status', 'hyv-collection-events', 'event_status', 'Event Status', 'string', 'TEXT', 0, 0, '"scheduled"', NULL, NULL, NULL, 5, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-event-type', 'hyv-collection-events', 'event_type', 'Event Type', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 6, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-events-summary', 'hyv-collection-events', 'summary', 'Summary', 'text', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 7, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-events-content', 'hyv-collection-events', 'content', 'Content', 'portableText', 'JSON', 0, 0, NULL, NULL, NULL, NULL, 8, CURRENT_TIMESTAMP, 1, 1),
	('hyv-field-events-featured-image', 'hyv-collection-events', 'featured_image', 'Featured Image', 'image', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 9, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-events-registration-url', 'hyv-collection-events', 'registration_url', 'Registration URL', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 10, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-events-results-url', 'hyv-collection-events', 'results_url', 'Results URL', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 11, CURRENT_TIMESTAMP, 0, 1),
	('hyv-field-events-hide-upcoming', 'hyv-collection-events', 'hide_from_upcoming', 'Hide from upcoming lists', 'boolean', 'INTEGER', 0, 0, '0', NULL, NULL, NULL, 12, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-legacy-wp-id', 'hyv-collection-events', 'legacy_wp_id', 'Legacy WordPress ID', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 13, CURRENT_TIMESTAMP, 0, 0),
	('hyv-field-events-legacy-slug', 'hyv-collection-events', 'legacy_slug', 'Legacy Slug', 'string', 'TEXT', 0, 0, NULL, NULL, NULL, NULL, 14, CURRENT_TIMESTAMP, 0, 0);

INSERT INTO "ec_venues" ("id", "slug", "status", "author_id", "primary_byline_id", "created_at", "updated_at", "published_at", "scheduled_at", "deleted_at", "version", "live_revision_id", "draft_revision_id", "locale", "translation_group", "title", "address", "city", "country", "map_url", "website_url", "content", "legacy_wp_id")
SELECT "id", "slug", "status", "author_id", "primary_byline_id", "created_at", CURRENT_TIMESTAMP, "published_at", "scheduled_at", "deleted_at", "version", "live_revision_id", "draft_revision_id", 'fi', "id", "title",
	CASE "slug"
		WHEN 'unisport-otahalli' THEN 'Otaranta 6'
		WHEN 'unisport-meilahti' THEN 'Zaidankatu 9'
		WHEN 'unisport-kluuvi-2' THEN 'Yliopistonkatu 4'
	END,
	CASE "slug"
		WHEN 'unisport-otahalli' THEN 'Espoo'
		WHEN 'unisport-meilahti' THEN 'Helsinki'
		WHEN 'unisport-kluuvi-2' THEN 'Helsinki'
	END,
	CASE "slug"
		WHEN 'unisport-otahalli' THEN 'Finland'
		WHEN 'unisport-meilahti' THEN 'Finland'
		WHEN 'unisport-kluuvi-2' THEN 'Finland'
	END,
	CASE "slug"
		WHEN 'unisport-otahalli' THEN ''
		WHEN 'unisport-meilahti' THEN ''
		WHEN 'unisport-kluuvi-2' THEN ''
	END,
	CASE "slug"
		WHEN 'unisport-otahalli' THEN 'https://www.unisport.fi/fi/liikuntakeskukset-ja-aukioloajat/unisport-otaniemi'
		WHEN 'unisport-meilahti' THEN 'https://www.unisport.fi/fi/liikuntakeskukset-ja-aukioloajat/unisport-meilahti'
		WHEN 'unisport-kluuvi-2' THEN 'https://www.unisport.fi/fi/liikuntakeskukset-ja-aukioloajat/unisport-kluuvi'
	END,
	"content",
	CASE "slug"
		WHEN 'unisport-otahalli' THEN '1569'
		WHEN 'unisport-meilahti' THEN '1601'
		WHEN 'unisport-kluuvi-2' THEN '1662'
	END
FROM "ec_tribe_venue"
WHERE "slug" IN ('unisport-otahalli', 'unisport-meilahti', 'unisport-kluuvi-2')
ON CONFLICT("slug", "locale") DO UPDATE SET
	"title" = excluded."title",
	"address" = excluded."address",
	"city" = excluded."city",
	"country" = excluded."country",
	"map_url" = excluded."map_url",
	"website_url" = excluded."website_url",
	"content" = excluded."content",
	"legacy_wp_id" = excluded."legacy_wp_id",
	"updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "ec_events" ("id", "slug", "status", "author_id", "primary_byline_id", "created_at", "updated_at", "published_at", "scheduled_at", "deleted_at", "version", "live_revision_id", "draft_revision_id", "locale", "translation_group", "title", "start_at", "end_at", "timezone", "venue", "event_status", "event_type", "summary", "content", "featured_image", "registration_url", "results_url", "hide_from_upcoming", "legacy_wp_id", "legacy_slug")
SELECT "id", "slug", "status", "author_id", "primary_byline_id", "created_at", CURRENT_TIMESTAMP, "published_at", "scheduled_at", "deleted_at", "version", "live_revision_id", "draft_revision_id", 'fi', "id", "title",
	CASE "slug"
		WHEN 'push-pull' THEN '2019-03-23T10:00:00Z'
		WHEN 'voimanosto' THEN '2019-05-18T09:00:00Z'
		WHEN 'leuanveto' THEN '2019-04-20T09:00:00Z'
		WHEN 'otevoimakolmio-grip-trifecta' THEN '2019-09-14T09:00:00Z'
		WHEN 'pushpull-pull' THEN '2019-10-12T09:00:00Z'
		WHEN 'voimanosto-powerlifting' THEN '2019-12-14T10:00:00Z'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN '2020-01-18T10:00:00Z'
		WHEN 'leuanveto-chinups' THEN '2020-02-15T10:00:00Z'
		WHEN 'soutu-rowing' THEN '2020-03-28T10:00:00Z'
		WHEN 'voimanosto-powerlifting-2' THEN '2020-05-16T09:00:00Z'
		WHEN 'voimamieskisa-strongman-competition' THEN '2020-09-26T09:00:00Z'
		WHEN 'leuanveto-chin-ups' THEN '2020-10-24T09:00:00Z'
		WHEN 'voimanosto-powerlifting-3' THEN '2021-02-21T10:00:00Z'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN '2021-02-20T10:00:00Z'
		WHEN 'sisasoutu-indoor-rowing' THEN '2021-03-27T10:00:00Z'
		WHEN 'voimanosto-powerlifting-4' THEN '2021-05-15T09:00:00Z'
		WHEN 'voimamies-strongman' THEN '2021-09-25T09:00:00Z'
		WHEN 'leuanveto-chinups-2' THEN '2021-10-23T09:00:00Z'
		WHEN 'voimanosto-powerlifting-5' THEN '2021-12-11T10:00:00Z'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN '2022-02-05T10:00:00Z'
		WHEN 'sisasoutu-indoor-rowing-2' THEN '2022-04-16T09:00:00Z'
		WHEN 'voimanosto-powerlifting-6' THEN '2022-05-14T09:00:00Z'
		WHEN 'otevoima' THEN '2023-09-30T05:00:00Z'
		WHEN 'voimanosto-2' THEN '2023-12-09T06:00:00Z'
		WHEN 'sotilaspenkki' THEN '2024-02-10T06:00:00Z'
		WHEN 'leuanveto-2' THEN '2024-04-13T09:30:00Z'
		WHEN 'voimanosto-3' THEN '2024-05-11T05:00:00Z'
	END,
	CASE "slug"
		WHEN 'push-pull' THEN '2019-03-23T14:00:00Z'
		WHEN 'voimanosto' THEN '2019-05-18T13:00:00Z'
		WHEN 'leuanveto' THEN '2019-04-20T13:00:00Z'
		WHEN 'otevoimakolmio-grip-trifecta' THEN '2019-09-14T14:00:00Z'
		WHEN 'pushpull-pull' THEN '2019-10-12T14:00:00Z'
		WHEN 'voimanosto-powerlifting' THEN '2019-12-14T15:00:00Z'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN '2020-01-18T15:00:00Z'
		WHEN 'leuanveto-chinups' THEN '2020-02-15T15:00:00Z'
		WHEN 'soutu-rowing' THEN '2020-03-28T15:00:00Z'
		WHEN 'voimanosto-powerlifting-2' THEN '2020-05-16T14:00:00Z'
		WHEN 'voimamieskisa-strongman-competition' THEN '2020-09-26T14:00:00Z'
		WHEN 'leuanveto-chin-ups' THEN '2020-10-24T14:00:00Z'
		WHEN 'voimanosto-powerlifting-3' THEN '2021-02-21T15:00:00Z'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN '2021-02-20T15:00:00Z'
		WHEN 'sisasoutu-indoor-rowing' THEN '2021-03-27T15:00:00Z'
		WHEN 'voimanosto-powerlifting-4' THEN '2021-05-15T14:00:00Z'
		WHEN 'voimamies-strongman' THEN '2021-09-25T13:00:00Z'
		WHEN 'leuanveto-chinups-2' THEN '2021-10-23T14:00:00Z'
		WHEN 'voimanosto-powerlifting-5' THEN '2021-12-11T15:00:00Z'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN '2022-02-05T15:00:00Z'
		WHEN 'sisasoutu-indoor-rowing-2' THEN '2022-04-16T14:00:00Z'
		WHEN 'voimanosto-powerlifting-6' THEN '2022-05-14T14:00:00Z'
		WHEN 'otevoima' THEN '2023-09-30T14:00:00Z'
		WHEN 'voimanosto-2' THEN '2023-12-09T15:00:00Z'
		WHEN 'sotilaspenkki' THEN '2024-02-10T15:00:00Z'
		WHEN 'leuanveto-2' THEN '2024-04-13T14:00:00Z'
		WHEN 'voimanosto-3' THEN '2024-05-11T14:00:00Z'
	END,
	CASE "slug"
		WHEN 'push-pull' THEN 'Europe/Helsinki'
		WHEN 'voimanosto' THEN 'Europe/Helsinki'
		WHEN 'leuanveto' THEN 'Europe/Helsinki'
		WHEN 'otevoimakolmio-grip-trifecta' THEN 'Europe/Helsinki'
		WHEN 'pushpull-pull' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting' THEN 'Europe/Helsinki'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN 'Europe/Helsinki'
		WHEN 'leuanveto-chinups' THEN 'Europe/Helsinki'
		WHEN 'soutu-rowing' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting-2' THEN 'Europe/Helsinki'
		WHEN 'voimamieskisa-strongman-competition' THEN 'Europe/Helsinki'
		WHEN 'leuanveto-chin-ups' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting-3' THEN 'Europe/Helsinki'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN 'Europe/Helsinki'
		WHEN 'sisasoutu-indoor-rowing' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting-4' THEN 'Europe/Helsinki'
		WHEN 'voimamies-strongman' THEN 'Europe/Helsinki'
		WHEN 'leuanveto-chinups-2' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting-5' THEN 'Europe/Helsinki'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN 'Europe/Helsinki'
		WHEN 'sisasoutu-indoor-rowing-2' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-powerlifting-6' THEN 'Europe/Helsinki'
		WHEN 'otevoima' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-2' THEN 'Europe/Helsinki'
		WHEN 'sotilaspenkki' THEN 'Europe/Helsinki'
		WHEN 'leuanveto-2' THEN 'Europe/Helsinki'
		WHEN 'voimanosto-3' THEN 'Europe/Helsinki'
	END,
	CASE "slug"
		WHEN 'push-pull' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'voimanosto' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'leuanveto' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'otevoimakolmio-grip-trifecta' THEN '01KZ3GFRC4HGXR9V1T11X6NZ6P'
		WHEN 'pushpull-pull' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'voimanosto-powerlifting' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'leuanveto-chinups' THEN '01KZ3GFRC4HGXR9V1T11X6NZ6P'
		WHEN 'soutu-rowing' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'voimanosto-powerlifting-2' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'voimamieskisa-strongman-competition' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'leuanveto-chin-ups' THEN '01KZ3GFRC4HGXR9V1T11X6NZ6P'
		WHEN 'voimanosto-powerlifting-3' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'sisasoutu-indoor-rowing' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'voimanosto-powerlifting-4' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'voimamies-strongman' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'leuanveto-chinups-2' THEN NULL
		WHEN 'voimanosto-powerlifting-5' THEN NULL
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN NULL
		WHEN 'sisasoutu-indoor-rowing-2' THEN NULL
		WHEN 'voimanosto-powerlifting-6' THEN NULL
		WHEN 'otevoima' THEN '01KZ3GFQHGXSR4RPWSK14K0MP4'
		WHEN 'voimanosto-2' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'sotilaspenkki' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
		WHEN 'leuanveto-2' THEN '01KZ3GFRC4HGXR9V1T11X6NZ6P'
		WHEN 'voimanosto-3' THEN '01KZ3GFPQHJ6MTK9Z1DZB2CQRG'
	END,
	CASE "slug"
		WHEN 'push-pull' THEN 'completed'
		WHEN 'voimanosto' THEN 'completed'
		WHEN 'leuanveto' THEN 'completed'
		WHEN 'otevoimakolmio-grip-trifecta' THEN 'completed'
		WHEN 'pushpull-pull' THEN 'completed'
		WHEN 'voimanosto-powerlifting' THEN 'completed'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN 'completed'
		WHEN 'leuanveto-chinups' THEN 'completed'
		WHEN 'soutu-rowing' THEN 'cancelled'
		WHEN 'voimanosto-powerlifting-2' THEN 'completed'
		WHEN 'voimamieskisa-strongman-competition' THEN 'completed'
		WHEN 'leuanveto-chin-ups' THEN 'completed'
		WHEN 'voimanosto-powerlifting-3' THEN 'completed'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN 'completed'
		WHEN 'sisasoutu-indoor-rowing' THEN 'completed'
		WHEN 'voimanosto-powerlifting-4' THEN 'completed'
		WHEN 'voimamies-strongman' THEN 'completed'
		WHEN 'leuanveto-chinups-2' THEN 'completed'
		WHEN 'voimanosto-powerlifting-5' THEN 'completed'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN 'completed'
		WHEN 'sisasoutu-indoor-rowing-2' THEN 'cancelled'
		WHEN 'voimanosto-powerlifting-6' THEN 'completed'
		WHEN 'otevoima' THEN 'completed'
		WHEN 'voimanosto-2' THEN 'completed'
		WHEN 'sotilaspenkki' THEN 'completed'
		WHEN 'leuanveto-2' THEN 'completed'
		WHEN 'voimanosto-3' THEN 'completed'
	END,
	CASE "slug"
		WHEN 'push-pull' THEN 'push-pull'
		WHEN 'voimanosto' THEN 'voimanosto'
		WHEN 'leuanveto' THEN 'leuanveto'
		WHEN 'otevoimakolmio-grip-trifecta' THEN 'otevoima'
		WHEN 'pushpull-pull' THEN 'push-pull'
		WHEN 'voimanosto-powerlifting' THEN 'voimanosto'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN 'sotilaspenkki'
		WHEN 'leuanveto-chinups' THEN 'leuanveto'
		WHEN 'soutu-rowing' THEN 'soutu'
		WHEN 'voimanosto-powerlifting-2' THEN 'voimanosto'
		WHEN 'voimamieskisa-strongman-competition' THEN 'voimamies'
		WHEN 'leuanveto-chin-ups' THEN 'leuanveto'
		WHEN 'voimanosto-powerlifting-3' THEN 'voimanosto'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN 'sotilaspenkki'
		WHEN 'sisasoutu-indoor-rowing' THEN 'soutu'
		WHEN 'voimanosto-powerlifting-4' THEN 'voimanosto'
		WHEN 'voimamies-strongman' THEN 'voimamies'
		WHEN 'leuanveto-chinups-2' THEN 'leuanveto'
		WHEN 'voimanosto-powerlifting-5' THEN 'voimanosto'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN 'sotilaspenkki'
		WHEN 'sisasoutu-indoor-rowing-2' THEN 'soutu'
		WHEN 'voimanosto-powerlifting-6' THEN 'voimanosto'
		WHEN 'otevoima' THEN 'otevoima'
		WHEN 'voimanosto-2' THEN 'voimanosto'
		WHEN 'sotilaspenkki' THEN 'sotilaspenkki'
		WHEN 'leuanveto-2' THEN 'leuanveto'
		WHEN 'voimanosto-3' THEN 'voimanosto'
	END,
	"excerpt", "content", "featured_image",
	CASE "slug"
		WHEN 'push-pull' THEN ''
		WHEN 'voimanosto' THEN ''
		WHEN 'leuanveto' THEN ''
		WHEN 'otevoimakolmio-grip-trifecta' THEN ''
		WHEN 'pushpull-pull' THEN ''
		WHEN 'voimanosto-powerlifting' THEN ''
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN ''
		WHEN 'leuanveto-chinups' THEN ''
		WHEN 'soutu-rowing' THEN ''
		WHEN 'voimanosto-powerlifting-2' THEN ''
		WHEN 'voimamieskisa-strongman-competition' THEN ''
		WHEN 'leuanveto-chin-ups' THEN ''
		WHEN 'voimanosto-powerlifting-3' THEN ''
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN ''
		WHEN 'sisasoutu-indoor-rowing' THEN ''
		WHEN 'voimanosto-powerlifting-4' THEN ''
		WHEN 'voimamies-strongman' THEN ''
		WHEN 'leuanveto-chinups-2' THEN ''
		WHEN 'voimanosto-powerlifting-5' THEN ''
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN ''
		WHEN 'sisasoutu-indoor-rowing-2' THEN ''
		WHEN 'voimanosto-powerlifting-6' THEN ''
		WHEN 'otevoima' THEN ''
		WHEN 'voimanosto-2' THEN ''
		WHEN 'sotilaspenkki' THEN ''
		WHEN 'leuanveto-2' THEN ''
		WHEN 'voimanosto-3' THEN ''
	END,
	NULL,
	CASE "slug"
		WHEN 'push-pull' THEN 0
		WHEN 'voimanosto' THEN 0
		WHEN 'leuanveto' THEN 0
		WHEN 'otevoimakolmio-grip-trifecta' THEN 0
		WHEN 'pushpull-pull' THEN 0
		WHEN 'voimanosto-powerlifting' THEN 0
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN 0
		WHEN 'leuanveto-chinups' THEN 0
		WHEN 'soutu-rowing' THEN 0
		WHEN 'voimanosto-powerlifting-2' THEN 0
		WHEN 'voimamieskisa-strongman-competition' THEN 0
		WHEN 'leuanveto-chin-ups' THEN 0
		WHEN 'voimanosto-powerlifting-3' THEN 0
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN 0
		WHEN 'sisasoutu-indoor-rowing' THEN 1
		WHEN 'voimanosto-powerlifting-4' THEN 0
		WHEN 'voimamies-strongman' THEN 0
		WHEN 'leuanveto-chinups-2' THEN 0
		WHEN 'voimanosto-powerlifting-5' THEN 1
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN 1
		WHEN 'sisasoutu-indoor-rowing-2' THEN 1
		WHEN 'voimanosto-powerlifting-6' THEN 0
		WHEN 'otevoima' THEN 0
		WHEN 'voimanosto-2' THEN 0
		WHEN 'sotilaspenkki' THEN 0
		WHEN 'leuanveto-2' THEN 0
		WHEN 'voimanosto-3' THEN 0
	END,
	CASE "slug"
		WHEN 'push-pull' THEN '1567'
		WHEN 'voimanosto' THEN '1597'
		WHEN 'leuanveto' THEN '1599'
		WHEN 'otevoimakolmio-grip-trifecta' THEN '1658'
		WHEN 'pushpull-pull' THEN '1664'
		WHEN 'voimanosto-powerlifting' THEN '1667'
		WHEN 'sotilaspenkki-feet-up-benchpress' THEN '1669'
		WHEN 'leuanveto-chinups' THEN '1671'
		WHEN 'soutu-rowing' THEN '1673'
		WHEN 'voimanosto-powerlifting-2' THEN '1675'
		WHEN 'voimamieskisa-strongman-competition' THEN '1877'
		WHEN 'leuanveto-chin-ups' THEN '1880'
		WHEN 'voimanosto-powerlifting-3' THEN '1882'
		WHEN 'sotilaspenkki-feet-up-bench-press' THEN '1884'
		WHEN 'sisasoutu-indoor-rowing' THEN '1886'
		WHEN 'voimanosto-powerlifting-4' THEN '1888'
		WHEN 'voimamies-strongman' THEN '1963'
		WHEN 'leuanveto-chinups-2' THEN '1965'
		WHEN 'voimanosto-powerlifting-5' THEN '1967'
		WHEN 'sotilaspenkki-feet-up-benchpress-2' THEN '1969'
		WHEN 'sisasoutu-indoor-rowing-2' THEN '1971'
		WHEN 'voimanosto-powerlifting-6' THEN '1973'
		WHEN 'otevoima' THEN '2035'
		WHEN 'voimanosto-2' THEN '2037'
		WHEN 'sotilaspenkki' THEN '2039'
		WHEN 'leuanveto-2' THEN '2041'
		WHEN 'voimanosto-3' THEN '2043'
	END,
	"slug"
FROM "ec_tribe_events"
WHERE "slug" IN ('push-pull', 'voimanosto', 'leuanveto', 'otevoimakolmio-grip-trifecta', 'pushpull-pull', 'voimanosto-powerlifting', 'sotilaspenkki-feet-up-benchpress', 'leuanveto-chinups', 'soutu-rowing', 'voimanosto-powerlifting-2', 'voimamieskisa-strongman-competition', 'leuanveto-chin-ups', 'voimanosto-powerlifting-3', 'sotilaspenkki-feet-up-bench-press', 'sisasoutu-indoor-rowing', 'voimanosto-powerlifting-4', 'voimamies-strongman', 'leuanveto-chinups-2', 'voimanosto-powerlifting-5', 'sotilaspenkki-feet-up-benchpress-2', 'sisasoutu-indoor-rowing-2', 'voimanosto-powerlifting-6', 'otevoima', 'voimanosto-2', 'sotilaspenkki', 'leuanveto-2', 'voimanosto-3')
ON CONFLICT("slug", "locale") DO UPDATE SET
	"title" = excluded."title",
	"start_at" = excluded."start_at",
	"end_at" = excluded."end_at",
	"timezone" = excluded."timezone",
	"venue" = excluded."venue",
	"event_status" = excluded."event_status",
	"event_type" = excluded."event_type",
	"summary" = excluded."summary",
	"content" = excluded."content",
	"featured_image" = excluded."featured_image",
	"registration_url" = excluded."registration_url",
	"results_url" = excluded."results_url",
	"hide_from_upcoming" = excluded."hide_from_upcoming",
	"legacy_wp_id" = excluded."legacy_wp_id",
	"legacy_slug" = excluded."legacy_slug",
	"updated_at" = CURRENT_TIMESTAMP;

UPDATE "ec_posts"
SET "event" = CASE "slug"
	WHEN 'voimaliigan-osakilpailu-push-pull' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'push-pull' AND "locale" = 'fi')
	WHEN 'kella-levein-selka' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'leuanveto' AND "locale" = 'fi')
	WHEN 'kausi-alkuun-otevoimailulla' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'otevoimakolmio-grip-trifecta' AND "locale" = 'fi')
	WHEN 'myotaotehauiskaantoa-otahallilla-12-10-2019' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'pushpull-pull' AND "locale" = 'fi')
	WHEN 'joulukisa-otahallilla-video' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'voimanosto-powerlifting' AND "locale" = 'fi')
	WHEN 'sotilaspenkkikisa-miesvaltainen-ala' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'sotilaspenkki-feet-up-benchpress' AND "locale" = 'fi')
	WHEN 'leuanvetokisa-molya-ja-polya-kluuvissa' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'leuanveto-chinups' AND "locale" = 'fi')
	WHEN 'kahden-kisan-verran-penkkitiedotettavaa' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'sotilaspenkki' AND "locale" = 'fi')
	WHEN 'klassinen-leuanveto-kluuvin-unisportilla' THEN (SELECT "id" FROM "ec_events" WHERE "slug" = 'leuanveto-2' AND "locale" = 'fi')
	ELSE "event"
END
WHERE "slug" IN (
	'voimaliigan-osakilpailu-push-pull',
	'kella-levein-selka',
	'kausi-alkuun-otevoimailulla',
	'myotaotehauiskaantoa-otahallilla-12-10-2019',
	'joulukisa-otahallilla-video',
	'sotilaspenkkikisa-miesvaltainen-ala',
	'leuanvetokisa-molya-ja-polya-kluuvissa',
	'kahden-kisan-verran-penkkitiedotettavaa',
	'klassinen-leuanveto-kluuvin-unisportilla'
);

INSERT INTO "_emdash_menu_items" ("id", "menu_id", "parent_id", "sort_order", "type", "custom_url", "label", "locale", "translation_group", "created_at")
VALUES
	('hyv-primary-fi-events', 'hyv-primary-fi', NULL, 2, 'custom', '/tapahtumat', 'Tapahtumat', 'fi', 'hyv-nav-events', CURRENT_TIMESTAMP),
	('hyv-primary-en-events', 'hyv-primary-en', NULL, 2, 'custom', '/en/events', 'Events', 'en', 'hyv-nav-events', CURRENT_TIMESTAMP)
ON CONFLICT("id") DO UPDATE SET
	"custom_url" = excluded."custom_url",
	"label" = excluded."label",
	"sort_order" = excluded."sort_order";

UPDATE "_emdash_menu_items" SET "sort_order" = 3 WHERE "id" IN ('hyv-primary-fi-results', 'hyv-primary-en-results');
UPDATE "_emdash_menu_items" SET "sort_order" = 4 WHERE "id" IN ('hyv-primary-fi-rules', 'hyv-primary-en-rules');
UPDATE "_emdash_menu_items" SET "sort_order" = 5 WHERE "id" IN ('hyv-primary-fi-about', 'hyv-primary-en-about');
UPDATE "_emdash_menu_items" SET "sort_order" = 6 WHERE "id" IN ('hyv-primary-fi-join', 'hyv-primary-en-join');
UPDATE "_emdash_menu_items" SET "sort_order" = 7 WHERE "id" IN ('hyv-primary-fi-ranking', 'hyv-primary-en-ranking');
