"""API contract tests using FastAPI TestClient."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Set required env vars before importing the app
import os
os.environ.setdefault("VITE_SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("VITE_SUPABASE_ANON_KEY", "placeholder-key")
os.environ.setdefault("LOG_FORMAT", "text")

from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from server import app
    return TestClient(app)


class TestRootEndpoint:
    def test_root_returns_200(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "message" in r.json()


class TestHealthEndpoint:
    def test_health_returns_json(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data


class TestStreaksEndpoint:
    def test_streaks_returns_json(self, client):
        r = client.get("/streaks")
        assert r.status_code == 200
        data = r.json()
        assert "currentStreak" in data
        assert "longestStreak" in data


class TestAnalyticsEndpoint:
    def test_analytics_returns_json(self, client):
        r = client.get("/analytics")
        assert r.status_code == 200
        data = r.json()
        assert "avgScore" in data
        assert "byTopic" in data


class TestReviewQueue:
    def test_review_queue_returns_json(self, client):
        r = client.get("/review-queue")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)


class TestDailyProgress:
    def test_daily_progress_returns_json(self, client):
        r = client.get("/daily-progress")
        assert r.status_code == 200
        data = r.json()
        assert "quizzesToday" in data
        assert "currentStreak" in data


class TestQuizDifficulty:
    def test_quiz_difficulty_returns_json(self, client):
        r = client.get("/quiz/difficulty/test-topic/test-subtopic")
        assert r.status_code == 200
        data = r.json()
        assert "recommendedDifficulty" in data
        assert data["recommendedDifficulty"] in ("easy", "medium", "hard", "expert")


class TestDetectorTopics:
    def test_topics_returns_list(self, client):
        r = client.get("/detector/topics")
        assert r.status_code == 200


class TestAskEndpoint:
    def test_empty_prompt_returns_400(self, client):
        r = client.post("/ask", json={"prompt": "  "})
        assert r.status_code == 400


class TestRateLimitHandler:
    def test_rate_limit_returns_json(self, client):
        # Just verify the endpoint exists and returns proper shape
        # (actual rate limiting depends on slowapi config)
        r = client.post("/ask", json={"prompt": "test"})
        # Will be 503 (no API key) or 200 or 429
        assert r.status_code in (200, 429, 503)
