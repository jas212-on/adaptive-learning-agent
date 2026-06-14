# Architecture

## System Overview

```
┌────────────────────────────────────────────────┐
│                   Browser                      │
│  React 18 + Vite + Tailwind + Radix UI         │
│  AuthProvider → Supabase Auth                  │
│  DetectorContext → polling /detector/*         │
└──────────────┬─────────────────────────────────┘
               │ HTTP (proxied /api → :8000)
┌──────────────▼─────────────────────────────────┐
│             FastAPI backend (:8000)             │
│  JWT auth middleware  │  rate limiting (slowapi)│
│  ┌───────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ OCR agent │  │  Gemini LLM │  │ SerpAPI  │  │
│  │ (mss+     │  │  (roadmap,  │  │ (web     │  │
│  │ Tesseract)│  │  quiz, BKT) │  │ resources│  │
│  └─────┬─────┘  └─────────────┘  └──────────┘  │
└────────┼───────────────────────────────────────┘
         │
   output.json (local)
         │
┌────────▼────────────────────────────────────────┐
│               Supabase (Postgres + Auth)        │
│  profiles        topics        mastery          │
│  quiz_attempts   roadmap_prog  user_settings    │
│  review_sched    study_goals   study_sessions   │
│  resource_votes  resource_cach generated_cont   │
│  classrooms      class_members shared_roadmaps  │
│  leaderboard_entries                            │
└─────────────────────────────────────────────────┘
```

---

## Data Flow

### Learning loop

1. **Screen capture** — `mss` grabs the primary screen every N seconds.
2. **OCR** — Tesseract extracts text; `bart-large-mnli` zero-shot classifier filters out non-educational content (passwords, personal messages, etc.).
3. **Topic detection** — Gemini 2.5 Flash identifies the topic; result written to `backend/output.json` and POST-ed to `POST /detect/topic`.
4. **Roadmap generation** — Gemini builds a multi-stage roadmap (Explainer → Resources → Quiz) for the topic; stored in Supabase `topics`.
5. **Content delivery** — frontend polls `/detector/topics/*` endpoints for explainer, resources, and quiz.
6. **Quiz submission** — answers submitted to `POST /detector/topics/{id}/quiz/submit`; BKT updates `mastery`.
7. **Analytics** — `/analytics` aggregates mastery + attempt history from Supabase.

---

## Persistence model

| Data | Where | Rationale |
|------|-------|-----------|
| OCR raw text | `backend/output.json` (local) | Large, transient, privacy-sensitive |
| Generated explainers | `backend/explainer_cache.json` / Supabase `generated_content` | Multi-device sync with local fallback cache |
| Generated quizzes | `backend/quiz_cache/` / Supabase `generated_content` | Multi-device sync with local fallback cache |
| Concept graphs | `backend/graph_cache.json` / Supabase `generated_content` | Multi-device sync with local fallback cache |
| BKT state (fallback) | `backend/bkt_state.json` | Used only when Supabase is unavailable |
| User mastery | Supabase `mastery` | Cross-session, cross-device |
| Quiz history | Supabase `quiz_attempts` | Audit trail for analytics |
| Roadmap progress | Supabase `roadmap_progress` + localStorage | Sync with offline fallback |
| User settings | Supabase `user_settings` | Preferences |
| Spaced repetition | Supabase `review_schedule` | Mastery decay + review date scheduler |
| Daily goals & streaks | Supabase `study_goals` | Gamified engagement metrics |
| Study time tracking | Supabase `study_sessions` | Tracks duration of quiz, explainer, resources, and reviews |
| Resource voting & cache | Supabase `resource_votes` + `resource_cache` | Community curated rankings & cached search hits |
| Collaborative spaces | Supabase `classrooms` + `classroom_members` | Classroom-level user groups |
| Leaderboards | Supabase `leaderboard_entries` | Weekly ranking lists |
| Shared roadmaps | Supabase `shared_roadmaps` | Custom roadmaps shared with classroom or public |
| Auth | Supabase Auth | JWT-based authentication (ES256/RS256 verified via JWKS, fallback to HS256 secret) |

### Roadmap progress sync semantics

Progress is **append-only** — a module marked `true` (done) never reverts to `false`.
This makes sync conflict-free:

1. `setRoadmapProgress` writes localStorage immediately (optimistic UI).
2. The write is enqueued in `syncQueue` (persisted to `localStorage["ala.syncQueue"]`).
3. `syncQueue` flushes on a debounce, drains on `online` / `visibilitychange`, and retries with exponential back-off.
4. On load, `loadAndMergeProgress` fetches the remote state, merges with local using "true wins", then re-enqueues any local-ahead keys that were never confirmed by the server (offline reconciliation).

---

## Bayesian Knowledge Tracing (BKT)

BKT models a learner's latent knowledge state as a hidden Markov model with four parameters:

| Parameter | Symbol | Default | Meaning |
|-----------|--------|---------|---------|
| Initial knowledge | p(L₀) | 0.3 | Probability student already knew the concept |
| Learn rate | p(T) | 0.09 | Probability of learning on each opportunity |
| Slip | p(S) | 0.1 | Probability of wrong answer despite knowledge |
| Guess | p(G) | 0.2 | Probability of correct answer without knowledge |

After each quiz attempt the backend updates `p(Ln)` and writes it to `mastery.score`. The frontend's Analytics page reads mastery scores to compute per-topic proficiency.

---

## Concept dependency graph

`GET /detector/topics/{id}/graph` asks Gemini to return a DAG of prerequisite concepts for the topic. This is handled by the dedicated builder module `backend/graph/builder.py`. The response is cached locally in `graph_cache.json` and persistently in Supabase's `generated_content` table, then rendered in the frontend with ReactFlow.

---

## Timetable Scheduler

The Timetable Scheduler module (`backend/timetable/scheduler.py`) generates study plans based on student constraints. It implements:
- **Constraints**: weekday/weekend study hours, start/end boundaries, excluded dates.
- **Priority**: Higher priority is given to upcoming deadlines/exams and topics with lower BKT mastery.
- **Preferences**: session duration, break length, maximum daily sessions, and morning vs. evening study bias.

---

## Thread safety

`backend/server.py` uses a `threading.Lock` (`_lock`) around shared mutable state (OCR output buffer, BKT state dict, detector status). Async FastAPI routes that touch shared state acquire the lock via `asyncio.to_thread`.

---

## Caching strategy

| Cache | Key | TTL |
|-------|-----|-----|
| Explainer | topic slug | indefinite (file + Supabase `generated_content` sync) |
| Quiz | topic slug | indefinite (file + Supabase `generated_content` sync) |
| Graph | topic slug | indefinite (file + Supabase `generated_content` sync) |
| Summary | topic slug | indefinite (file + Supabase `generated_content` sync) |

Cache files are local to the backend process with a primary persistent backup in Supabase `generated_content` for cross-device loading.
