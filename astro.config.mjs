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
	routeRules: {
		"/": { maxAge: 60, swr: 3600 },
		"/en": { maxAge: 60, swr: 3600 },
		"/posts": { maxAge: 300, swr: 3600 },
		"/posts/[slug]": { maxAge: 3600, swr: 86400 },
		"/tulokset": { maxAge: 300, swr: 3600 },
		"/en/results": { maxAge: 300, swr: 3600 },
		"/tapahtumat": { maxAge: 300, swr: 3600 },
		"/en/events": { maxAge: 300, swr: 3600 },
		"/tapahtumat/[slug]": { maxAge: 3600, swr: 86400 },
		"/seura": { maxAge: 300, swr: 3600 },
		"/en/about": { maxAge: 300, swr: 3600 },
		"/liity-jaseneksi": { maxAge: 300, swr: 3600 },
		"/en/become-a-member": { maxAge: 300, swr: 3600 },
		"/hyv-voimaliiga-saannot": { maxAge: 3600, swr: 86400 },
		"/en/rules": { maxAge: 3600, swr: 86400 },
		"/ranking": { maxAge: 300, swr: 3600 },
		"/en/ranking": { maxAge: 300, swr: 3600 },
		"/tag/[slug]": { maxAge: 300, swr: 3600 },
		"/category/[slug]": { maxAge: 300, swr: 3600 },
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
			name: "Inter",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
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
