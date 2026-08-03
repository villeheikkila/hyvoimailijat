import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

function text(value: FormDataEntryValue | null): string {
	return typeof value === "string" ? value.trim() : "";
}

function redirect(location: string, status = 303): Response {
	return new Response(null, {
		status,
		headers: { Location: location },
	});
}

export const POST: APIRoute = async ({ request }) => {
	const form = await request.formData();
	const lang = text(form.get("lang")) === "en" ? "en" : "fi";
	const returnPath = lang === "en" ? "/en/become-a-member" : "/liity-jaseneksi";

	if (text(form.get("website"))) {
		return redirect(`${returnPath}?sent=1`);
	}

	const firstName = text(form.get("firstName"));
	const lastName = text(form.get("lastName"));
	const email = text(form.get("email")).toLowerCase();
	const confirmEmail = text(form.get("confirmEmail")).toLowerCase();
	const role = text(form.get("role"));
	const school = text(form.get("school"));
	const comment = text(form.get("comment"));

	if (!firstName || !lastName || !email || email !== confirmEmail || !role || !school) {
		return redirect(`${returnPath}?error=1`);
	}

	await env.DB.prepare(
		`INSERT INTO member_applications (
			id,
			first_name,
			last_name,
			email,
			role,
			school,
			comment,
			locale,
			status,
			created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`
	)
		.bind(crypto.randomUUID(), firstName, lastName, email, role, school, comment, lang)
		.run();

	return redirect(`${returnPath}?sent=1`);
};
