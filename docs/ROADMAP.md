# Roadmap — Completed

All planned features and upgrades from the original roadmap have been implemented as of the `production-hardening` branch. This file is kept for historical reference.

---

## Implemented features

### BKT / mastery tracking
- [x] Full 4-parameter BKT (`p_init`, `p_learn`, `p_slip`, `p_guess`) — `backend/bkt.py`
- [x] Mastery decay over time using Ebbinghaus forgetting curve
- [x] Spaced-repetition scheduling: urgency-sorted review queue (`/review-queue`)
- [x] Daily progress goal with streak tracking

### Quiz
- [x] Difficulty adaptation (easy / medium / hard / expert) based on mastery
- [x] Explanation shown for wrong answers (generated at quiz creation time)
- [x] Per-question `difficulty` and `skill` badges
- [x] `auto` difficulty mode: infers level from current BKT state

### OCR detector
- [x] Cross-platform Tesseract path auto-detection (Windows, macOS, Linux)
- [x] Platform-specific window detection (`win32gui` / `osascript` / `xdotool`)
- [x] Privacy toggle: `OCR_ENABLED=false` disables screen capture; users can paste text manually
- [x] Improved classifier labels (adds `credentials`, `sensitive information` candidates)

### Resources
- [x] Resource caching in Supabase (`resource_cache` table)
- [x] Per-resource voting (`/resources/vote`)
- [x] Deduplication within sessions

### LLM providers
- [x] Pluggable provider abstraction — `backend/llm/provider.py`
- [x] Implementations: `GeminiProvider`, `ClaudeProvider`, `OpenAIProvider`, `OllamaProvider`
- [x] Per-provider telemetry (calls, latency, tokens, errors) exposed via `/usage-stats`
- [x] `LLM_PROVIDER` env var selects active provider

### Generated content storage
- [x] Supabase `generated_content` table for explainers and quiz sets
- [x] Store and retrieve via `/content/store` and `/content/{topic_id}`

### PWA / offline mode
- [x] `frontend/public/sw.js` — cache-first static, network-first API with fallback
- [x] `frontend/public/manifest.json` — installable PWA
- [x] Service worker registered in `main.jsx`

### Collaborative features
- [x] Classrooms: create, join by code, list members
- [x] Shared roadmaps within classrooms
- [x] Leaderboard (anonymized, with `isYou` highlight)
- [x] DB tables: `classrooms`, `classroom_members`, `shared_roadmaps`, `leaderboard_entries`

### Learning reports
- [x] Full learning report endpoint (`/report`)
- [x] Frontend report page with stat cards, mastery bars, quiz history, study time
- [x] JSON export

### Study sessions
- [x] Session start/end tracking (`/study-sessions/start`, `/study-sessions/end`)
- [x] Per-topic and per-activity time breakdowns in report
- [x] `timeSpentMinutes` in analytics derived from real session data

### Observability
- [x] Request ID middleware (every response gets `X-Request-ID`)
- [x] Extended `/health` with Supabase ping and LLM latency
- [x] LLM provider telemetry
- [x] Optional Sentry integration (`sentry-sdk[fastapi]` in requirements)

### Test suite
- [x] `backend/tests/test_bkt.py` — 25+ BKT unit tests
- [x] `backend/tests/test_quiz.py` — quiz normalisation tests
- [x] `backend/tests/test_api.py` — API contract tests (FastAPI TestClient)
- [x] `frontend/package.json` — Vitest configured with `npm run test`

### Docker / deployment
- [x] `backend/Dockerfile` — Python backend image
- [x] `frontend/Dockerfile` — multi-stage node build → nginx:alpine
- [x] `frontend/nginx.conf` — SPA routing, API proxy, static asset caching
- [x] `docker-compose.yml` — backend + frontend services + `dev` profile
