import type { APIRoute } from "astro";
import { getEmDashCollection, getTaxonomyTerms } from "emdash";

type SitemapItem = {
	path: string;
	lastmod?: Date | string | null;
};

const staticRoutes: SitemapItem[] = [
	{ path: "/" },
	{ path: "/en" },
	{ path: "/posts" },
	{ path: "/tapahtumat" },
	{ path: "/en/events" },
	{ path: "/tulokset" },
	{ path: "/en/results" },
	{ path: "/hyv-voimaliiga-saannot" },
	{ path: "/en/rules" },
	{ path: "/seura" },
	{ path: "/en/about" },
	{ path: "/liity-jaseneksi" },
	{ path: "/en/become-a-member" },
	{ path: "/ranking" },
	{ path: "/en/ranking" },
];

export const GET: APIRoute = async ({ site, url }) => {
	const siteUrl = (site?.toString() || url.origin).replace(/\/$/, "");

	const [
		{ entries: posts },
		{ entries: events },
		categories,
		tags,
	] = await Promise.all([
		getEmDashCollection("posts", {
			orderBy: { published_at: "desc" },
			limit: 1000,
		}),
		getEmDashCollection("events", {
			orderBy: { start_at: "desc" },
			limit: 1000,
		}),
		getTaxonomyTerms("category"),
		getTaxonomyTerms("tag"),
	]);

	const items: SitemapItem[] = [
		...staticRoutes,
		...posts.map((post) => ({
			path: `/posts/${post.id}`,
			lastmod: post.data.updatedAt,
		})),
		...events.map((event) => ({
			path: `/tapahtumat/${event.id}`,
			lastmod: event.data.updatedAt,
		})),
		...categories
			.filter((term) => (term.count ?? 0) > 0)
			.map((term) => ({
				path: `/category/${term.slug}`,
			})),
		...tags
			.filter((term) => (term.count ?? 0) > 0)
			.map((term) => ({
				path: `/tag/${term.slug}`,
			})),
	];

	const uniqueItems = Array.from(
		new Map(items.map((item) => [normalizePath(item.path), item])).values(),
	);

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueItems.map((item) => renderUrl(siteUrl, item)).join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

function normalizePath(path: string): string {
	if (path === "/") return path;
	return path.replace(/\/$/, "");
}

function renderUrl(siteUrl: string, item: SitemapItem): string {
	const lastmod = formatLastmod(item.lastmod);
	return `  <url>
    <loc>${escapeXml(`${siteUrl}${normalizePath(item.path)}`)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ""}
  </url>`;
}

function formatLastmod(value: SitemapItem["lastmod"]): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

const XML_ESCAPE_PATTERNS = [
	[/&/g, "&amp;"],
	[/</g, "&lt;"],
	[/>/g, "&gt;"],
	[/"/g, "&quot;"],
	[/'/g, "&apos;"],
] as const;

function escapeXml(value: string): string {
	let result = value;
	for (const [pattern, replacement] of XML_ESCAPE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}
