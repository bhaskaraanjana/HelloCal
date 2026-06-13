# Cloud Sync (Supabase) — optional

HelloCal is **offline-first**: all data lives in `localStorage` and the app works
with no backend. Supabase adds optional **cloud backup + cross-device sync** behind
an account. When the env vars below are absent, the Cloud Sync UI hides itself and
nothing changes.

## Setup

1. Create a project at https://supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates a
   `user_data` table (one JSONB row per user) with Row-Level Security so each user can
   only read/write their own row — which is why shipping the anon key in the client is safe.
3. Auth → Providers: enable **Email**. For the simplest flow, you may disable
   "Confirm email" (otherwise users must click a confirmation link before first sync).
4. Project Settings → API: copy the **Project URL** and **anon public** key into a
   local env file:

   ```bash
   cp .env.example .env.local
   # then fill in:
   # VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
   # VITE_SUPABASE_ANON_KEY=ey...
   ```
5. `npm run build` (or `npm run dev`). A **Cloud Sync** card appears in Settings.

## How it works

- **Model:** the whole HelloCal data blob (logs, workouts, goals, settings, favorites,
  templates, water, body metrics, profile) is stored as a single JSONB row keyed by the
  authenticated user id. This mirrors the local `StorageData` object and keeps RLS and
  conflict handling simple.
- **Backup to cloud** pushes the current local backup JSON (last-write-wins on
  `updated_at`).
- **Restore from cloud** pulls the row and runs it through the same sanitizing import
  path used for manual backup restore, then persists locally.
- **Security:** RLS policies (`auth.uid() = user_id`) isolate every user's data. The
  client only ever holds the anon key; no service-role key is shipped.

## Not configured?

Everything still works locally. Cloud Sync simply doesn't render. You can also use the
manual **Export / Restore Backup JSON** in Settings to move data between devices without
an account.
