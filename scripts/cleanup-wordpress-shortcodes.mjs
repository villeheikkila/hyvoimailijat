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
	console.log(`Cleanup imported WordPress shortcodes from EmDash content.

Usage:
  node scripts/cleanup-wordpress-shortcodes.mjs
  node scripts/cleanup-wordpress-shortcodes.mjs --write-sql=migrations/0003_cleanup_wordpress_shortcodes.sql
  node scripts/cleanup-wordpress-shortcodes.mjs --apply

Options:
  --db=PATH        Local SQLite D1 database path.
  --write-sql=PATH  Write SQL UPDATE statements for changed rows.
  --apply         Apply generated updates directly to the local database.
`);
	process.exit(0);
}

const contentTables = ["ec_pages", "ec_posts", "ec_tribe_events"];
const obsoleteShortcode = /\[(?:wpforms|catlist|ecs-list-events|table)\b[^\]]*\]/gi;
const obsoleteOnly = /^\s*\[(?:wpforms|catlist|ecs-list-events|table)\b[^\]]*\]\s*$/i;
const captionOpen = /\[caption\b[^\]]*\]/gi;
const captionClose = /\[\/caption\]/gi;
const videoShortcode = /\[video\b[^\]]*\](?:\s*\[\/video\])?/gi;
const videoOnly = /^\s*(\[video\b[^\]]*\])\s*(?:\[\/video\])?\s*$/i;

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

function loadRows() {
	const rows = [];
	for (const table of contentTables) {
		const tableRows = JSON.parse(
			runSql(`SELECT id, slug, title, content FROM ${sqlIdent(table)} WHERE content LIKE '%[%]%';`, {
				json: true,
			}) || "[]"
		);
		rows.push(...tableRows.map((row) => ({ ...row, table, column: "content" })));
	}

	const revisions = JSON.parse(
		runSql(`SELECT id, collection, entry_id, data FROM revisions WHERE data LIKE '%[%]%';`, {
			json: true,
		}) || "[]"
	);
	rows.push(...revisions.map((row) => ({ ...row, table: "revisions", column: "data" })));
	return rows;
}

function parseContent(row) {
	if (row.table === "revisions") {
		const data = JSON.parse(row.data);
		return { root: data, content: Array.isArray(data.content) ? data.content : null };
	}
	return { root: null, content: JSON.parse(row.content || "[]") };
}

function serializeContent(row, root, content) {
	if (row.table === "revisions") {
		root.content = content;
		return JSON.stringify(root);
	}
	return JSON.stringify(content);
}

function shortcodeAttrs(shortcode) {
	const attrs = {};
	const attrPattern = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g;
	for (const match of shortcode.matchAll(attrPattern)) {
		attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
	}
	return attrs;
}

function videoHtml(shortcode) {
	const attrs = shortcodeAttrs(shortcode);
	const url = attrs.mp4 || attrs.webm || attrs.ogv || attrs.wmv;
	if (!url) return null;
	if (attrs.wmv) {
		return `<p><a href="${escapeHtml(url)}">Video</a></p>`;
	}
	return `<video controls preload="metadata" src="${escapeHtml(url)}"></video>`;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function cleanText(text) {
	const value = String(text);
	if (
		!/\[(?:wpforms|catlist|ecs-list-events|table|caption|\/caption|video|\/video)\b[^\]]*\]/i.test(value)
	) {
		return value;
	}
	return value
		.replace(obsoleteShortcode, "")
		.replace(captionOpen, "")
		.replace(captionClose, "")
		.replace(videoShortcode, (match) => {
			const attrs = shortcodeAttrs(match);
			return attrs.mp4 || attrs.webm || attrs.ogv || attrs.wmv || "";
		})
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function hasText(block) {
	return (block.children ?? []).some((child) => String(child.text ?? "").replace(/\u00a0/g, " ").trim());
}

function transformBlock(block, stats) {
	if (block?._type === "htmlBlock") {
		const html = String(block.html ?? "");
		const videoMatch = html.match(videoOnly);
		if (videoMatch) {
			stats.videos += 1;
			return { ...block, html: videoHtml(videoMatch[1]) ?? "" };
		}
		if (obsoleteOnly.test(html)) {
			stats.removedBlocks += 1;
			return null;
		}
		const cleaned = cleanText(html);
		if (cleaned !== html) {
			stats.cleanedText += 1;
			return cleaned ? { ...block, html: cleaned } : null;
		}
		return block;
	}

	if (block?._type !== "block" || !Array.isArray(block.children)) {
		return block;
	}

	const combined = block.children.map((child) => child.text ?? "").join("");
	const videoMatch = combined.match(videoOnly);
	if (videoMatch) {
		const html = videoHtml(videoMatch[1]);
		if (html) {
			stats.videos += 1;
			return {
				_type: "htmlBlock",
				_key: `${block._key || "key"}-video`,
				html,
			};
		}
	}

	if (obsoleteOnly.test(combined)) {
		stats.removedBlocks += 1;
		return null;
	}

	if (block.children.some((child) => typeof child.text === "string" && videoOnly.test(child.text))) {
		const splitBlocks = [];
		let currentChildren = [];
		const flush = () => {
			const currentBlock = { ...block, children: currentChildren };
			if (hasText(currentBlock)) {
				splitBlocks.push(currentBlock);
			}
			currentChildren = [];
		};

		for (const child of block.children) {
			const match = typeof child.text === "string" ? child.text.match(videoOnly) : null;
			if (!match) {
				if (typeof child.text === "string") {
					const cleaned = cleanText(child.text);
					if (cleaned !== child.text) stats.cleanedText += 1;
					currentChildren.push({ ...child, text: cleaned });
				} else {
					currentChildren.push(child);
				}
				continue;
			}
			const html = videoHtml(match[1]);
			if (!html) {
				currentChildren.push({ ...child, text: cleanText(child.text) });
				continue;
			}
			flush();
			stats.videos += 1;
			splitBlocks.push({
				_type: "htmlBlock",
				_key: `${block._key || "key"}-video-${stats.videos}`,
				html,
			});
		}
		flush();
		return splitBlocks.length > 0 ? splitBlocks : null;
	}

	let changed = false;
	const children = block.children.map((child) => {
		if (typeof child.text !== "string") return child;
		const cleaned = cleanText(child.text);
		if (cleaned !== child.text) {
			changed = true;
		}
		return { ...child, text: cleaned };
	});

	if (!changed) return block;
	stats.cleanedText += 1;
	const next = { ...block, children };
	if (!hasText(next)) {
		stats.removedBlocks += 1;
		return null;
	}
	return next;
}

function transformContent(content) {
	const stats = { removedBlocks: 0, cleanedText: 0, videos: 0 };
	const blocks = [];
	for (const block of content) {
		const next = transformBlock(block, stats);
		if (Array.isArray(next)) blocks.push(...next);
		else if (next) blocks.push(next);
	}
	return { content: blocks, stats };
}

const updates = [];
const stats = {
	rowsChanged: 0,
	removedBlocks: 0,
	cleanedText: 0,
	videos: 0,
};

for (const row of loadRows()) {
	const { root, content } = parseContent(row);
	if (!content) continue;
	const before = JSON.stringify(content);
	const result = transformContent(content);
	const after = JSON.stringify(result.content);
	if (after === before) continue;

	stats.rowsChanged += 1;
	stats.removedBlocks += result.stats.removedBlocks;
	stats.cleanedText += result.stats.cleanedText;
	stats.videos += result.stats.videos;
	const serialized = serializeContent(row, root, result.content);
	updates.push({
		table: row.table,
		column: row.column,
		id: row.id,
		label: row.slug ?? `${row.collection}:${row.entry_id}`,
		value: serialized,
	});
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
			updatedRows: updates.map(({ table, id, label }) => ({ table, id, label })),
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
