import type { PortableTextBlock } from "emdash";

export type Embed =
	| { type: "youtube"; url: string; title: string }
	| { type: "instagram"; url: string; title: string };

export type RichBlockPart =
	| { type: "block"; block: PortableTextBlock }
	| { type: "embed"; embed: Embed };

export function getBlockText(block: PortableTextBlock): string {
	const children = (block as { children?: Array<{ text?: string }> }).children;
	if (!Array.isArray(children)) return "";
	return children.map((child) => child.text ?? "").join("");
}

export function getBlockParts(block: PortableTextBlock): RichBlockPart[] {
	const candidate = block as PortableTextBlock & {
		_type?: string;
		type?: string;
		children?: Array<{ _key?: string; text?: string }>;
	};
	if ((candidate._type ?? candidate.type) !== "block" || !Array.isArray(candidate.children)) {
		return [{ type: "block", block }];
	}

	const parts: RichBlockPart[] = [];
	let children: typeof candidate.children = [];
	let splitCount = 0;

	const flushBlock = () => {
		const next = { ...candidate, children };
		if (hasText(next)) {
			parts.push({ type: "block", block: next });
		}
		children = [];
	};

	for (const child of candidate.children) {
		if (typeof child.text !== "string") {
			children.push(child);
			continue;
		}

		let lastIndex = 0;
		let matched = false;
		for (const match of child.text.matchAll(/https?:\/\/[^\s<>"')]+/gi)) {
			const rawUrl = match[0];
			const embed = getEmbedUrl(rawUrl);
			if (!embed || match.index === undefined) continue;

			matched = true;
			const before = child.text.slice(lastIndex, match.index);
			if (before) {
				children.push({
					...child,
					_key: `${child._key ?? "span"}-before-${splitCount}`,
					text: before,
				});
			}

			flushBlock();
			parts.push({ type: "embed", embed });
			splitCount += 1;
			lastIndex = match.index + rawUrl.length;
		}

		if (!matched) {
			children.push(child);
			continue;
		}

		const after = child.text.slice(lastIndex);
		if (after) {
			children.push({
				...child,
				_key: `${child._key ?? "span"}-after-${splitCount}`,
				text: after,
			});
		}
	}

	flushBlock();
	return parts.length > 0 ? parts : [{ type: "block", block }];
}

export function isInvalidFileBlock(block: PortableTextBlock): boolean {
	const candidate = block as unknown as {
		_type?: string;
		type?: string;
		url?: string;
		href?: string;
		file?: { url?: string; href?: string };
		asset?: { url?: string; href?: string; _ref?: string };
	};
	const type = candidate._type ?? candidate.type;
	if (type !== "file") return false;

	const href =
		candidate.url ??
		candidate.href ??
		candidate.file?.url ??
		candidate.file?.href ??
		candidate.asset?.url ??
		candidate.asset?.href ??
		candidate.asset?._ref ??
		"";

	return href === "" || href === "#";
}

function getYouTubeEmbedUrl(value: string): string | null {
	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^www\./, "");
		let videoId: string | null = null;

		if (host === "youtu.be") {
			videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
		} else if (host === "youtube.com" || host === "m.youtube.com") {
			if (url.pathname.startsWith("/live/")) {
				videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
			} else if (url.pathname.startsWith("/shorts/")) {
				videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
			} else if (url.pathname.startsWith("/embed/")) {
				videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
			} else {
				videoId = url.searchParams.get("v");
			}
		}

		if (!videoId) return null;

		const start = getYouTubeStartSeconds(url);
		const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
		if (start > 0) embed.searchParams.set("start", String(start));
		return embed.toString();
	} catch {
		return null;
	}
}

export function getEmbedUrl(value: string): Embed | null {
	const youtube = getYouTubeEmbedUrl(value);
	if (youtube) {
		return { type: "youtube", url: youtube, title: "YouTube video" };
	}

	const instagram = getInstagramEmbedUrl(value);
	if (instagram) {
		return { type: "instagram", url: instagram, title: "Instagram post" };
	}

	return null;
}

function hasText(block: { children?: Array<{ text?: string }> }): boolean {
	return (block.children ?? []).some((child) =>
		String(child.text ?? "").replace(/\u00a0/g, " ").trim()
	);
}

function getYouTubeStartSeconds(url: URL): number {
	const raw = url.searchParams.get("t") ?? url.searchParams.get("start") ?? "";
	if (/^\d+$/.test(raw)) return Number(raw);

	const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
	if (!match) return 0;

	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2] ?? 0);
	const seconds = Number(match[3] ?? 0);
	return hours * 3600 + minutes * 60 + seconds;
}

function getInstagramEmbedUrl(value: string): string | null {
	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^www\./, "");
		if (host !== "instagram.com") return null;

		const parts = url.pathname.split("/").filter(Boolean);
		const type = parts[0];
		const shortcode = parts[1];
		if (!shortcode || !["p", "reel", "tv"].includes(type)) return null;

		return `https://www.instagram.com/${type}/${shortcode}/embed`;
	} catch {
		return null;
	}
}
