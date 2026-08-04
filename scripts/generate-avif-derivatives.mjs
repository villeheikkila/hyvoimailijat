#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const argv = process.argv.slice(2);
const args = new Map(
	argv
		.filter((arg) => arg.startsWith("--"))
		.map((arg) => {
			const [key, ...value] = arg.slice(2).split("=");
			return [key, value.length ? value.join("=") : "true"];
		}),
);

const inputDir = resolve(root, args.get("input") ?? ".tmp/prod-sync/media");
const outputDir = resolve(root, args.get("output") ?? ".tmp/prod-sync/media-avif");
const manifestPath = resolve(
	root,
	args.get("manifest") ?? join(outputDir, "manifest.json"),
);
const metadataPath = resolve(
	root,
	args.get("metadata") ?? "src/data/media-image-metadata.json",
);
const widths = (args.get("widths") ?? "320,640,960,1280")
	.split(",")
	.map((value) => Number.parseInt(value.trim(), 10))
	.filter((value) => Number.isInteger(value) && value > 0)
	.sort((a, b) => a - b);
const quality = Number.parseInt(args.get("quality") ?? "50", 10);
const limit = args.has("limit") ? Number.parseInt(args.get("limit"), 10) : null;
const force = args.has("force");
const dryRun = args.has("dry-run");
const help = args.has("help") || args.has("h");

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

if (help) {
	console.log(`Generate local AVIF derivatives for EmDash/R2 media.

Usage:
  npm run media:avif
  node scripts/generate-avif-derivatives.mjs --input=.tmp/prod-sync/media --output=.tmp/prod-sync/media-avif

Options:
  --input=DIR       Source media directory. Default: .tmp/prod-sync/media
  --output=DIR      Output directory. Default: .tmp/prod-sync/media-avif
  --manifest=FILE   Manifest path. Default: <output>/manifest.json
  --metadata=FILE   Compact site metadata path. Default: src/data/media-image-metadata.json
  --widths=LIST     Comma-separated target widths. Default: 320,640,960,1280
  --quality=N       AVIF quality passed to ImageMagick. Default: 50
  --limit=N         Process only the first N images.
  --force           Regenerate existing derivatives.
  --dry-run         Print what would be generated without writing files.

Requires ImageMagick's "magick" command with AVIF support.`);
	process.exit(0);
}

if (widths.length === 0) {
	throw new Error("No valid widths configured.");
}

if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
	throw new Error("--quality must be an integer between 1 and 100.");
}

function run(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		throw new Error(
			`${result.stderr || result.error?.message || "Command failed"}\n$ ${[
				command,
				...commandArgs,
			].join(" ")}`,
		);
	}

	return result.stdout;
}

function assertMagick() {
	const result = spawnSync("magick", ["-version"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		throw new Error("ImageMagick is required: install the `magick` command first.");
	}
}

function listImages(dir) {
	const files = [];
	for (const item of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, item.name);
		if (item.isDirectory()) {
			files.push(...listImages(path));
			continue;
		}
		if (item.isFile() && imageExtensions.has(extname(item.name).toLowerCase())) {
			files.push(path);
		}
	}
	return files.sort();
}

function identify(path) {
	const output = run("magick", ["identify", "-format", "%w %h", path], {
		capture: true,
	}).trim();
	const [width, height] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));
	if (!Number.isInteger(width) || !Number.isInteger(height)) {
		throw new Error(`Could not read dimensions for ${path}`);
	}
	return { width, height };
}

function derivativeId(sourcePath) {
	const rel = relative(inputDir, sourcePath);
	const parsedExt = extname(rel);
	return rel.slice(0, -parsedExt.length).split(sep).join("/");
}

function targetWidths(originalWidth) {
	const selected = widths.filter((width) => width <= originalWidth);
	if (selected.length === 0) selected.push(originalWidth);
	return [...new Set(selected)].sort((a, b) => a - b);
}

function formatBytes(value) {
	if (value < 1024) return `${value} B`;
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
	return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

assertMagick();

const sourceImages = listImages(inputDir).slice(0, limit ?? undefined);
const manifest = {
	generatedAt: new Date().toISOString(),
	inputDir: relative(root, inputDir),
	outputDir: relative(root, outputDir),
	format: "avif",
	quality,
	widths,
	images: [],
	skipped: [],
};

let originalBytes = 0;
let derivativeBytes = 0;
let generatedCount = 0;
let skippedCount = 0;

console.log(`Found ${sourceImages.length} source images.`);
console.log(`Generating AVIF derivatives at ${relative(root, outputDir)}`);

for (const sourcePath of sourceImages) {
	const sourceStat = statSync(sourcePath);
	let original;
	try {
		original = identify(sourcePath);
	} catch (error) {
		const source = relative(inputDir, sourcePath).split(sep).join("/");
		console.warn(`Skipping unreadable image: ${source}`);
		manifest.skipped.push({
			source,
			reason: error instanceof Error ? error.message.split("\n")[0] : String(error),
		});
		continue;
	}
	const id = derivativeId(sourcePath);
	const variants = [];
	originalBytes += sourceStat.size;

	for (const width of targetWidths(original.width)) {
		const relativeOutput = join("derivatives", id, `${width}.avif`);
		const outputPath = join(outputDir, relativeOutput);

		if (!force) {
			try {
				const existing = statSync(outputPath);
				variants.push({
					width,
					path: relativeOutput.split(sep).join("/"),
					size: existing.size,
				});
				derivativeBytes += existing.size;
				skippedCount += 1;
				continue;
			} catch {
				// Generate missing derivative below.
			}
		}

		if (!dryRun) {
			mkdirSync(dirname(outputPath), { recursive: true });
			try {
				run("magick", [
					sourcePath,
					"-auto-orient",
					"-resize",
					`${width}x>`,
					"-strip",
					"-quality",
					String(quality),
					outputPath,
				]);
			} catch (error) {
				const source = relative(inputDir, sourcePath).split(sep).join("/");
				console.warn(`Skipping failed derivative: ${source} @ ${width}px`);
				manifest.skipped.push({
					source,
					width,
					reason: error instanceof Error ? error.message.split("\n")[0] : String(error),
				});
				continue;
			}
		}

		const size = dryRun ? 0 : statSync(outputPath).size;
		variants.push({
			width,
			path: relativeOutput.split(sep).join("/"),
			size,
		});
		derivativeBytes += size;
		generatedCount += 1;
	}

	manifest.images.push({
		source: relative(inputDir, sourcePath).split(sep).join("/"),
		id,
		width: original.width,
		height: original.height,
		size: sourceStat.size,
		variants,
	});
}

if (!dryRun) {
	mkdirSync(dirname(manifestPath), { recursive: true });
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

	const metadata = Object.fromEntries(
		manifest.images.map((image) => [
			image.id,
			{
				width: image.width,
				height: image.height,
				widths: image.variants.map((variant) => variant.width),
			},
		]),
	);
	mkdirSync(dirname(metadataPath), { recursive: true });
	writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`);
}

console.log(`Generated ${generatedCount} derivatives; skipped ${skippedCount} existing derivatives.`);
console.log(`Source bytes: ${formatBytes(originalBytes)}`);
console.log(`AVIF bytes:   ${formatBytes(derivativeBytes)}`);
if (originalBytes > 0 && derivativeBytes > 0) {
	console.log(`Derivative/source ratio: ${((derivativeBytes / originalBytes) * 100).toFixed(1)}%`);
}
console.log(`Manifest: ${relative(root, manifestPath)}`);
console.log(`Metadata: ${relative(root, metadataPath)}`);
