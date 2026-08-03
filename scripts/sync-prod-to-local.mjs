#!/usr/bin/env node
import { accessSync, constants, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipMedia = args.has("--skip-media");
const mediaOnly = args.has("--media-only");
const resumeMedia = args.has("--resume-media");
const help = args.has("--help") || args.has("-h");

const root = process.cwd();
const databaseName = process.env.D1_DATABASE_NAME ?? "hyvoimailijat-db";
const bucketName = process.env.R2_BUCKET_NAME ?? "hyvoimailijat-media";
const stateDir = process.env.WRANGLER_STATE_DIR ?? ".wrangler/state/v3";
const tmpDir = process.env.SYNC_TMP_DIR ?? ".tmp/prod-sync";
const mediaLimit = process.env.SYNC_MEDIA_LIMIT
	? Number.parseInt(process.env.SYNC_MEDIA_LIMIT, 10)
	: null;
const exportFile = join(
	tmpDir,
	`prod-d1-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`
);
const mediaDir = join(tmpDir, "media");

if (help) {
	console.log(`Sync production EmDash data into local Wrangler storage.

Usage:
  npm run sync:prod
  npm run sync:prod -- --skip-media
  npm run sync:prod -- --media-only --resume-media
  npm run sync:prod -- --dry-run

Environment overrides:
  D1_DATABASE_NAME=${databaseName}
  R2_BUCKET_NAME=${bucketName}
  WRANGLER_STATE_DIR=${stateDir}
  SYNC_TMP_DIR=${tmpDir}
  SYNC_MEDIA_LIMIT=${mediaLimit ?? ""}
`);
	process.exit(0);
}

function run(command, args, options = {}) {
	const printable = [command, ...args].join(" ");
	console.log(`$ ${printable}`);
	if (dryRun) return { stdout: "" };

	const result = spawnSync(command, args, {
		cwd: root,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
	});

	if (result.status !== 0 && options.exitOnFailure !== false) {
		process.exit(result.status ?? 1);
	}

	return result;
}

function runWithRetries(command, args, options = {}) {
	const attempts = options.attempts ?? 3;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const result = run(command, args, {
			...options,
			exitOnFailure: false,
		});
		if (result.status === 0) return result;

		if (attempt < attempts) {
			console.warn(`Command failed; retrying (${attempt + 1}/${attempts}).`);
		}
	}

	process.exit(1);
}

function runWrangler(args, options) {
	return run("npx", ["wrangler", ...args], options);
}

function runWranglerWithRetries(args, options) {
	return runWithRetries("npx", ["wrangler", ...args], options);
}

function fileExists(path) {
	try {
		accessSync(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function sqlString(value) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "bigint") return String(value);
	if (typeof value === "boolean") return value ? "1" : "0";
	return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlIdent(value) {
	return `"${String(value).replaceAll('"', '""')}"`;
}

function stripForeignKeys(sql) {
	return String(sql)
		.replace(
			/,\s*constraint\s+"[^"]+"\s+foreign\s+key\s*\([^)]+\)\s+references\s+"[^"]+"\s*\([^)]+\)(?:\s+on\s+delete\s+(?:cascade|set null|restrict|no action))?/gi,
			""
		)
		.replace(
			/\s+references\s+"[^"]+"\s*\([^)]+\)(?:\s+on\s+delete\s+(?:cascade|set null|restrict|no action))?/gi,
			""
		);
}

function remoteQuery(command) {
	if (dryRun) {
		runWrangler(["d1", "execute", databaseName, "--remote", "--command", command, "--json"]);
		return [];
	}

	const result = runWrangler(
		["d1", "execute", databaseName, "--remote", "--command", command, "--json"],
		{ capture: true }
	);
	const payload = JSON.parse(result.stdout);
	return payload.flatMap((item) => item.results ?? []);
}

function resetLocalStorage() {
	const d1State = join(stateDir, "d1");
	const r2State = join(stateDir, "r2");

	for (const path of skipMedia ? [d1State] : [d1State, r2State]) {
		console.log(`Reset local state: ${path}`);
		if (!dryRun) rmSync(path, { recursive: true, force: true });
	}
}

function isSkippedSqlObject(row, tableNames) {
	const name = String(row.name ?? "");
	const tableName = String(row.tbl_name ?? "");
	const sql = String(row.sql ?? "");

	if (name.startsWith("sqlite_") || tableName.startsWith("sqlite_")) return true;
	if (name === "_cf_KV" || tableName === "_cf_KV") return true;
	if (name.startsWith("_emdash_fts_") || tableName.startsWith("_emdash_fts_")) return true;
	if (/CREATE\s+VIRTUAL\s+TABLE/i.test(sql)) return true;
	if (row.type !== "table" && !tableNames.has(tableName)) return true;
	if (/_emdash_fts_/i.test(sql)) return true;
	return false;
}

async function buildRemoteD1Dump() {
	mkdirSync(tmpDir, { recursive: true });

	const schemaRows = remoteQuery(`
		SELECT type, name, tbl_name, sql
		FROM sqlite_master
		WHERE sql IS NOT NULL
		ORDER BY
			CASE type
				WHEN 'table' THEN 0
				WHEN 'index' THEN 1
				WHEN 'trigger' THEN 2
				ELSE 3
			END,
			name
	`);
	const tableRows = schemaRows.filter((row) => row.type === "table");
	const tableNames = new Set(
		tableRows
			.filter((row) => !isSkippedSqlObject(row, new Set()))
			.map((row) => String(row.name))
	);
	const schema = schemaRows.filter((row) => !isSkippedSqlObject(row, tableNames));

	const lines = [
		"-- Generated by scripts/sync-prod-to-local.mjs",
		"-- FTS virtual/shadow tables are intentionally skipped.",
		"PRAGMA foreign_keys = OFF;",
	];

	for (const row of schema.filter((item) => item.type === "table")) {
		lines.push(`${stripForeignKeys(row.sql)};`);
	}

	for (const table of tableNames) {
		const rows = remoteQuery(`SELECT * FROM ${sqlIdent(table)}`);
		if (rows.length === 0) continue;

		const columns = Object.keys(rows[0]);
		const columnList = columns.map(sqlIdent).join(", ");
		for (const row of rows) {
			const values = columns.map((column) => sqlString(row[column])).join(", ");
			lines.push(`INSERT INTO ${sqlIdent(table)} (${columnList}) VALUES (${values});`);
		}
	}

	for (const row of schema.filter((item) => item.type !== "table")) {
		lines.push(`${row.sql};`);
	}

	lines.push("PRAGMA foreign_keys = ON;");

	if (!dryRun) {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(exportFile, `${lines.join("\n")}\n`);
	}

	console.log(`Wrote local import SQL: ${exportFile}`);
}

function importLocalD1() {
	runWrangler([
		"d1",
		"execute",
		databaseName,
		"--local",
		"--file",
		exportFile,
		"--yes",
	]);
}

function loadMediaRows() {
	if (dryRun) return [];

	const rows = remoteQuery(
		"SELECT storage_key, mime_type FROM media WHERE storage_key IS NOT NULL AND storage_key != '' ORDER BY created_at"
	);
	return Number.isInteger(mediaLimit) && mediaLimit > 0
		? rows.slice(0, mediaLimit)
		: rows;
}

function syncMedia() {
	if (skipMedia) {
		console.log("Skipping media sync.");
		return;
	}

	const rows = loadMediaRows();
	console.log(`Syncing ${dryRun ? "all referenced" : rows.length} media objects from R2.`);
	if (dryRun) return;

	mkdirSync(mediaDir, { recursive: true });

	for (const [index, row] of rows.entries()) {
		const key = row.storage_key;
		const file = join(mediaDir, key);
		mkdirSync(dirname(file), { recursive: true });

		console.log(`[${index + 1}/${rows.length}] ${key}`);
		if (resumeMedia && fileExists(file)) {
			console.log(`Using cached download: ${file}`);
		} else {
			runWranglerWithRetries([
				"r2",
				"object",
				"get",
				`${bucketName}/${key}`,
				"--remote",
				"--file",
				file,
			]);
		}

		const putArgs = [
			"r2",
			"object",
			"put",
			`${bucketName}/${key}`,
			"--local",
			"--file",
			file,
			"--force",
		];

		if (row.mime_type) {
			putArgs.push("--content-type", row.mime_type);
		}

		runWranglerWithRetries(putArgs);
	}
}

console.log("Syncing production data into local Wrangler storage.");
console.log(`D1: ${databaseName}`);
console.log(`R2: ${skipMedia ? "skipped" : bucketName}`);

if (!mediaOnly) {
	await buildRemoteD1Dump();
	resetLocalStorage();
	importLocalD1();
}
syncMedia();

console.log("Local sync complete. Start local dev with: npm run dev");
