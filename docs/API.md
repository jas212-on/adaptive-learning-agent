# API Reference

Base URL (dev): `http://localhost:8000`
Base URL (Docker): `http://localhost:8000` (proxied via nginx at `/api`)

All authenticated endpoints require `Authorization: Bearer <supabase-jwt>`.
Rate-limited endpoints use `slowapi` (AI: 10 req/min, data: 60 req/min per IP by default).

Visit `http://localhost:8000/docs` for interactive Swagger UI.

---

## Health

### `GET /`
```json
{"message": "Adaptive Learning Agent API"}
```

### `GET /health`
Extended health — pings Supabase and LLM.
```json
{
  "status": "ok",
  "supabase": "ok",
  "llm_provider": "gemini",
  "llm_latency_ms": 120
}
```

### `GET /usage-stats`
LLM provider telemetry (calls, latency, token usage, errors).

---

## Detection

### `POST /detect/topic`
Detect topic from text (used by OCR loop).
```json
// Request
{"text": "...", "title": "VS Code - App.jsx"}
// Response
{"topic": "React Hooks", "subtopics": ["useState", "useEffect"], "confidence": null}
```

### `GET /ocr/status`
### `GET /ocr/log`
### `POST /ocr/start`
### `POST /ocr/stop`

### `GET /detector/status`
### `POST /detector/start`
### `POST /detector/stop`

---

## Topics

### `GET /detector/topics`
List all detected topics.
```json
[
  {
    "id": "react-hooks",
    "title": "React Hooks",
    "level": "intermediate",
    "confidence": 0.6,
    "tags": [],
    "subtopics": ["useState", "useEffect", "useCallback"],
    "summary": "useState manages local state • useEffect runs side effects...",
    "snippets": [{"source": "screen", "where": "VS Code", "text": "...", "strength": "medium"}]
  }
]
```

### `GET /detector/topics/{topic_id}`
Single topic. Same shape as above.

Confidence is derived from snippet count (more evidence = higher).
Level is derived from average BKT mastery across subtopics.

### `GET /detector/topics/{topic_id}/explainer?subtopic_id=<id>`
Generate (or return cached) an explainer for a subtopic. **Rate limited (AI).**
```json
{
  "overview": "useState is a React Hook that...",
  "prerequisites": ["JavaScript closures", "React components"],
  "keyIdeas": ["State is local to component", "Triggers re-render"],
  "pitfalls": ["Stale closures", "Calling hooks conditionally"]
}
```

### `GET /detector/topics/{topic_id}/resources?subtopic_id=<id>&limit=8`
Curated resources via SerpAPI (cached in Supabase).
```json
{
  "query": "useState React Hook tutorial",
  "topicId": "react-hooks",
  "subtopicId": "usestate",
  "resources": [
    {"title": "React Docs", "url": "https://...", "type": "docs", "source": "react.dev", "snippet": "...", "score": 90}
  ]
}
```

### `GET /detector/topics/{topic_id}/quiz?subtopic_id=<id>&n_questions=5&difficulty=auto`
Generate (or return cached) a quiz. Difficulty: `auto | easy | medium | hard | expert`.
`auto` derives difficulty from current BKT mastery. **Rate limited (AI).**
```json
{
  "questions": [
    {
      "question": "What does useState return?",
      "options": ["A value", "An array of [state, setter]", "A promise", "An object"],
      "correct_index": 1,
      "explanation": "useState returns a tuple: the current state value and a setter function.",
      "difficulty": "easy",
      "skill": "conceptual"
    }
  ],
  "subtopicId": "usestate",
  "difficulty": "easy"
}
```

### `POST /detector/topics/{topic_id}/quiz/submit`
Submit answers and update BKT mastery. Updates `review_schedule` and `study_sessions`.
```json
// Request
{
  "subtopicId": "usestate",
  "answers": [1, 0, 2, 3, 1],
  "clientTime": "2026-06-14T10:00:00Z"
}
// Response
{
  "total": 5,
  "correctCount": 4,
  "scorePct": 80,
  "mastery": 0.72,
  "graded": [true, false, true, true, true],
  "questions": [
    {"correct_index": 1, "explanation": "...", "user_answer": 1, "is_correct": true}
  ]
}
```

### `GET /detector/topics/{topic_id}/graph?max_depth=2&max_children=5&use_gemini=true`
Concept dependency graph (AI-powered expansion, cached).
```json
{
  "nodes": [{"id": "react-hooks", "label": "React Hooks", "kind": "core", "depth": 0}],
  "edges": [{"from": "react-hooks", "to": "usestate", "relation": "subtopic"}],
  "rootId": "react-hooks",
  "maxDepth": 2
}
```

### `GET /quiz/difficulty/{topic_id}/{subtopic_id}`
Get recommended difficulty for a subtopic based on BKT mastery.
```json
{"difficulty": "medium", "mastery": 0.45, "attempts": 3}
```

---

## BKT / Spaced Repetition

### `GET /streaks`
```json
{"currentStreak": 5, "longestStreak": 12, "lastActive": "2026-06-14"}
```

### `GET /review-queue`
Items overdue for review, sorted by urgency.
```json
{
  "items": [
    {
      "topicId": "react-hooks",
      "topicTitle": "React Hooks",
      "subtopicId": "usestate",
      "subtopicTitle": "useState",
      "mastery": 0.48,
      "daysOverdue": 2,
      "urgency": 0.8
    }
  ],
  "totalDue": 3
}
```

### `GET /daily-progress`
Today's quiz attempt count vs daily goal.
```json
{"quizzesCompleted": 3, "dailyQuizGoal": 5, "minutesStudied": 25, "dailyMinutesGoal": 30}
```

### `PUT /daily-progress/goal`
```json
// Request
{"dailyQuizGoal": 8, "dailyMinutesGoal": 45}
```

---

## Analytics

### `GET /analytics`
Real-time analytics from BKT state and study sessions.
```json
{
  "streakDays": 5,
  "timeSpentMinutes": 120,
  "topicsLearned": 2,
  "avgScore": 68,
  "byTopic": [
    {"id": "react-hooks", "title": "React Hooks", "progress": 0.68, "score": 68, "minutes": 40}
  ]
}
```

`timeSpentMinutes` is read from `study_sessions`; falls back to 5 min × total quiz attempts.
`progress` and `score` reflect BKT mastery (with Ebbinghaus decay applied).

### `GET /suggestions?force=false`
AI-generated study suggestions. **Rate limited (AI).**

### `POST /assistant/chat`
Ask a question to the topic-focused learning assistant (Gemini-powered). **Rate limited (AI).**
```json
// Request
{
  "topicTitle": "React Hooks",
  "question": "What is the difference between useEffect and useLayoutEffect?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! I am your React Hooks learning assistant. Ask me anything."}
  ]
}
// Response
{
  "answer": "useLayoutEffect fires synchronously after all DOM mutations but before the browser paints. useEffect fires asynchronously after paint."
}
```

### `GET /report`
Full learning report.
```json
{
  "summary": {"totalTopics": 5, "totalQuizzes": 22, "avgScore": 71, "totalMinutes": 180, "streak": 5},
  "byTopic": [...],
  "quizHistory": [...],
  "studyTime": {"byActivity": {...}, "byTopic": {...}}
}
```

---

## Study Sessions

### `POST /study-sessions/start`
```json
{"topicId": "react-hooks", "subtopicId": "usestate", "activity": "quiz"}
// Response: {"sessionId": "uuid", "startedAt": "..."}
```

### `POST /study-sessions/end`
```json
{"sessionId": "uuid", "durationSeconds": 300}
```

### `GET /study-sessions/stats?days=30`

---

## Resources

### `POST /resources/vote`
```json
{"topicId": "react-hooks", "subtopicId": "usestate", "resourceUrl": "https://...", "vote": 1}
```
`vote`: `1` (up) or `-1` (down).

### `GET /resources/votes?topic_id=react-hooks`

---

## Generated Content

### `POST /content/store`
```json
{"topicId": "react-hooks", "subtopicId": "usestate", "contentType": "explainer", "content": {...}}
```

### `GET /content/{topic_id}?content_type=explainer&subtopic_id=usestate`

---

## Classrooms

### `GET /classrooms`
### `POST /classrooms`
```json
{"name": "COMP3001 Study Group", "description": "optional"}
// Response: {"id": "uuid", "joinCode": "ABC123", ...}
```

### `POST /classrooms/join`
```json
{"joinCode": "ABC123"}
```

### `GET /classrooms/{classroom_id}`
Classroom detail with members list.

### `GET /leaderboard?classroom_id=<id>`
```json
{"entries": [{"rank": 1, "displayName": "You", "score": 840, "isYou": true}]}
```

### `POST /shared-roadmaps`
```json
{"topicId": "react-hooks", "title": "React Roadmap", "subtopics": [...], "classroomId": "uuid", "isPublic": false}
```

### `GET /shared-roadmaps?classroom_id=<id>`

---

## Progress (Roadmap)

### `GET /progress/{topic_id}`
Returns per-subtopic progress stored in Supabase.

### `PUT /progress`
Upsert roadmap progress (idempotent — `true` never reverts to `false`).
```json
{"topicId": "react-hooks", "subtopicId": "usestate", "explainerDone": true, "resourcesDone": true, "quizDone": false}
```

---

## Timetable

### `POST /timetable/generate`
Generate an optimized study schedule.
```json
{
  "events": [{"event_type": "exam", "subject": "Math", "topic": "Calculus", "target_date": "2026-07-01", "priority_level": 9, "estimated_effort_hours": 10}],
  "availability": {"weekday_hours": 4, "weekend_hours": 6, "start_time": "09:00", "end_time": "21:00"},
  "preferences": {"session_length_minutes": 45, "max_sessions_per_day": 6},
  "topics": [{"id": "calculus", "subject": "Math", "topic": "Calculus", "difficulty_score": 0.7, "confidence_score": 0.4}]
}
```

### `GET /timetable/sample`
### `POST /timetable/validate`

---

## Settings

### `GET /settings`
Retrieve user settings (theme, lastViewed position etc.) from Supabase. Auth required.

### `PUT /settings`
Save user settings (theme, lastViewed position etc.) to Supabase. Auth required.
