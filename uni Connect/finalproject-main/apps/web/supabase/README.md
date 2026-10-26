# Supabase

SQL migrations for the UniConnect database live in `migrations/`, numbered in the order they must run.

**Rules**

- A table never exists without row-level security: policies ship in the same migration file as the table.
- Never edit a migration that has been applied to a shared project. Add a new one.
- Types for the app are generated, not hand-written: `npm run db:types` (needs the Supabase CLI and a linked project).

**Applying migrations (done together at the end of M0 / start of M1)**

1. Install the Supabase CLI and sign in.
2. `supabase init` (creates `config.toml`), then `supabase link --project-ref <your-project-ref>`.
3. `supabase db push` applies everything in `migrations/` to the linked project.
