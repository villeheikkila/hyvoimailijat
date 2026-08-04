// Worker entry: Astro's fetch handler plus EmDash's scheduled() handler, which
// the Cron Trigger in wrangler.jsonc drives.
import emdashWorker from "@emdash-cms/cloudflare/worker";

const pdfMediaPath = /^\/_emdash\/api\/media\/file\/[^/?#]+\.pdf$/i;
type WorkerFetch = (
	request: Request,
	env: unknown,
	ctx: unknown,
) => Response | Promise<Response>;

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
