"""Tests for the 4-parameter BKT engine."""

import pytest
from datetime import datetime, timezone, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bkt import (
    bkt_update, bkt_update_from_score, apply_mastery_decay,
    compute_stability, next_review_date, get_review_queue,
    get_difficulty_level, compute_streak, get_daily_goal_progress,
    DEFAULT_PARAMS, SR_INTERVALS,
)


class TestBKTUpdate:
    def test_correct_answer_increases_mastery(self):
        p = bkt_update(0.3, True)
        assert p > 0.3

    def test_incorrect_answer_can_still_increase_via_learning(self):
        p = bkt_update(0.1, False)
        # With p_learn=0.3, even a wrong answer bumps mastery slightly
        assert p > 0.0

    def test_high_mastery_correct_stays_high(self):
        p = bkt_update(0.95, True)
        assert p >= 0.95

    def test_mastery_clamped_to_0_1(self):
        p = bkt_update(0.0, False)
        assert 0.0 <= p <= 1.0
        p = bkt_update(1.0, True)
        assert 0.0 <= p <= 1.0

    def test_custom_params(self):
        params = {"p_init": 0.1, "p_learn": 0.5, "p_slip": 0.05, "p_guess": 0.2}
        p = bkt_update(0.3, True, params)
        assert p > 0.3


class TestBKTUpdateFromScore:
    def test_perfect_score_increases_mastery(self):
        p = bkt_update_from_score(0.2, correct_count=5, total=5)
        assert p > 0.5

    def test_zero_score(self):
        p = bkt_update_from_score(0.5, correct_count=0, total=5)
        assert 0.0 <= p <= 1.0

    def test_empty_quiz(self):
        p = bkt_update_from_score(0.5, correct_count=0, total=0)
        assert p == 0.5


class TestMasteryDecay:
    def test_no_decay_at_zero_days(self):
        assert apply_mastery_decay(0.8, 0.0) == 0.8

    def test_decay_over_time(self):
        d = apply_mastery_decay(0.8, 30.0)
        assert d < 0.8

    def test_decay_never_negative(self):
        d = apply_mastery_decay(0.5, 1000.0)
        assert d >= 0.0

    def test_zero_mastery_stays_zero(self):
        assert apply_mastery_decay(0.0, 10.0) == 0.0


class TestComputeStability:
    def test_no_attempts(self):
        s = compute_stability(0, 0.5)
        assert s == pytest.approx(0.25, abs=0.01)

    def test_many_attempts_high_score(self):
        s = compute_stability(20, 1.0)
        assert s == pytest.approx(1.0, abs=0.01)

    def test_moderate_attempts(self):
        s = compute_stability(5, 0.7)
        assert 0.0 <= s <= 1.0


class TestNextReviewDate:
    def test_first_review(self):
        now = datetime.now(timezone.utc)
        review = next_review_date(now, stability=0.0, interval_index=0)
        expected = now + timedelta(days=SR_INTERVALS[0] * 0.5)
        assert abs((review - expected).total_seconds()) < 1

    def test_higher_stability_longer_interval(self):
        now = datetime.now(timezone.utc)
        r1 = next_review_date(now, stability=0.2, interval_index=2)
        r2 = next_review_date(now, stability=0.8, interval_index=2)
        assert r2 > r1


class TestReviewQueue:
    def test_empty_state(self):
        assert get_review_queue({}) == []

    def test_due_items_returned(self):
        old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        state = {
            "topic1": {
                "subtopics": {
                    "sub1": {
                        "mastery": 0.5,
                        "attempts": 3,
                        "lastScorePct": 70,
                        "last_seen": old,
                        "sr_interval_index": 0,
                    }
                }
            }
        }
        queue = get_review_queue(state)
        assert len(queue) >= 1
        assert queue[0]["topicId"] == "topic1"


class TestDifficultyLevel:
    def test_new_student(self):
        assert get_difficulty_level(0.0, 0) == "easy"

    def test_intermediate(self):
        assert get_difficulty_level(0.5, 5) == "medium"

    def test_advanced(self):
        assert get_difficulty_level(0.7, 10) == "hard"

    def test_expert(self):
        assert get_difficulty_level(0.9, 20) == "expert"


class TestComputeStreak:
    def test_empty_dates(self):
        result = compute_streak([])
        assert result["currentStreak"] == 0

    def test_consecutive_days(self):
        today = datetime.now(timezone.utc).date()
        dates = [
            (today - timedelta(days=2)).isoformat(),
            (today - timedelta(days=1)).isoformat(),
            today.isoformat(),
        ]
        result = compute_streak(dates)
        assert result["currentStreak"] == 3
        assert result["longestStreak"] == 3
        assert result["todayComplete"] is True

    def test_broken_streak(self):
        today = datetime.now(timezone.utc).date()
        dates = [
            (today - timedelta(days=5)).isoformat(),
            (today - timedelta(days=1)).isoformat(),
            today.isoformat(),
        ]
        result = compute_streak(dates)
        assert result["currentStreak"] == 2
        assert result["longestStreak"] == 2


class TestDailyGoalProgress:
    def test_empty_state(self):
        result = get_daily_goal_progress({})
        assert result["quizzesToday"] == 0
        assert result["completed"] is False

    def test_goal_met(self):
        today = datetime.now(timezone.utc).isoformat()
        state = {
            "t1": {"subtopics": {"s1": {"last_seen": today}, "s2": {"last_seen": today}, "s3": {"last_seen": today}}}
        }
        result = get_daily_goal_progress(state, goal_quizzes=3)
        assert result["quizzesToday"] == 3
        assert result["completed"] is True
