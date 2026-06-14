# Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Use a virtual environment |
| Node.js | 18+ | npm 9+ |
| Tesseract OCR | 5.x | Windows: install from UB Mannheim builds; set `TESSERACT_CMD` env var if not on `PATH` |
| Supabase account | — | Free tier is sufficient |

### Install Tesseract (Windows)

1. Download the installer from <https://github.com/UB-Mannheim/tesseract/wiki>.
2. Install to `C:\Program Files\Tesseract-OCR\` (default).
3. Add it to your `PATH`, or set `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` in `backend/.env`.

---

## 1. Clone and install dependencies

```bash
git clone https://github.com/jas212-on/adaptive-learning-agent
cd adaptive-learning-agent

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
```

---

## 2. Create a Supabase project

1. Go to <https://supabase.com> → New project.
2. Note your **Project URL** and both **API keys** (anon + service-role) from
   *Settings → API*.
3. Note your **JWT Secret** from *Settings → API → JWT Settings*.

---

## 3. Run the database migrations

Open the **SQL Editor** in your Supabase dashboard and run all three files in order:

1. `db/migrations/0001_init.sql` — base schema (tables, RLS policies, triggers)
2. `db/migrations/0002_hardening.sql` — `set_updated_at` triggers + analytics index
3. `db/migrations/0003_roadmap_features.sql` — spaced repetition, study goals, study sessions, classrooms, leaderboards, and shared roadmaps

---

## 4. Configure Supabase Authentication

In the Supabase dashboard go to *Authentication → URL Configuration*:

- **Site URL**: `http://localhost:5173` (dev) or your production domain
- **Redirect URLs**: add `http://localhost:5173/**` for local dev

Optionally disable *Confirm email* for faster local iteration (re-enable for production).

---

## 5. Environment files

### `backend/.env`

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_JWT_SECRET=<jwt secret>      # Recommended. Needed for verifying HS256 tokens.
                                       # Note: If your project uses asymmetric signing (ES256/RS256),
                                       # the backend automatically uses your project's JWKS endpoint
                                       # to verify tokens.

GOOGLE_API_KEY=<gemini key>
SERPAPI_API_KEY=<serpapi key>

# Optional overrides
ENV=development
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_AI=10/minute
RATE_LIMIT_DATA=60/minute
```

See `backend/.env.example` for all available variables.

### `frontend/.env`

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_BASE_URL=/api
```

See `frontend/.env.example` for all available variables.

---

## 6. Run in development

```bash
# Terminal 1 — backend
cd backend
.venv\Scripts\activate
uvicorn server:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open <http://localhost:5173>.

The Vite dev server proxies `/api/*` to the backend automatically (see `vite.config.js`).

---

## 7. Verify the setup

```bash
# Backend health check
curl http://localhost:8000/health
# Expected: {"status":"ok","supabase":"ok"}
```

Sign up a new user in the app → check the Supabase dashboard:
- `auth.users` — new row
- `public.profiles` — row created by the `handle_new_user` trigger
- `public.user_settings` — row created by the same trigger

---

## Data migration from an old Supabase project

Because user data is scoped by `user_id` and the schema is identical, you can either:

**Option A — start fresh** (recommended for early development): create a new account
and begin again.

**Option B — migrate data**:
1. Export each table in FK-safe order from the old project using the Supabase dashboard
   CSV export or `pg_dump`.
2. Re-create the same `auth.users` rows in the new project first (or recreate user
   accounts and remap `user_id` references).
3. Import tables in this order:
   `profiles → topics → mastery → quiz_attempts → roadmap_progress → user_settings`
