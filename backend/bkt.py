"""Full 4-parameter Bayesian Knowledge Tracing engine with mastery decay and spaced repetition."""

from __future__ import annotations

import json
import math
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any


def _backend_dir() -> Path:
    return Path(__file__).resolve().parent


# ── 4-Parameter BKT ──────────────────────────────────────────────────────────
# p_init : probability of initial mastery
# p_learn: probability of learning on each opportunity
# p_slip : probability of incorrect answer despite mastery
# p_guess: probability of correct answer despite non-mastery

DEFAULT_PARAMS = {
    "p_init": 0.1,
    "p_learn": 0.3,
    "p_slip": 0.1,
    "p_guess": 0.25,
}

# Per-concept overrides by skill type (conceptual vs procedural)
SKILL_PARAMS = {
    "conceptual": {"p_init": 0.15, "p_learn": 0.35, "p_slip": 0.08, "p_guess": 0.25},
    "procedural": {"p_init": 0.05, "p_learn": 0.25, "p_slip": 0.12, "p_guess": 0.20},
}

# Mastery decay — Ebbinghaus forgetting curve parameters
DECAY_RATE = 0.02  # daily decay constant
MIN_MASTERY = 0.0

# Spaced repetition — review intervals (in days) by stability bucket
SR_INTERVALS = [1, 3, 7, 14, 30, 60, 120]
MASTERY_THRESHOLD = 0.75  # schedule review when mastery drops below this


_bkt_lock = threading.Lock()


def _bkt_state_path() -> Path:
    return _backend_dir() / "bkt_state.json"


def load_bkt_state() -> dict[str, Any]:
    path = _bkt_state_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_bkt_state(state: dict[str, Any]) -> None:
    path = _bkt_state_path()
    try:
        path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def get_params(skill_type: str | None = None) -> dict[str, float]:
    if skill_type and skill_type in SKILL_PARAMS:
        return SKILL_PARAMS[skill_type].copy()
    return DEFAULT_PARAMS.copy()


def bkt_update(p_mastery: float, is_correct: bool, params: dict[str, float] | None = None) -> float:
    """Single-step 4-parameter BKT update.

    Given prior p(L), the observation (correct/incorrect), and parameters,
    returns the posterior p(L).
    """
    if params is None:
        params = DEFAULT_PARAMS

    p_l = max(0.0, min(1.0, p_mastery))
    p_s = params["p_slip"]
    p_g = params["p_guess"]
    p_t = params["p_learn"]

    if is_correct:
        # P(L|correct) = P(correct|L)*P(L) / P(correct)
        p_correct_given_l = 1.0 - p_s
        p_correct_given_not_l = p_g
        p_correct = p_correct_given_l * p_l + p_correct_given_not_l * (1.0 - p_l)
        if p_correct < 1e-10:
            p_correct = 1e-10
        p_l_given_obs = (p_correct_given_l * p_l) / p_correct
    else:
        # P(L|incorrect) = P(incorrect|L)*P(L) / P(incorrect)
        p_incorrect_given_l = p_s
        p_incorrect_given_not_l = 1.0 - p_g
        p_incorrect = p_incorrect_given_l * p_l + p_incorrect_given_not_l * (1.0 - p_l)
        if p_incorrect < 1e-10:
            p_incorrect = 1e-10
        p_l_given_obs = (p_incorrect_given_l * p_l) / p_incorrect

    # Apply learning transition: P(L_new) = P(L|obs) + (1 - P(L|obs)) * P(T)
    p_new = p_l_given_obs + (1.0 - p_l_given_obs) * p_t
    return max(0.0, min(1.0, p_new))


def bkt_update_from_score(p_mastery: float, correct_count: int, total: int,
                          params: dict[str, float] | None = None) -> float:
    """Apply BKT updates for each question in a quiz attempt."""
    if total <= 0:
        return p_mastery
    p = p_mastery
    for i in range(total):
        is_correct = i < correct_count
        p = bkt_update(p, is_correct, params)
    return p


def apply_mastery_decay(mastery: float, days_since_last: float) -> float:
    """Ebbinghaus-inspired forgetting curve: m * exp(-DECAY_RATE * days)."""
    m = max(0.0, min(1.0, float(mastery)))
    d = max(0.0, float(days_since_last))
    decayed = m * math.exp(-DECAY_RATE * d)
    return max(MIN_MASTERY, decayed)


def compute_stability(attempts: int, avg_score: float) -> float:
    """Compute memory stability (how well the knowledge is cemented).

    Higher stability = slower decay. Based on attempt count and average performance.
    Returns a value 0-1 that scales the review interval.
    """
    base = min(attempts / 10.0, 1.0)
    performance = max(0.0, min(1.0, avg_score))
    return base * 0.5 + performance * 0.5


def next_review_date(last_seen: datetime, stability: float, interval_index: int) -> datetime:
    """Compute the next optimal review date based on spaced repetition scheduling."""
    idx = max(0, min(interval_index, len(SR_INTERVALS) - 1))
    base_interval = SR_INTERVALS[idx]
    # Scale interval by stability: higher stability = longer interval
    scaled_interval = base_interval * (0.5 + stability)
    return last_seen + timedelta(days=scaled_interval)


def get_review_queue(state: dict[str, Any], now: datetime | None = None) -> list[dict[str, Any]]:
    """Return topics/subtopics that are due for review based on spaced repetition.

    Returns a list sorted by urgency (most overdue first).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    due_items: list[dict[str, Any]] = []

    for topic_id, tdata in state.items():
        if not isinstance(tdata, dict):
            continue
        subs = tdata.get("subtopics")
        if not isinstance(subs, dict):
            continue
        for sub_id, skill in subs.items():
            if not isinstance(skill, dict):
                continue

            mastery = float(skill.get("mastery", 0.0))
            attempts = int(skill.get("attempts", 0))
            if attempts == 0:
                continue

            last_seen_str = skill.get("last_seen") or skill.get("updatedAt")
            if not isinstance(last_seen_str, str):
                continue

            try:
                last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
            except Exception:
                continue

            days_since = max(0.0, (now - last_seen).total_seconds() / 86400.0)
            decayed_mastery = apply_mastery_decay(mastery, days_since)

            avg_score = float(skill.get("lastScorePct", 50)) / 100.0
            stability = compute_stability(attempts, avg_score)
            interval_idx = skill.get("sr_interval_index", 0)
            review_date = next_review_date(last_seen, stability, interval_idx)

            if decayed_mastery < MASTERY_THRESHOLD or now >= review_date:
                overdue_days = (now - review_date).total_seconds() / 86400.0
                due_items.append({
                    "topicId": topic_id,
                    "subtopicId": sub_id,
                    "mastery": round(mastery, 4),
                    "decayedMastery": round(decayed_mastery, 4),
                    "daysSinceReview": round(days_since, 1),
                    "overdueDays": round(max(0, overdue_days), 1),
                    "reviewDate": review_date.isoformat(),
                    "stability": round(stability, 3),
                    "attempts": attempts,
                    "urgency": round(max(0, overdue_days) + (MASTERY_THRESHOLD - decayed_mastery) * 10, 2),
                })

    due_items.sort(key=lambda x: x["urgency"], reverse=True)
    return due_items


def update_on_quiz_submit(
    *, topic_id: str, subtopic_id: str,
    score_pct: int, correct_count: int, total: int,
    submitted_at: str, skill_type: str | None = None,
) -> dict[str, Any]:
    """Full BKT update on quiz submission. Returns updated skill data."""
    params = get_params(skill_type)

    with _bkt_lock:
        state = load_bkt_state()
        topic_state = state.get(topic_id)
        if not isinstance(topic_state, dict):
            topic_state = {}
        skills = topic_state.get("subtopics")
        if not isinstance(skills, dict):
            skills = {}
        skill = skills.get(subtopic_id)
        if not isinstance(skill, dict):
            skill = {"mastery": params["p_init"], "attempts": 0, "sr_interval_index": 0, "scores": []}

        prev_mastery = float(skill.get("mastery", params["p_init"]))
        last_seen_str = skill.get("last_seen") or skill.get("updatedAt")
        days_since = 0.0
        if last_seen_str:
            try:
                last_dt = datetime.fromisoformat(str(last_seen_str).replace("Z", "+00:00"))
                now_dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                days_since = max(0.0, (now_dt - last_dt).total_seconds() / 86400.0)
            except Exception:
                pass

        decayed = apply_mastery_decay(prev_mastery, days_since)
        mastery = bkt_update_from_score(decayed, correct_count, total, params)

        attempt_count = int(skill.get("attempts", 0)) + 1
        scores = skill.get("scores", [])
        if not isinstance(scores, list):
            scores = []
        scores.append(int(score_pct))
        scores = scores[-20:]  # keep last 20

        sr_idx = int(skill.get("sr_interval_index", 0))
        if score_pct >= 80:
            sr_idx = min(sr_idx + 1, len(SR_INTERVALS) - 1)
        elif score_pct < 50:
            sr_idx = max(sr_idx - 1, 0)

        skill.update({
            "mastery": mastery,
            "attempts": attempt_count,
            "lastScorePct": int(score_pct),
            "lastCorrectCount": int(correct_count),
            "lastTotal": int(total),
            "updatedAt": submitted_at,
            "last_seen": submitted_at,
            "sr_interval_index": sr_idx,
            "scores": scores,
            "skill_type": skill_type,
            "bkt_params": params,
        })

        skills[subtopic_id] = skill
        topic_state["subtopics"] = skills
        topic_state["updatedAt"] = submitted_at
        state[topic_id] = topic_state
        save_bkt_state(state)

    return {"mastery": mastery, "attempts": attempt_count, "sr_interval_index": sr_idx}


def get_difficulty_level(mastery: float, attempts: int) -> str:
    """Return recommended quiz difficulty based on current mastery."""
    if attempts == 0 or mastery < 0.3:
        return "easy"
    if mastery < 0.6:
        return "medium"
    if mastery < 0.85:
        return "hard"
    return "expert"


def compute_streak(dates: list[Any]) -> dict[str, Any]:
    """Compute current and longest streak from a list of date strings or date objects."""
    from datetime import date as date_type

    unique_dates: set[date_type] = set()
    for d in dates:
        if isinstance(d, str):
            try:
                dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
                unique_dates.add(dt.date())
            except Exception:
                continue
        elif isinstance(d, date_type):
            unique_dates.add(d)
        elif isinstance(d, datetime):
            unique_dates.add(d.date())

    if not unique_dates:
        return {"currentStreak": 0, "longestStreak": 0, "lastStudiedAt": None, "todayComplete": False}

    sorted_dates = sorted(unique_dates)
    today = datetime.now(timezone.utc).date()
    last_studied = sorted_dates[-1]
    today_complete = last_studied == today

    longest = 0
    streak = 0
    prev = None
    for d in sorted_dates:
        if prev is None or (d - prev).days == 1:
            streak += 1
        elif (d - prev).days > 1:
            streak = 1
        longest = max(longest, streak)
        prev = d

    current = 0
    check = today
    for d in reversed(sorted_dates):
        if d == check:
            current += 1
            check -= timedelta(days=1)
        elif d < check:
            break

    return {
        "currentStreak": current,
        "longestStreak": longest,
        "lastStudiedAt": last_studied.isoformat(),
        "todayComplete": today_complete,
        "totalDaysStudied": len(unique_dates),
    }


def get_daily_goal_progress(state: dict[str, Any], goal_quizzes: int = 3) -> dict[str, Any]:
    """Check progress toward daily study goal."""
    today = datetime.now(timezone.utc).date().isoformat()
    quizzes_today = 0
    topics_today: set[str] = set()

    for topic_id, tdata in state.items():
        if not isinstance(tdata, dict):
            continue
        subs = tdata.get("subtopics")
        if not isinstance(subs, dict):
            continue
        for sub_id, skill in subs.items():
            if not isinstance(skill, dict):
                continue
            last_seen = skill.get("last_seen") or skill.get("updatedAt")
            if isinstance(last_seen, str) and last_seen.startswith(today):
                quizzes_today += 1
                topics_today.add(topic_id)

    return {
        "quizzesToday": quizzes_today,
        "goalQuizzes": goal_quizzes,
        "completed": quizzes_today >= goal_quizzes,
        "topicsStudiedToday": len(topics_today),
        "progressPct": min(100, int(round(quizzes_today / max(1, goal_quizzes) * 100))),
    }
