#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const defaultDb =
	".wrangler/state/v3/d1/miniflare-D1DatabaseObject/eb117ab9ab9ebfd940833ca01754bacf8d63c72ee38ad9756b1d7a8f63e0a659.sqlite";
const argv = process.argv.slice(2);
const dbPath = readArg("--db") ?? defaultDb;
const writeSqlPath = readArg("--write-sql");
const apply = argv.includes("--apply");
const help = argv.includes("--help") || argv.includes("-h");

if (help) {
	console.log(`Rewrite imported WordPress media URLs to EmDash media URLs.

The generated URLs are root-relative, so they work on localhost, staging, and production.

Usage:
  node scripts/rewrite-wordpress-media-links.mjs
  node scripts/rewrite-wordpress-media-links.mjs --write-sql=migrations/0004_rewrite_wordpress_media_links.sql
  node scripts/rewrite-wordpress-media-links.mjs --apply

Options:
  --db=PATH          Local SQLite D1 database path.
  --write-sql=PATH  Write SQL UPDATE statements for changed rows.
  --apply           Apply generated updates directly to the local database.
`);
	process.exit(0);
}

const contentTargets = [
	{ table: "ec_pages", columns: ["content", "featured_image"] },
	{ table: "ec_posts", columns: ["content", "featured_image"] },
	{ table: "ec_tribe_events", columns: ["content", "featured_image"] },
	{ table: "ec_tablepress_table", columns: ["content"] },
	{ table: "ec_action_monitor", columns: ["content"] },
];

const wordpressMediaUrlPattern =
	/https?:\/\/hyvoimailijat\.com\/Wordpress\/wordpress\/wp-content\/uploads\/\d{4}\/\d{2}\/[^\s"'<>\\)]+/gi;

function readArg(name) {
	const prefix = `${name}=`;
	const value = argv.find((arg) => arg.startsWith(prefix));
	return value ? value.slice(prefix.length) : undefined;
}

function runSql(sql, { json = false } = {}) {
	const args = [dbPath];
	if (json) args.unshift("-json");
	args.push(sql);
	const result = spawnSync("sqlite3", args, {
		encoding: "utf8",
		maxBuffer: 200 * 1024 * 1024,
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || `sqlite3 failed with status ${result.status}`);
	}
	return result.stdout;
}

function sqlString(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlIdent(value) {
	return `"${String(value).replaceAll('"', '""')}"`;
}

function safeDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function basenameFromUrl(url) {
	try {
		const parsed = new URL(url);
		const parts = parsed.pathname.split("/");
		return parts.at(-1) ?? "";
	} catch {
		const clean = url.split(/[?#]/, 1)[0];
		const parts = clean.split("/");
		return parts.at(-1) ?? "";
	}
}

function mediaKey(filename) {
	return safeDecode(filename).normalize("NFC").toLocaleLowerCase("fi-FI");
}

function filenameParts(filename) {
	const extensionIndex = filename.lastIndexOf(".");
	if (extensionIndex === -1) return { stem: filename, extension: "" };
	return {
		stem: filename.slice(0, extensionIndex),
		extension: filename.slice(extensionIndex),
	};
}

function wordpressFilenameVariants(filename) {
	const decoded = safeDecode(filename);
	const variants = new Set([filename, decoded]);
	const { stem, extension } = filenameParts(decoded);
	const withoutSize = stem.replace(/-\d+x\d+$/, "");
	if (withoutSize !== stem) {
		variants.add(`${withoutSize}${extension}`);
		variants.add(`${withoutSize}-scaled${extension}`);
		const withoutCopySuffix = withoutSize.replace(/-\d+$/, "");
		if (withoutCopySuffix !== withoutSize) {
			variants.add(`${withoutCopySuffix}${extension}`);
			variants.add(`${withoutCopySuffix}-scaled${extension}`);
		}
	}
	const withoutScaled = stem.replace(/-scaled$/, "");
	if (withoutScaled !== stem) {
		variants.add(`${withoutScaled}${extension}`);
	}
	return [...variants];
}

function uniqueMedia(items) {
	const seen = new Set();
	const unique = [];
	for (const item of items) {
		if (seen.has(item.storage_key)) continue;
		seen.add(item.storage_key);
		unique.push(item);
	}
	return unique;
}

function loadMediaIndex() {
	const media = JSON.parse(
		runSql(`SELECT id, filename, storage_key FROM media ORDER BY created_at, id;`, {
			json: true,
		}) || "[]"
	);
	const byFilename = new Map();

	for (const item of media) {
		const keys = new Set();
		for (const variant of wordpressFilenameVariants(item.filename)) {
			keys.add(mediaKey(variant));
			keys.add(mediaKey(encodeURIComponent(variant)));
		}
		for (const key of keys) {
			const existing = byFilename.get(key) ?? [];
			existing.push(item);
			byFilename.set(key, existing);
		}
	}

	return byFilename;
}

function loadRows() {
	const rows = [];
	for (const target of contentTargets) {
		const columnExpr = target.columns.map((column) => `${sqlIdent(column)} LIKE '%hyvoimailijat.com/Wordpress/wordpress/wp-content/uploads/%'`).join(" OR ");
		const columns = ["id", "slug", "title", ...target.columns].map(sqlIdent).join(", ");
		const tableRows = JSON.parse(
			runSql(`SELECT ${columns} FROM ${sqlIdent(target.table)} WHERE ${columnExpr};`, {
				json: true,
			}) || "[]"
		);
		for (const row of tableRows) {
			rows.push({ ...row, table: target.table, columns: target.columns });
		}
	}

	const revisions = JSON.parse(
		runSql(`SELECT id, collection, entry_id, data FROM revisions WHERE data LIKE '%hyvoimailijat.com/Wordpress/wordpress/wp-content/uploads/%';`, {
			json: true,
		}) || "[]"
	);
	rows.push(...revisions.map((row) => ({ ...row, table: "revisions", columns: ["data"] })));
	return rows;
}

function parseJsonMaybe(value) {
	if (value === null || value === undefined || value === "") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function collectReferencedMedia(value, refs = new Set()) {
	if (!value || typeof value !== "object") return refs;
	if (Array.isArray(value)) {
		for (const item of value) collectReferencedMedia(item, refs);
		return refs;
	}
	const ref = value.asset?._ref ?? value.asset?.url ?? value._ref ?? value.url;
	if (typeof ref === "string" && ref.startsWith("/_emdash/api/media/file/")) {
		refs.add(ref);
	}
	for (const child of Object.values(value)) collectReferencedMedia(child, refs);
	return refs;
}

function resolveMediaUrl(url, byFilename, referencedMedia) {
	const basename = basenameFromUrl(url);
	const candidates = uniqueMedia(
		wordpressFilenameVariants(basename).flatMap((variant) => byFilename.get(mediaKey(variant)) ?? [])
	);
	if (candidates.length === 0) return { status: "missing", basename };
	if (candidates.length === 1) {
		return { status: "resolved", basename, url: `/_emdash/api/media/file/${candidates[0].storage_key}` };
	}

	const referencedCandidates = candidates.filter((candidate) =>
		referencedMedia.has(`/_emdash/api/media/file/${candidate.storage_key}`)
	);
	if (referencedCandidates.length === 1) {
		return {
			status: "resolved",
			basename,
			url: `/_emdash/api/media/file/${referencedCandidates[0].storage_key}`,
		};
	}

	return {
		status: "ambiguous",
		basename,
		candidates: candidates.map((candidate) => candidate.storage_key),
	};
}

function rewriteString(value, context) {
	return value.replace(wordpressMediaUrlPattern, (url) => {
		const resolved = resolveMediaUrl(url, context.byFilename, context.referencedMedia);
		if (resolved.status !== "resolved") {
			const key = `${resolved.status}:${url}`;
			if (!context.unresolved.has(key)) {
				context.unresolved.set(key, { url, ...resolved });
			}
			return url;
		}

		context.replacements.push({ from: url, to: resolved.url, basename: resolved.basename });
		return resolved.url;
	});
}

function rewriteValue(value, context) {
	if (typeof value === "string") return rewriteString(value, context);
	if (!value || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => rewriteValue(item, context));

	let changed = false;
	const next = {};
	for (const [key, child] of Object.entries(value)) {
		const rewritten = rewriteValue(child, context);
		next[key] = rewritten;
		if (rewritten !== child) changed = true;
	}
	return changed ? next : value;
}

function serializeParsed(original, parsed) {
	if (parsed === original) return original;
	if (typeof parsed === "string") return parsed;
	return JSON.stringify(parsed);
}

const byFilename = loadMediaIndex();
const updates = [];
const stats = {
	rowsScanned: 0,
	rowsChanged: 0,
	urlsRewritten: 0,
	missingUrls: 0,
	ambiguousUrls: 0,
};
const unresolved = new Map();

for (const row of loadRows()) {
	stats.rowsScanned += 1;
	const parsedColumns = new Map();
	const referencedMedia = new Set();

	for (const column of row.columns) {
		const parsed = parseJsonMaybe(row[column]);
		parsedColumns.set(column, parsed);
		collectReferencedMedia(parsed, referencedMedia);
	}

	for (const column of row.columns) {
		const parsed = parsedColumns.get(column);
		const before = serializeParsed(row[column], parsed);
		const context = { byFilename, referencedMedia, replacements: [], unresolved };
		const rewritten = rewriteValue(parsed, context);
		const after = serializeParsed(row[column], rewritten);
		if (after === before) continue;

		stats.rowsChanged += 1;
		stats.urlsRewritten += context.replacements.length;
		updates.push({
			table: row.table,
			column,
			id: row.id,
			label: row.slug ?? `${row.collection}:${row.entry_id}`,
			value: after,
			replacements: context.replacements,
		});
	}
}

for (const item of unresolved.values()) {
	if (item.status === "missing") stats.missingUrls += 1;
	if (item.status === "ambiguous") stats.ambiguousUrls += 1;
}

const statements = [
	"BEGIN TRANSACTION;",
	...updates.map(
		(update) =>
			`UPDATE ${sqlIdent(update.table)} SET ${sqlIdent(update.column)} = ${sqlString(update.value)} WHERE id = ${sqlString(update.id)};`
	),
	"COMMIT;",
	"",
].join("\n");

console.log(
	JSON.stringify(
		{
			...stats,
			updatedRows: updates.map(({ table, column, id, label, replacements }) => ({
				table,
				column,
				id,
				label,
				replacements: replacements.length,
			})),
			unresolved: [...unresolved.values()],
		},
		null,
		2
	)
);

if (writeSqlPath) {
	writeFileSync(writeSqlPath, statements);
}

if (apply && updates.length > 0) {
	runSql(statements);
}
