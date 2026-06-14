# Adaptive Learning Agent

An AI-powered adaptive learning system that detects what you're studying in real-time and creates personalized learning paths, quizzes, explanations, and study schedules.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB.svg)
![Gemini](https://img.shields.io/badge/Gemini-AI-orange.svg)
![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)

---

## Documentation

| Doc | What's inside |
|-----|---------------|
| [docs/SETUP.md](docs/SETUP.md) | End-to-end setup: prerequisites, Supabase project, migrations, env files, running locally. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data-flow, BKT, caching, concurrency, sync semantics. |
| [docs/API.md](docs/API.md) | Every backend endpoint: method, auth, params, responses, rate limits. |
| [docs/SECURITY.md](docs/SECURITY.md) | RLS model, JWT verification, key handling, OCR privacy. |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev workflow, code style, commits, PR checklist. |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes per release. |

---

## Overview

The **Adaptive Learning Agent** is an intelligent study companion that:

1. **Detects Topics in Real-Time** — OCR + screen capture identifies what you're studying across VS Code, browsers, PDFs, and more
2. **Generates AI Content** — Explanations, quizzes, and resources via pluggable LLM providers (Gemini, Claude, OpenAI, Ollama)
3. **Tracks Mastery with BKT** — Full 4-parameter Bayesian Knowledge Tracing with Ebbinghaus forgetting curve decay
4. **Schedules Spaced Repetition** — Surfaces reviews at the right time based on forgetting curves
5. **Builds Knowledge Graphs** — Visualizes concept dependencies interactively
6. **Generates Study Plans** — Creates optimized timetables based on deadlines and confidence
7. **Supports Collaboration** — Classrooms, shared roadmaps, and leaderboards
8. **Works Offline (PWA)** — Service worker caches the app shell; API responses cached for offline fallback

---

## Features

### Real-Time Topic Detection
- Screen capture and OCR using Tesseract (auto-detected path on Windows, macOS, Linux)
- AI topic identification from captured text using Gemini
- Privacy toggle: set `OCR_ENABLED=false` to disable capture — paste text manually instead
- Supports VS Code, Chrome, Firefox, Edge, Safari, Brave, PowerPoint, Word, PDFs, Notion, Obsidian

### AI-Powered Learning
- **Explainers**: Structured explanations with prerequisites, key ideas, and common pitfalls
- **Quizzes**: MCQs with difficulty adaptation (easy → expert based on mastery), explanations for wrong answers
- **Resources**: Curated resources via web search with per-resource upvoting
- **AI Assistant**: Chat with an assistant about any topic in the topic detail view

### Bayesian Knowledge Tracing
- Full 4-parameter BKT: `p_init`, `p_learn`, `p_slip`, `p_guess`
- Ebbinghaus mastery decay over time (knowledge fades without review)
- Spaced repetition scheduler — review queue sorted by urgency
- Difficulty adapts automatically from mastery level

### Collaborative Learning
- Classrooms: create or join with a 6-digit code
- Shared roadmaps within classrooms
- Leaderboard (anonymized scores, you highlighted)

### Analytics & Reports
- Real-time analytics from BKT state and study sessions
- Learning reports with per-topic mastery, quiz history, study time breakdown
- JSON export of full learning report
- Streak tracking from quiz attempts

### PWA / Offline Mode
- Service worker: cache-first for static assets, network-first with cache fallback for API
- `manifest.json` for installable app
- Background sync for progress updates

### Observability
- Request ID middleware on every response
- Extended `/health` endpoint with Supabase ping and LLM latency
- Per-provider LLM telemetry (calls, latency, token usage, errors)
- Optional Sentry integration (`sentry-sdk[fastapi]`)

### Infrastructure
- Docker multi-stage build (node builder → nginx for frontend, Python for backend)
- `docker-compose.yml` with dev profile (`--profile dev`) for hot-reload dev server
- Full test suite: pytest (backend BKT, quiz, API) + Vitest (frontend)
- DB migrations in `db/migrations/` — run in order

---

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | REST API framework |
| **Pydantic** | Data validation |
| **Google Gemini** | Default LLM (gemini-2.5-flash) |
| **Anthropic Claude / OpenAI / Ollama** | Pluggable LLM alternatives |
| **Supabase (Postgres)** | Auth, mastery, quiz attempts, study sessions, classrooms |
| **PyJWT** | JWT signature verification |
| **slowapi** | Rate limiting |
| **Tesseract OCR + OpenCV + MSS** | Screen capture and text extraction |
| **pytest + httpx** | Backend test suite |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **React Router v7** | Client-side routing |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **Lucide React** | Icons |
| **Supabase JS** | Auth client + realtime |
| **Vitest** | Frontend unit tests |
| **Service Worker** | PWA / offline support |

---

## Project Structure

```
adaptive-learning-agent/
├── backend/
│   ├── server.py              # Main FastAPI app (~2700 lines)
│   ├── bkt.py                 # 4-parameter BKT engine + spaced repetition
│   ├── ocr.py                 # Cross-platform screen capture & OCR
│   ├── quizz.py               # Quiz generation with difficulty adaptation
│   ├── config.py              # Config loading and validation
│   ├── requirements.txt
│   │
│   ├── llm/
│   │   ├── gemini.py          # Gemini wrapper
│   │   └── provider.py        # Pluggable LLM abstraction (Gemini/Claude/OpenAI/Ollama)
│   │
│   ├── graph/
│   │   ├── builder.py         # Concept graph builder (Gemini-powered)
│   │   └── models.py          # Graph data models
│   │
│   ├── timetable/
│   │   ├── routes.py          # Timetable endpoints
│   │   ├── scheduler.py       # Scheduling algorithm
│   │   ├── scoring.py         # Priority scoring
│   │   ├── models.py
│   │   ├── utils.py
│   │   └── validate.py
│   │
│   ├── tests/
│   │   ├── test_bkt.py        # BKT unit tests (25+)
│   │   ├── test_quiz.py       # Quiz normalisation tests
│   │   └── test_api.py        # API contract tests
│   │
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   │   ├── sw.js              # Service worker (PWA / offline)
│   │   └── manifest.json      # PWA manifest
│   │
│   └── src/
│       ├── App.jsx            # Routes
│       ├── main.jsx           # Entry + service worker registration
│       │
│       ├── pages/
│       │   ├── Home.jsx              # Landing page
│       │   ├── Login.jsx / Signup.jsx
│       │   ├── Detection.jsx         # Real-time detection UI
│       │   │
│       │   └── dashboard/
│       │       ├── DashboardHome.jsx
│       │       ├── TopicsIndex.jsx        # All detected topics
│       │       ├── TopicDetails.jsx       # Topic + roadmap
│       │       ├── Analytics.jsx          # Real-time analytics from BKT
│       │       ├── DependencyGraph.jsx    # Interactive concept graph
│       │       ├── Timetable.jsx          # Study schedule
│       │       ├── LearningMode.jsx       # Focused learning (sidebar + tabs)
│       │       ├── ReviewQueue.jsx        # Spaced repetition queue
│       │       ├── LearningReport.jsx     # Full learning report + export
│       │       ├── Classrooms.jsx         # Classrooms + leaderboards
│       │       │
│       │       └── topic/
│       │           └── RoadmapIndex.jsx   # Subtopic accordion with explainer/resources/quiz
│       │
│       ├── features/
│       │   ├── detector/
│       │   │   ├── DetectorContext.jsx
│       │   │   └── TopicCard.jsx
│       │   └── roadmap/
│       │       └── progress.js
│       │
│       ├── services/
│       │   └── api.js                    # API client (50+ functions)
│       │
│       └── layouts/
│           ├── PublicLayout.jsx
│           └── DashboardLayout.jsx
│
├── db/
│   └── migrations/
│       ├── 0001_init.sql              # Core tables + RLS
│       ├── 0002_hardening.sql         # Triggers + indexes
│       └── 0003_roadmap_features.sql  # BKT, review, classrooms, sessions
│
├── docs/
│   ├── SETUP.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── CONTRIBUTING.md
│
├── docker-compose.yml         # Backend + frontend + dev profile
├── CHANGELOG.md
└── README.md
```

---

## Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Tesseract OCR**
  - Windows: [Download installer](https://github.com/UB-Mannheim/tesseract/wiki) — auto-detected, no config needed
  - macOS: `brew install tesseract`
  - Linux: `apt install tesseract-ocr`
- **Google Gemini API key** (minimum; other LLMs optional)
- **Supabase project** (free tier works)

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

---

## Configuration

> Full step-by-step setup in [docs/SETUP.md](docs/SETUP.md).

### 1. Database migrations

In your Supabase SQL Editor, run in order:

```
db/migrations/0001_init.sql
db/migrations/0002_hardening.sql
db/migrations/0003_roadmap_features.sql
```

Under **Authentication → URL Configuration** add `http://localhost:5173` as a redirect URL.

### 2. Backend `.env`

```env
GOOGLE_API_KEY=your_gemini_api_key

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Optional
SERPAPI_API_KEY=your_serpapi_key
LLM_PROVIDER=gemini                # gemini | claude | openai | ollama
OCR_ENABLED=true                   # set false to disable screen capture
# ENV=production
```

### 3. Frontend `.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
# VITE_API_BASE_URL=/api
```

---

## Usage

### Development

```bash
# Backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm run dev
```

### Docker (production)

```bash
docker compose up --build

# Dev mode with hot-reload frontend
docker compose --profile dev up
```

### Application flow

1. Sign up / log in
2. Go to **Detection** and start screen capture — topics appear automatically as you study
3. Click a topic to open its detail view — see summary, snippets, and the learning roadmap
4. Expand a subtopic to run **Explainer**, load **Resources**, and take a **Quiz**
5. Check **Analytics** for real-time mastery scores
6. Use **Review Queue** to work through spaced-repetition flashcards
7. Generate a **Timetable** to schedule upcoming study sessions
8. View a full **Learning Report** (with JSON export)
9. Create a **Classroom** to share roadmaps and compete on the leaderboard

---

## API Reference

Visit `http://localhost:8000/docs` for full Swagger documentation.

### Key endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/detector/topics` | GET | List all detected topics |
| `/detector/topics/{id}` | GET | Topic details with subtopics and confidence |
| `/detector/topics/{id}/explainer` | GET | AI explanation for a subtopic |
| `/detector/topics/{id}/quiz` | GET | Quiz with difficulty adaptation |
| `/detector/topics/{id}/quiz/submit` | POST | Submit answers, update BKT mastery |
| `/detector/topics/{id}/resources` | GET | Curated resources for subtopic |
| `/detector/topics/{id}/graph` | GET | Concept dependency graph |
| `/analytics` | GET | Real-time analytics from BKT state |
| `/streaks` | GET | Current / longest streak |
| `/review-queue` | GET | Overdue spaced-repetition items |
| `/daily-progress` | GET | Today's quiz goal progress |
| `/report` | GET | Full learning report |
| `/classrooms` | GET / POST | List / create classrooms |
| `/classrooms/join` | POST | Join classroom by code |
| `/leaderboard` | GET | Classroom leaderboard |
| `/study-sessions/start` | POST | Start a timed study session |
| `/study-sessions/end` | POST | End session, record duration |
| `/resources/vote` | POST | Upvote / downvote a resource |
| `/health` | GET | Extended health (Supabase + LLM ping) |
| `/usage-stats` | GET | LLM provider telemetry |
| `/timetable/generate` | POST | Generate study timetable |

---

## Tests

```bash
# Backend
cd backend && python -m pytest

# Frontend
cd frontend && npm run test
```

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

1. Fork and create a feature branch
2. Run tests before submitting
3. Open a PR against `main`

---

## License

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).

See [LICENSE.md](LICENSE.md) or https://creativecommons.org/licenses/by-nc/4.0/

---

## Acknowledgments

- [Google Gemini](https://ai.google.dev/) — default LLM
- [FastAPI](https://fastapi.tiangolo.com/) — backend
- [React](https://react.dev/) — frontend
- [Supabase](https://supabase.com/) — auth + database
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) — text recognition
