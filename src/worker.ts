// Worker entry: Astro's fetch handler plus EmDash's scheduled() handler, which
// the Cron Trigger in wrangler.jsonc drives.
export { default } from "@emdash-cms/cloudflare/worker";
