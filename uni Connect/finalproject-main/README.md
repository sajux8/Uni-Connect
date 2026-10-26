# UniConnect

An AI-assisted community platform for university students: official announcements, events with registration,
timetables and attendance, discussion spaces and Q&A, junior–senior mentorship, a resource library, feedback
forms, support, careers, and AI search that only answers from content you're allowed to see. Final-year project.

Live: <https://finalproject-tau-six.vercel.app>

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS + shadcn/ui · Supabase (Postgres with row-level security, Auth,
Storage, Realtime) · Vercel AI SDK with Gemini.

## Repository layout

```
apps/web/
├─ src/
│  ├─ app/           routes: public pages, sign-in, the signed-in app, admin, API routes
│  ├─ components/    ui (shadcn) · layout · shared · one folder per feature
│  ├─ lib/           pure logic shared by server and browser (routes, navigation, validation, AI helpers)
│  ├─ server/        server actions, queries, AI indexing and email
│  └─ proxy.ts       session refresh and access rules
├─ supabase/         SQL migrations (tables, row-level security, functions)
└─ scripts/          one-off setup scripts
```

## Run the app

Requires Node.js 22 or newer and a Supabase project.

```bash
cd apps/web
npm install
cp .env.example .env.local   # then fill in the Supabase keys (and the AI key for Ask AI)
npm run dev                  # http://localhost:3100
```

Apply the SQL files in `apps/web/supabase/migrations/` to the Supabase project in order before first use.

| Command              | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | Start the dev server                                                    |
| `npm run check`      | Typecheck, lint and production build                                    |
| `npm run format`     | Format with Prettier                                                    |
| `npm run db:types`   | Regenerate database types (needs the Supabase CLI and a linked project) |
| `npm run setup:cron` | Store the app URL and `CRON_SECRET` for the scheduled jobs              |

## Deploying

The app deploys on Vercel. When importing the repository, set **Root Directory** to `apps/web` and add the
variables from `.env.example`.
