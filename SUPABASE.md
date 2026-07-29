# Cloud backend (Supabase) — optional

HelloCal is **offline-first**: all data lives in `localStorage` and the app works
with no backend. When configured, Supabase provides:

- **Google / email sign-in** and encrypted per-user data storage
- **HelloCal AI** — Gemini calls proxied through a server-held API key (users don't need their own key)
- **Auto sync** — data backs up to the cloud while signed in

When the env vars below are absent, cloud UI hides and the app runs locally only.

## Project (configured)

| Setting | Value |
|---------|--------|
| Project | `bhaskaraanjana's Project` |
| Project ref | `csybxucdwidbibltmvwg` |
| API URL | `https://csybxucdwidbibltmvwg.supabase.co` |
| Production app | https://hellocal.infinitemind.space |
| Dashboard | https://supabase.com/dashboard/project/csybxucdwidbibltmvwg |

Local env is in `.env.local` (gitignored). Restart `npm run dev` after changes.

## Already applied via Supabase MCP

- Restored the project (was paused)
- Migration `hellocal_user_data` — `public.user_data` table + RLS policies
- Edge function `gemini-proxy` (JWT verification enabled)

## Manual steps (MCP cannot do these)

### 1. HelloCal AI — set Gemini secret

Dashboard → [Edge Functions → Secrets](https://supabase.com/dashboard/project/csybxucdwidbibltmvwg/functions/secrets)

Add:

- **Name:** `GEMINI_API_KEY`
- **Value:** your [Google AI Studio](https://aistudio.google.com/api-keys) key

Without this, HelloCal AI returns “not configured on the server.”

### 2. Google sign-in

Dashboard → [Auth → Providers](https://supabase.com/dashboard/project/csybxucdwidbibltmvwg/auth/providers) → **Google** → Enable

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create OAuth 2.0 Client ID (Web application)
2. **Authorized JavaScript origins:** `https://hellocal.infinitemind.space` (and `http://localhost:5173` for local dev)
3. **Authorized redirect URI:** `https://csybxucdwidbibltmvwg.supabase.co/auth/v1/callback`
4. Paste Client ID + Secret into Supabase Google provider settings

Under [Auth → URL Configuration](https://supabase.com/dashboard/project/csybxucdwidbibltmvwg/auth/url-configuration):

- **Site URL:** `https://hellocal.infinitemind.space`
- **Redirect URLs** (add all):
  - `https://hellocal.infinitemind.space`
  - `https://cal.infinitemind.space`
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

`supabase/config.toml` mirrors this for CLI deploys. After editing, run `supabase config push` if you use the Supabase CLI linked to this project.

Email/password auth is available by default.

## Setup (reference)

1. Create a project at https://supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. **Auth → Providers**: enable **Email** and **Google** (add Google OAuth client ID/secret from Google Cloud Console; set redirect URL to `https://YOURPROJECT.supabase.co/auth/v1/callback`).
4. Copy **Project URL** and **anon public** key into `.env.local`:

   ```bash
   cp .env.example .env.local
   # VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
   # VITE_SUPABASE_ANON_KEY=ey...
   ```

5. Deploy the Gemini proxy edge function and set the server secret:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
   supabase functions deploy gemini-proxy
   ```

6. `npm run dev` or `npm run build`. Settings shows **Account & cloud sync** and **AI provider**.

### Production hosting (`hellocal.infinitemind.space`)

Set these environment variables on your host (same values as `.env.local`):

- `VITE_SUPABASE_URL=https://csybxucdwidbibltmvwg.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon key from dashboard>`

**Vercel:** add both vars under Project → Settings → Environment Variables for **Production** and **Preview**. Use a normal `https://` URL (no backslashes). Wrong paste examples that break auth: `https:\project.supabase.co` or an empty anon key. Redeploy after changes (`vercel --prod` or push to `main`).

## How it works

- **Data:** one JSONB row per user (`user_data` table), RLS-isolated by `auth.uid()`.
- **Sign-in:** Google OAuth or email/password. On first sign-in, cloud data is pulled if it exists; otherwise local data is pushed up.
- **Auto backup:** while signed in, changes debounce-push to the cloud every few seconds.
- **HelloCal AI:** client calls `/functions/v1/gemini-proxy` with the user's session JWT; the edge function calls Gemini with `GEMINI_API_KEY` (never exposed to the browser).
- **Your Gemini key:** users can still choose **Your Gemini key** in Settings for fully local/offline AI without an account.

## Not configured?

Everything works locally. Use **Export / Restore Backup JSON** in Settings to move data between devices.
