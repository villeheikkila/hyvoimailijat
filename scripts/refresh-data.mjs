#!/usr/bin/env node
import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const args = new Set(argv);
const target = argv.find((arg) => arg.startsWith("--target="))?.split("=", 2)[1] ?? "local";
const dryRun = args.has("--dry-run");
const mediaOnly = args.has("--media-only");
const skipMedia =
	args.has("--skip-media") ||
	(target === "staging" && !args.has("--with-media") && !mediaOnly);
const resumeMedia = args.has("--resume-media");
const help = args.has("--help") || args.has("-h");

if (!new Set(["local", "staging"]).has(target)) {
	throw new Error(`Unknown target "${target}". Expected local or staging.`);
}

const root = process.cwd();
const sourceDatabase = process.env.PROD_D1_DATABASE_NAME ?? "hyvoimailijat-db";
const sourceBucket = process.env.PROD_R2_BUCKET_NAME ?? "hyvoimailijat-media";
const stagingDatabase =
	process.env.STAGING_D1_DATABASE_NAME ?? "hyvoimailijat-staging-db";
const stagingBucket =
	process.env.STAGING_R2_BUCKET_NAME ?? "hyvoimailijat-staging-media";
const stateDir = process.env.WRANGLER_STATE_DIR ?? ".wrangler/state/v3";
const tmpDir = process.env.SYNC_TMP_DIR ?? ".tmp/prod-refresh";
const concurrency = Number.parseInt(process.env.SYNC_MEDIA_CONCURRENCY ?? "16", 10);
const mediaLimit = process.env.SYNC_MEDIA_LIMIT
	? Number.parseInt(process.env.SYNC_MEDIA_LIMIT, 10)
	: null;
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const exportFile = join(tmpDir, `prod-to-${target}-${timestamp}.sql`);
const mediaDir = resolve(tmpDir, "media");
const excludedDataTables = new Set([
	"_emdash_404_log",
	"_emdash_api_tokens",
	"_emdash_authorization_codes",
	"_emdash_cron_tasks",
	"_emdash_device_codes",
	"_emdash_oauth_clients",
	"_emdash_oauth_tokens",
	"_emdash_rate_limits",
	"_plugin_indexes",
	"_plugin_state",
	"_plugin_storage",
	"allowed_domains",
	"audit_logs",
	"auth_challenges",
	"auth_tokens",
	"credentials",
	"member_applications",
	"oauth_accounts",
	"users",
]);

if (target === "staging") {
	if (sourceDatabase === stagingDatabase || sourceBucket === stagingBucket) {
		throw new Error("Refusing to refresh staging because a staging target equals production.");
	}
}

if (help) {
	console.log(`Refresh EmDash data from production.

Usage:
  pnpm refresh:local
  pnpm refresh:staging
  pnpm refresh:staging -- --with-media
  pnpm refresh:staging -- --media-only --resume-media
  pnpm refresh:staging -- --dry-run

Targets:
  local     Replace local Wrangler D1/R2 state.
  staging   Replace remote staging D1. Media is skipped unless --with-media or
            --media-only is supplied.

Authentication, sessions, audit logs, plugin state, form submissions, and the
production site URL are deliberately not copied.

Environment overrides:
  PROD_D1_DATABASE_NAME=${sourceDatabase}
  PROD_R2_BUCKET_NAME=${sourceBucket}
  STAGING_D1_DATABASE_NAME=${stagingDatabase}
  STAGING_R2_BUCKET_NAME=${stagingBucket}
  WRANGLER_STATE_DIR=${stateDir}
  SYNC_TMP_DIR=${tmpDir}
  SYNC_MEDIA_CONCURRENCY=${concurrency}
  SYNC_MEDIA_LIMIT=${mediaLimit ?? ""}
`);
	process.exit(0);
}

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
	throw new Error("SYNC_MEDIA_CONCURRENCY must be an integer between 1 and 16.");
}

function printable(command, commandArgs) {
	return [command, ...commandArgs].join(" ");
}

function run(command, commandArgs, options = {}) {
	console.log(`$ ${printable(command, commandArgs)}`);
	if (dryRun && options.mutates) return { status: 0, stdout: "" };

	const result = spawnSync(command, commandArgs, {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 100 * 1024 * 1024,
		stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
	});

	if (result.status !== 0) {
		throw new Error(
			`${result.error?.message ?? `Command failed (${result.status ?? "unknown"})`}: ${printable(command, commandArgs)}`
		);
	}

	return result;
}

function runWrangler(commandArgs, options) {
	return run("pnpm", ["exec", "wrangler", ...commandArgs], options);
}

function runWranglerAsync(commandArgs) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn("pnpm", ["exec", "wrangler", ...commandArgs], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolvePromise({ stdout, stderr });
			else reject(new Error(`${stderr || stdout}\nCommand failed (${code}): wrangler ${commandArgs.join(" ")}`));
		});
	});
}

async function runWranglerWithRetries(commandArgs, attempts = 3) {
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await runWranglerAsync(commandArgs);
		} catch (error) {
			if (attempt === attempts) throw error;
			console.warn(`Command failed; retrying (${attempt + 1}/${attempts}).`);
		}
	}
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

function remoteStatements(database, commands) {
	const result = runWrangler(
		[
			"d1",
			"execute",
			database,
			"--remote",
			"--command",
			commands.join("; "),
			"--json",
		],
		{ capture: true }
	);
	return JSON.parse(result.stdout);
}

function remoteQuery(database, command) {
	return remoteStatements(database, [command]).flatMap((item) => item.results ?? []);
}

function isSystemObject(row) {
	const name = String(row.name ?? "");
	const tableName = String(row.tbl_name ?? "");
	return (
		name.startsWith("sqlite_") ||
		tableName.startsWith("sqlite_") ||
		name === "_cf_KV" ||
		tableName === "_cf_KV"
	);
}

function isVirtualTable(row) {
	return row.type === "table" && /CREATE\s+VIRTUAL\s+TABLE/i.test(String(row.sql ?? ""));
}

function isFtsShadowTable(row) {
	const name = String(row.name ?? "");
	return row.type === "table" && name.startsWith("_emdash_fts_") && !isVirtualTable(row);
}

function loadSchema(database) {
	return remoteQuery(
		database,
		`SELECT type, name, tbl_name, sql
		 FROM sqlite_master
		 WHERE sql IS NOT NULL
		 ORDER BY name`
	).filter((row) => !isSystemObject(row));
}

function buildDropStatements(schema) {
	const statements = [];
	const types = ["trigger", "view", "index"];
	for (const type of types) {
		for (const row of schema.filter((item) => item.type === type)) {
			statements.push(`DROP ${type.toUpperCase()} IF EXISTS ${sqlIdent(row.name)};`);
		}
	}

	for (const row of schema.filter(isVirtualTable)) {
		statements.push(`DROP TABLE IF EXISTS ${sqlIdent(row.name)};`);
	}
	for (const row of schema.filter((item) => item.type === "table" && !isVirtualTable(item) && !isFtsShadowTable(item))) {
		statements.push(`DROP TABLE IF EXISTS ${sqlIdent(row.name)};`);
	}
	return statements;
}

function loadTableRows(tableNames) {
	const pageSize = 500;
	const batchSize = 10;
	const rowsByTable = new Map(tableNames.map((table) => [table, []]));
	let pending = tableNames.map((table) => ({ table, offset: 0 }));

	while (pending.length > 0) {
		const nextPending = [];
		for (let start = 0; start < pending.length; start += batchSize) {
			const batch = pending.slice(start, start + batchSize);
			const payload = remoteStatements(
				sourceDatabase,
				batch.map(
					({ table, offset }) =>
						`SELECT * FROM ${sqlIdent(table)} LIMIT ${pageSize + 1} OFFSET ${offset}`
				)
			);
			if (payload.length !== batch.length) {
				throw new Error(
					`Expected ${batch.length} D1 result sets, received ${payload.length}.`
				);
			}

			for (const [index, item] of payload.entries()) {
				const request = batch[index];
				const page = item.results ?? [];
				rowsByTable.get(request.table).push(...page.slice(0, pageSize));
				if (page.length > pageSize) {
					nextPending.push({ table: request.table, offset: request.offset + pageSize });
				}
			}
		}
		pending = nextPending;
	}

	return rowsByTable;
}

function buildD1Dump() {
	mkdirSync(tmpDir, { recursive: true });
	const sourceSchema = loadSchema(sourceDatabase);
	const targetSchema = target === "staging" ? loadSchema(stagingDatabase) : [];
	const ordinaryTables = sourceSchema.filter(
		(row) => row.type === "table" && !isVirtualTable(row) && !isFtsShadowTable(row)
	);
	const virtualTables = sourceSchema.filter(isVirtualTable);
	const indexes = sourceSchema.filter((row) => row.type === "index");
	const triggers = sourceSchema.filter((row) => row.type === "trigger");
	const views = sourceSchema.filter((row) => row.type === "view");

	const lines = [
		"-- Generated by scripts/refresh-data.mjs",
		"-- FTS shadow data is rebuilt from the content tables after import.",
		"PRAGMA foreign_keys = OFF;",
		...buildDropStatements(targetSchema),
	];

	for (const row of ordinaryTables) lines.push(`${row.sql};`);
	for (const row of virtualTables) lines.push(`${row.sql};`);

	const tableNames = ordinaryTables.map((row) => String(row.name));
	const copiedTableNames = tableNames.filter((table) => !excludedDataTables.has(table));
	const rowsByTable = loadTableRows(copiedTableNames);
	for (const table of tableNames) {
		let rows = rowsByTable.get(table) ?? [];
		if (table === "options") {
			rows = rows.filter((row) => row.name !== "emdash:site_url");
		}
		if (excludedDataTables.has(table)) {
			console.log(`${table}: data excluded`);
		}
		console.log(`${table}: ${rows.length} rows`);
		if (rows.length === 0) continue;
		const columns = Object.keys(rows[0]);
		const columnList = columns.map(sqlIdent).join(", ");
		for (const row of rows) {
			const values = columns.map((column) => sqlString(row[column])).join(", ");
			lines.push(`INSERT INTO ${sqlIdent(table)} (${columnList}) VALUES (${values});`);
		}
	}

	for (const row of indexes) lines.push(`${row.sql};`);
	for (const row of triggers) lines.push(`${row.sql};`);
	for (const row of views) lines.push(`${row.sql};`);
	for (const row of virtualTables) {
		lines.push(`INSERT INTO ${sqlIdent(row.name)} (${sqlIdent(row.name)}) VALUES ('rebuild');`);
	}
	lines.push("PRAGMA foreign_keys = ON;");

	if (!dryRun) writeFileSync(exportFile, `${lines.join("\n")}\n`);
	console.log(`${dryRun ? "Would write" : "Wrote"} import SQL: ${exportFile}`);
}

function resetLocalStorage() {
	const paths = skipMedia
		? [join(stateDir, "d1")]
		: [join(stateDir, "d1"), join(stateDir, "r2")];
	for (const path of paths) {
		console.log(`${dryRun ? "Would reset" : "Reset"} local state: ${path}`);
		if (!dryRun) rmSync(path, { recursive: true, force: true });
	}
}

function importD1() {
	if (target === "local") resetLocalStorage();
	const targetDatabase = target === "staging" ? stagingDatabase : sourceDatabase;
	const locationFlag = target === "staging" ? "--remote" : "--local";
	runWrangler(
		["d1", "execute", targetDatabase, locationFlag, "--file", exportFile, "--yes"],
		{ mutates: true }
	);
}

function loadMediaRows() {
	const rows = remoteQuery(
		sourceDatabase,
		"SELECT storage_key, mime_type FROM media WHERE storage_key IS NOT NULL AND storage_key != '' ORDER BY created_at"
	);
	return Number.isInteger(mediaLimit) && mediaLimit > 0 ? rows.slice(0, mediaLimit) : rows;
}

function safeMediaPath(key) {
	const file = resolve(mediaDir, key);
	if (file !== mediaDir && !file.startsWith(`${mediaDir}${sep}`)) {
		throw new Error(`Unsafe media storage key: ${key}`);
	}
	return file;
}

async function copyMediaObject(row, index, total) {
	const key = String(row.storage_key);
	const file = safeMediaPath(key);
	mkdirSync(dirname(file), { recursive: true });
	console.log(`[${index + 1}/${total}] ${key}`);

	if (!(resumeMedia && fileExists(file))) {
		await runWranglerWithRetries([
			"r2",
			"object",
			"get",
			`${sourceBucket}/${key}`,
			"--remote",
			"--file",
			file,
		]);
	}

	const destinationBucket = target === "staging" ? stagingBucket : sourceBucket;
	const destinationFlag = target === "staging" ? "--remote" : "--local";
	const putArgs = [
		"r2",
		"object",
		"put",
		`${destinationBucket}/${key}`,
		destinationFlag,
		"--file",
		file,
		"--force",
	];
	if (row.mime_type) putArgs.push("--content-type", String(row.mime_type));
	await runWranglerWithRetries(putArgs);
}

async function mapConcurrent(items, worker) {
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (cursor < items.length) {
				const index = cursor++;
				await worker(items[index], index, items.length);
			}
		})
	);
}

async function syncMedia() {
	if (skipMedia) {
		console.log("Skipping media refresh.");
		return;
	}
	const rows = loadMediaRows();
	console.log(`${dryRun ? "Would sync" : "Syncing"} ${rows.length} referenced media objects with concurrency ${concurrency}.`);
	if (!dryRun) {
		mkdirSync(mediaDir, { recursive: true });
		await mapConcurrent(rows, copyMediaObject);
	}
}

console.log(`Refreshing ${target} from production.`);
console.log(`D1: ${sourceDatabase} -> ${target === "staging" ? stagingDatabase : "local Wrangler"}`);
console.log(`R2: ${skipMedia ? "skipped" : `${sourceBucket} -> ${target === "staging" ? stagingBucket : "local Wrangler"}`}`);

if (!mediaOnly) {
	buildD1Dump();
	importD1();
}
await syncMedia();

console.log(
	target === "staging"
		? "Staging refresh complete. Start with: pnpm dev:staging"
		: "Local refresh complete. Start with: pnpm dev:local"
);
