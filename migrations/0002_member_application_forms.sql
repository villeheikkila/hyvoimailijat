INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
VALUES (
	'emdash-forms',
	'forms',
	'member-application-fi',
	'{"name":"Jäsenhakemus","slug":"member-application-fi","pages":[{"fields":[{"id":"first-name","type":"text","label":"Etunimi","name":"firstName","required":true,"width":"half"},{"id":"last-name","type":"text","label":"Sukunimi","name":"lastName","required":true,"width":"half"},{"id":"email","type":"email","label":"Sähköposti","name":"email","required":true,"width":"half"},{"id":"role","type":"select","label":"Rooli","name":"role","required":true,"width":"half","options":[{"label":"Opiskelija","value":"Opiskelija"},{"label":"Valmistunut","value":"Valmistunut"},{"label":"Muu","value":"Muu"}]},{"id":"school","type":"select","label":"Oppilaitos","name":"school","required":true,"width":"full","options":[{"label":"Helsingin Yliopisto","value":"Helsingin Yliopisto"},{"label":"Aalto Yliopisto","value":"Aalto Yliopisto"},{"label":"Muu","value":"Muu"}]},{"id":"comment","type":"textarea","label":"Kommentti","name":"comment","required":false,"width":"full"},{"id":"locale","type":"hidden","label":"Locale","name":"locale","required":false,"width":"full","defaultValue":"fi"}]}],"settings":{"confirmationMessage":"Hakemus vastaanotettu. Palaamme asiaan sähköpostilla.","notifyEmails":[],"digestEnabled":false,"digestHour":9,"retentionDays":0,"spamProtection":"honeypot","submitLabel":"Lähetä hakemus"},"status":"active","submissionCount":0,"lastSubmissionAt":null,"createdAt":"2026-08-04T00:00:00.000Z","updatedAt":"2026-08-04T00:00:00.000Z"}',
	datetime('now'),
	datetime('now')
)
ON CONFLICT(plugin_id, collection, id) DO UPDATE SET
	data = excluded.data,
	updated_at = datetime('now');

INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
VALUES (
	'emdash-forms',
	'forms',
	'contact-fi',
	'{"name":"Yhteydenotto","slug":"contact-fi","pages":[{"fields":[{"id":"name","type":"text","label":"Nimi","name":"name","required":true,"width":"half"},{"id":"email","type":"email","label":"Sähköposti","name":"email","required":true,"width":"half"},{"id":"subject","type":"text","label":"Aihe","name":"subject","required":false,"width":"full"},{"id":"message","type":"textarea","label":"Viesti","name":"message","required":true,"width":"full","validation":{"minLength":10}},{"id":"locale","type":"hidden","label":"Locale","name":"locale","required":false,"width":"full","defaultValue":"fi"}]}],"settings":{"confirmationMessage":"Viesti vastaanotettu. Palaamme asiaan sähköpostilla.","notifyEmails":[],"digestEnabled":false,"digestHour":9,"retentionDays":0,"spamProtection":"honeypot","submitLabel":"Lähetä viesti"},"status":"active","submissionCount":0,"lastSubmissionAt":null,"createdAt":"2026-08-04T00:00:00.000Z","updatedAt":"2026-08-04T00:00:00.000Z"}',
	datetime('now'),
	datetime('now')
)
ON CONFLICT(plugin_id, collection, id) DO UPDATE SET
	data = excluded.data,
	updated_at = datetime('now');

INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
VALUES (
	'emdash-forms',
	'forms',
	'contact-en',
	'{"name":"Contact","slug":"contact-en","pages":[{"fields":[{"id":"name","type":"text","label":"Name","name":"name","required":true,"width":"half"},{"id":"email","type":"email","label":"Email","name":"email","required":true,"width":"half"},{"id":"subject","type":"text","label":"Subject","name":"subject","required":false,"width":"full"},{"id":"message","type":"textarea","label":"Message","name":"message","required":true,"width":"full","validation":{"minLength":10}},{"id":"locale","type":"hidden","label":"Locale","name":"locale","required":false,"width":"full","defaultValue":"en"}]}],"settings":{"confirmationMessage":"Message received. We will reply by email.","notifyEmails":[],"digestEnabled":false,"digestHour":9,"retentionDays":0,"spamProtection":"honeypot","submitLabel":"Send message"},"status":"active","submissionCount":0,"lastSubmissionAt":null,"createdAt":"2026-08-04T00:00:00.000Z","updatedAt":"2026-08-04T00:00:00.000Z"}',
	datetime('now'),
	datetime('now')
)
ON CONFLICT(plugin_id, collection, id) DO UPDATE SET
	data = excluded.data,
	updated_at = datetime('now');

INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
VALUES (
	'emdash-forms',
	'forms',
	'member-application-en',
	'{"name":"Member application","slug":"member-application-en","pages":[{"fields":[{"id":"first-name","type":"text","label":"First name","name":"firstName","required":true,"width":"half"},{"id":"last-name","type":"text","label":"Last name","name":"lastName","required":true,"width":"half"},{"id":"email","type":"email","label":"Email","name":"email","required":true,"width":"half"},{"id":"role","type":"select","label":"Role","name":"role","required":true,"width":"half","options":[{"label":"Student","value":"Student"},{"label":"Alumnus","value":"Alumnus"},{"label":"Other","value":"Other"}]},{"id":"school","type":"select","label":"School","name":"school","required":true,"width":"full","options":[{"label":"University of Helsinki","value":"University of Helsinki"},{"label":"Aalto University","value":"Aalto University"},{"label":"Other","value":"Other"}]},{"id":"comment","type":"textarea","label":"Comment","name":"comment","required":false,"width":"full"},{"id":"locale","type":"hidden","label":"Locale","name":"locale","required":false,"width":"full","defaultValue":"en"}]}],"settings":{"confirmationMessage":"Application received. We will reply by email.","notifyEmails":[],"digestEnabled":false,"digestHour":9,"retentionDays":0,"spamProtection":"honeypot","submitLabel":"Send application"},"status":"active","submissionCount":0,"lastSubmissionAt":null,"createdAt":"2026-08-04T00:00:00.000Z","updatedAt":"2026-08-04T00:00:00.000Z"}',
	datetime('now'),
	datetime('now')
)
ON CONFLICT(plugin_id, collection, id) DO UPDATE SET
	data = excluded.data,
	updated_at = datetime('now');
