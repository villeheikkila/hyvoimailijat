CREATE TABLE IF NOT EXISTS member_applications (
	id TEXT PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	email TEXT NOT NULL,
	role TEXT NOT NULL,
	school TEXT NOT NULL,
	comment TEXT,
	locale TEXT NOT NULL DEFAULT 'fi',
	status TEXT NOT NULL DEFAULT 'new',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_applications_status_created
	ON member_applications (status, created_at);
