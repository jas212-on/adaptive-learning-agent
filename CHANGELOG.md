# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — 2026-06-13

### Added

**Backend hardening**
- JWT signature verification via PyJWT (`SUPABASE_JWT_SECRET`); graceful dev fallback when secret is unset (`backend/auth.py`)
- Startup configuration validator — fails fast on missing required vars, warns loudly on optional-but-important keys (`backend/config.py`)
- Structured logging setup (`setup_logging()` in `config.py`)
- Global FastAPI exception handler returning a consistent JSON error shape (`backend/server.py`)
- CORS origin config via `CORS_ORIGINS` env var with localhost-in-production warning

**Database migrations**
- `db/migrations/0001_init.sql` — base schema checked into the repo for reproducibility
- `db/migrations/0002_hardening.sql` — `set_updated_at` triggers on all tables + analytics index on `quiz_attempts`

**Frontend sync hardening**
- `frontend/src/lib/syncQueue.js` — persistent write-behind queue with debounce, exponential back-off retry, and drain-on-online
- `apiFetch` in `api.js` gains request timeout (10 s) and one retry with back-off on 5xx / network errors
- `progress.js` reconciliation: local-ahead progress is re-pushed on load (covers writes lost while offline)
- `saveLastViewedPosition` and `setRoadmapProgress` route through the sync queue instead of firing-and-forgetting

**UI/UX polish**
- Extended design-token system: semantic color variables, consistent radius/shadow/animation tokens (`index.css`, `tailwind.config.js`)
- Global focus-visible ring and reduced-motion support in `index.css`
- `Skeleton` component for consistent loading states (`frontend/src/components/ui/Skeleton.jsx`)
- `Button` gains `isLoading` prop with spinner + accessible `aria-disabled`
- Analytics page uses `Skeleton` during data load

**Documentation**
- `docs/SETUP.md` — prerequisites, Supabase project setup, migration steps, env files, dev commands
- `docs/ARCHITECTURE.md` — system overview, data-flow diagram, persistence model, sync semantics, BKT explanation, caching strategy
- `docs/API.md` — all endpoints with method, auth, request/response shapes, rate limits
- `docs/CONTRIBUTING.md` — branch model, code style, commit conventions, PR checklist
- `docs/SECURITY.md` — RLS model, JWT verification, key handling, OCR privacy, responsible disclosure
- `docs/ROADMAP.md` — planned upgrades and new features
- `CHANGELOG.md` (this file)
- `.gitignore` covering `.env` files, Python caches, runtime JSON caches, captures

### Changed
- `backend/requirements.txt` — pinned `PyJWT>=2.10,<3` and `python-dotenv>=1.0`
- `README.md` — updated configuration section with Supabase setup steps; added Documentation links section

### Removed
- Committed `__pycache__` `.pyc` files untracked from git
- Legacy `frontend/src/App.css` (already deleted; confirmed absent)

---

## [0.1.0] — 2026-05-01 (initial MVP)

### Added
- Screen OCR with Tesseract + `mss`; `bart-large-mnli` educational content filter
- Gemini 2.5 Flash topic detection, roadmap generation, explainer, quiz, suggestions, and AI assistant
- Bayesian Knowledge Tracing (BKT) for per-topic mastery
- Concept dependency graph (ReactFlow)
- Supabase Postgres backend with RLS — `profiles`, `topics`, `mastery`, `quiz_attempts`, `roadmap_progress`, `user_settings`
- Supabase Auth with email/password; `handle_new_user` trigger for profile + settings bootstrap
- React 18 + Vite + Tailwind 3.4 frontend; Radix UI primitives; GSAP + React Three Fiber effects
- `DashboardLayout`, topic roadmap, analytics, timetable, concept-graph, and suggestions pages
- Rate limiting via `slowapi`
- `ErrorBoundary` + `Spinner` + `MagicBento` UI components
