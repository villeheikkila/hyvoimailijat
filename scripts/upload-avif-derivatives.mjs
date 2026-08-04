#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

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

const manifestPath = resolve(
	root,
	args.get("manifest") ?? ".tmp/prod-sync/media-avif-responsive/manifest.json",
);
const bucket = args.get("bucket") ?? process.env.R2_BUCKET_NAME ?? "hyvoimailijat-media";
const outputDir = resolve(root, args.get("output") ?? ".tmp/prod-sync/media-avif-responsive");
const concurrency = Number.parseInt(args.get("concurrency") ?? process.env.R2_UPLOAD_CONCURRENCY ?? "8", 10);
const wranglerBin = args.get("wrangler") ?? process.env.WRANGLER_BIN ?? "./node_modules/.bin/wrangler";
const dryRun = args.has("dry-run");
const help = args.has("help") || args.has("h");

if (help) {
	console.log(`Upload generated AVIF derivatives to R2.

Usage:
  npm run media:avif:upload

Options:
  --manifest=FILE     Manifest from generate-avif-derivatives. Default: .tmp/prod-sync/media-avif-responsive/manifest.json
  --output=DIR        Derivative output directory. Default: .tmp/prod-sync/media-avif-responsive
  --bucket=NAME       R2 bucket. Default: hyvoimailijat-media
  --concurrency=N     Concurrent uploads. Default: 8
  --dry-run           Print upload count without uploading.`);
	process.exit(0);
}

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
	throw new Error("--concurrency must be an integer between 1 and 16.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const uploads = manifest.images.flatMap((image) =>
	image.variants.map((variant) => ({
		key: variant.path,
		file: join(outputDir, variant.path),
		size: variant.size,
	})),
);

function runUpload(upload) {
	return new Promise((resolvePromise, reject) => {
	const child = spawn(
			wranglerBin,
			[
				"r2",
				"object",
				"put",
				`${bucket}/${upload.key}`,
				"--file",
				upload.file,
				"--content-type",
				"image/avif",
				"--cache-control",
				"public, max-age=31536000, immutable",
				"--remote",
			],
			{
				cwd: root,
				stdio: ["ignore", "pipe", "pipe"],
				encoding: "utf8",
			},
		);

		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolvePromise();
			else reject(new Error(`${stderr}\nUpload failed (${code}): ${upload.key}`));
		});
	});
}

let uploaded = 0;
let failed = 0;
let next = 0;

console.log(`Uploading ${uploads.length} AVIF derivatives to R2 bucket ${bucket}.`);

if (dryRun) {
	console.log("Dry run only; no files uploaded.");
	process.exit(0);
}

for (const upload of uploads) {
	statSync(upload.file);
}

async function worker() {
	while (next < uploads.length) {
		const upload = uploads[next];
		next += 1;
		try {
			await runUpload(upload);
			uploaded += 1;
			if (uploaded % 50 === 0 || uploaded === uploads.length) {
				console.log(`Uploaded ${uploaded}/${uploads.length}`);
			}
		} catch (error) {
			failed += 1;
			console.error(error instanceof Error ? error.message : error);
		}
	}
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failed > 0) {
	throw new Error(`Uploaded ${uploaded}/${uploads.length}; ${failed} failed.`);
}

console.log(`Uploaded ${uploaded}/${uploads.length} AVIF derivatives.`);
