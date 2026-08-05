import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import { defineConfig, fontProviders, sessionDrivers } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	cache: {
		provider: cacheCloudflare(),
	},
	build: {
		inlineStylesheets: "always",
	},
	vite: {
		optimizeDeps: {
			exclude: ["astro/app/entrypoint/dev", "astro/compiler-runtime"],
		},
	},
	routeRules: {
		"/": { maxAge: 3600, swr: 604800 },
		"/en": { maxAge: 3600, swr: 604800 },
		"/posts": { maxAge: 3600, swr: 604800 },
		"/posts/[slug]": { maxAge: 86400, swr: 2592000 },
		"/tulokset": { maxAge: 3600, swr: 604800 },
		"/en/results": { maxAge: 3600, swr: 604800 },
		"/tapahtumat": { maxAge: 3600, swr: 604800 },
		"/en/events": { maxAge: 3600, swr: 604800 },
		"/tapahtumat/[slug]": { maxAge: 86400, swr: 2592000 },
		"/seura": { maxAge: 86400, swr: 2592000 },
		"/en/about": { maxAge: 86400, swr: 2592000 },
		"/liity-jaseneksi": { maxAge: 86400, swr: 2592000 },
		"/en/become-a-member": { maxAge: 86400, swr: 2592000 },
		"/hyv-voimaliiga-saannot": { maxAge: 86400, swr: 2592000 },
		"/en/rules": { maxAge: 86400, swr: 2592000 },
		"/ranking": { maxAge: 3600, swr: 604800 },
		"/en/ranking": { maxAge: 3600, swr: 604800 },
		"/tag/[slug]": { maxAge: 3600, swr: 604800 },
		"/category/[slug]": { maxAge: 3600, swr: 604800 },
		"/rss.xml": { maxAge: 3600, swr: 604800 },
		"/sitemap.xml": { maxAge: 86400, swr: 2592000 },
	},
	session: {
		driver: sessionDrivers.lruCache(),
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [formsPlugin()],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
