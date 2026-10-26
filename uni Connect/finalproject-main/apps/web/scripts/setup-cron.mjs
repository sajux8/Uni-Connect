// Stores the app URL and CRON_SECRET in Supabase Vault so pg_cron can call /api/cron/outbox
// (migration 0012). Reads the keys from .env.local; never prints the secret.
//
//   npm run setup:cron                         # uses the production URL below
//   npm run setup:cron -- https://my-app.vercel.app
//
// Vercel must have the same CRON_SECRET (Project → Settings → Environment Variables).

import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const DEFAULT_APP_URL = "https://finalproject-tau-six.vercel.app";
const appUrl = (process.argv[2] ?? process.env.CRON_APP_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const secret = process.env.CRON_SECRET;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
  process.exit(1);
}
if (!secret || secret.length < 32) {
  console.error("Set CRON_SECRET in .env.local to a random string of at least 32 characters.");
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/rest/v1/rpc/set_cron_config`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_app_url: appUrl, p_cron_secret: secret }),
});

if (!response.ok) {
  console.error(`Supabase refused the update (${response.status}): ${await response.text()}`);
  process.exit(1);
}
console.log(`Scheduled jobs will call ${appUrl}/api/cron/outbox with your CRON_SECRET.`);
