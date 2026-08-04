// Worker entry: Astro's fetch handler plus EmDash's scheduled() handler, which
// the Cron Trigger in wrangler.jsonc drives.
import emdashWorker from "@emdash-cms/cloudflare/worker";

const pdfMediaPath = /^\/_emdash\/api\/media\/file\/[^/?#]+\.pdf$/i;
const pageRedirects: Record<string, string> = {
	seura: "/seura",
	"liity-jaseneksi": "/liity-jaseneksi",
	"hyv-voimaliiga-saannot": "/hyv-voimaliiga-saannot",
	"tulokset-3": "/tulokset",
	uutiset: "/posts",
	ranking: "/ranking",
	about: "/en/about",
	"become-a-member": "/en/become-a-member",
	rules: "/en/rules",
	results: "/en/results",
	news: "/posts",
	"ranking-en": "/en/ranking",
};

type WorkerFetch = (
	request: Request,
	env: unknown,
	ctx: unknown,
) => Response | Promise<Response>;

function redirectLegacyPageAlias(request: Request): Response | null {
	const url = new URL(request.url);
	const match = url.pathname.match(/^\/pages\/([^/]+)\/?$/);
	if (!match) return null;

	const targetPath = pageRedirects[decodeURIComponent(match[1])];
	if (!targetPath) {
		return new Response(null, { status: 404 });
	}

	return Response.redirect(new URL(targetPath, url.origin), 301);
}

function inlinePdfMedia(request: Request, response: Response): Response {
	const url = new URL(request.url);

	if (!pdfMediaPath.test(url.pathname)) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("content-type", "application/pdf");
	headers.set("content-disposition", "inline");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

const fetch: WorkerFetch = async (request, env, ctx) => {
	const legacyPageRedirect = redirectLegacyPageAlias(request);
	if (legacyPageRedirect) return legacyPageRedirect;

	const response = (await emdashWorker.fetch(
		request as never,
		env as never,
		ctx as never,
	)) as Response;
	return inlinePdfMedia(request, response);
};

export default {
	...emdashWorker,
	fetch,
};
