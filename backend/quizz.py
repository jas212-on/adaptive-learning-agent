from __future__ import annotations

import json
import os
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


# NOTE: This module is intentionally self-contained.
# It can be imported by your API layer (FastAPI) or used as a CLI.


def _backend_dir() -> Path:
	return Path(__file__).resolve().parent


def _slugify(value: str) -> str:
	value = (value or "").strip().lower()
	value = re.sub(r"[^a-z0-9]+", "-", value)
	value = re.sub(r"-+", "-", value).strip("-")
	return value or "item"


def _now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


def _extract_json_object(text: str) -> str | None:
	"""Best-effort JSON object extraction from LLM text."""
	if not text:
		return None
	s = text.strip()
	if s.startswith("```"):
		s = re.sub(r"^```[a-zA-Z]*\n", "", s)
		s = re.sub(r"\n```$", "", s).strip()
	m = re.search(r"\{[\s\S]*\}\s*$", s)
	if m:
		return m.group(0)
	m = re.search(r"\{[\s\S]*\}", s)
	if m:
		return m.group(0)
	return None


def _clean_choices(choices: Any) -> list[str]:
	if not isinstance(choices, list):
		return []
	out: list[str] = []
	for c in choices:
		if not isinstance(c, str):
			continue
		t = re.sub(r"\s+", " ", c).strip()
		if t:
			out.append(t)
	return out


def _safe_int(x: Any, default: int) -> int:
	try:
		v = int(x)
		return v
	except Exception:
		return default



def _normalize_questions(raw_questions: Any, n: int) -> list[dict[str, Any]]:
	if not isinstance(raw_questions, list):
		return []

	out: list[dict[str, Any]] = []
	for idx, q in enumerate(raw_questions):
		if not isinstance(q, dict):
			continue

		question = q.get("question") or q.get("prompt") or ""
		if not isinstance(question, str):
			continue
		question = re.sub(r"\s+", " ", question).strip()
		if not question:
			continue

		options = _clean_choices(q.get("options") or q.get("choices"))
		if len(options) < 4:
			continue
		options = options[:4]

		correct_answer = q.get("correctAnswer")
		if not isinstance(correct_answer, str) or not correct_answer.strip():
			answer_index = q.get("answerIndex")
			if answer_index is None:
				ans = q.get("answer")
				if isinstance(ans, str):
					ans = ans.strip().upper()
					if ans in ("A", "B", "C", "D"):
						answer_index = ord(ans) - ord("A")
				else:
					answer_index = ans
			answer_index = _safe_int(answer_index, 0)
			if answer_index < 0 or answer_index > 3:
				answer_index = 0
			correct_answer = options[answer_index]
		else:
			correct_answer = re.sub(r"\s+", " ", correct_answer).strip()

		is_correct_val = q.get("isCorrect")
		is_correct: bool | None
		if isinstance(is_correct_val, bool):
			is_correct = is_correct_val
		else:
			is_correct = None

		out.append(
			{
				"question": question,
				"options": options,
				"correctAnswer": correct_answer,
				"isCorrect": is_correct,
			}
		)
		if len(out) >= n:
			break

	return out


def _gemini_client():
	"""Create/configure Gemini model lazily."""
	load_dotenv(_backend_dir() / ".env")
	api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
	if not api_key:
		raise RuntimeError("Gemini API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY in backend/.env")

	import google.generativeai as genai

	genai.configure(api_key=api_key)
	return genai.GenerativeModel("gemini-2.5-flash")


def _cache_root() -> Path:
	return _backend_dir() / "quiz_cache"


def _cache_path(topic_id: str, subtopic_id: str) -> Path:
	return _cache_root() / topic_id / f"{subtopic_id}.json"


def _load_json(path: Path) -> dict[str, Any] | None:
	try:
		obj = json.loads(path.read_text(encoding="utf-8"))
		return obj if isinstance(obj, dict) else None
	except Exception:
		return None


def _write_json(path: Path, obj: dict[str, Any]) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def _content_hash(topic_title: str, subtopic_title: str, n_questions: int) -> str:
	payload = f"{topic_title}\n{subtopic_title}\n{n_questions}".encode("utf-8", errors="ignore")
	return hashlib.sha256(payload).hexdigest()


def load_cached_quiz(topic_title: str, subtopic_title: str, n_questions: int = 5) -> dict[str, Any] | None:
	topic_id = _slugify(topic_title)
	subtopic_id = _slugify(subtopic_title)
	path = _cache_path(topic_id, subtopic_id)
	if not path.exists():
		return None
	try:
		data = _load_json(path)
		if not data:
			return None
		if data.get("hash") != _content_hash(topic_title, subtopic_title, n_questions):
			return None
		return data
	except Exception:
		return None


def _ensure_sets_structure(quiz: dict[str, Any]) -> dict[str, Any]:
	"""Backwards-compatible upgrade: ensure quiz has sets[] + activeSetId.

	Also normalizes stored question shape to:
	- question: str
	- options: list[str]
	- correctAnswer: str
	- isCorrect: bool | null
	"""
	sets = quiz.get("sets")
	if not isinstance(sets, list):
		sets = []
		quiz["sets"] = sets

	active_set_id = quiz.get("activeSetId")
	if not isinstance(active_set_id, str) or not active_set_id:
		active_set_id = None

	# If this is an old file with only top-level questions, migrate it into sets[0].
	if not sets:
		questions = quiz.get("questions")
		if isinstance(questions, list) and questions:
			set_id = "set_1"
			# Migrate grading from legacy lastAttempt if present
			legacy_attempt = quiz.get("lastAttempt")
			graded_map = None
			submitted_at = None
			if isinstance(legacy_attempt, dict):
				g = legacy_attempt.get("graded")
				if isinstance(g, dict):
					graded_map = {k: bool(v) for k, v in g.items() if isinstance(k, str) and isinstance(v, bool)}
				sa = legacy_attempt.get("submittedAt")
				if isinstance(sa, str):
					submitted_at = sa

			# Convert legacy question format (prompt/choices/answerIndex/id) into simplified records.
			normalized = _normalize_questions(questions, n=len(questions))
			if graded_map:
				for old_q, new_q in zip(questions, normalized):
					if isinstance(old_q, dict):
						qid = old_q.get("id")
						if isinstance(qid, str) and qid in graded_map:
							new_q["isCorrect"] = graded_map[qid]

			sets.append(
				{
					"setId": set_id,
					"generatedAt": quiz.get("generatedAt"),
					"submittedAt": submitted_at,
					"focus": None,
					"questions": normalized,
				}
			)
			active_set_id = set_id

	# Ensure activeSetId points at last set if missing/invalid.
	if not active_set_id and sets:
		last = sets[-1]
		if isinstance(last, dict) and isinstance(last.get("setId"), str):
			active_set_id = last["setId"]

	quiz["activeSetId"] = active_set_id

	# Ensure every set's questions are normalized.
	for s in sets:
		if not isinstance(s, dict):
			continue
		qs = s.get("questions")
		if isinstance(qs, list) and qs:
			s["questions"] = _normalize_questions(qs, n=len(qs))

	# Mirror active set questions to top-level questions for frontend compatibility.
	if isinstance(active_set_id, str):
		active = next((s for s in sets if isinstance(s, dict) and s.get("setId") == active_set_id), None)
		if isinstance(active, dict) and isinstance(active.get("questions"), list):
			quiz["questions"] = active["questions"]

	# Drop legacy attempt payloads; grading is stored on questions/isCorrect.
	quiz.pop("lastAttempt", None)
	quiz.pop("attempts", None)

	return quiz


def _attempt_wrong_question_summaries(quiz: dict[str, Any], n_questions: int) -> tuple[str | None, list[str]]:
	"""Return (attempt_key, summaries) based on stored isCorrect flags.

	attempt_key is the submittedAt timestamp of the last graded set.
	"""
	sets = quiz.get("sets")
	if not isinstance(sets, list) or not sets:
		return None, []

	last_graded = None
	for s in reversed(sets):
		if not isinstance(s, dict):
			continue
		sa = s.get("submittedAt")
		if isinstance(sa, str) and sa.strip():
			last_graded = s
			break

	if not last_graded:
		return None, []

	attempt_key = last_graded.get("submittedAt") if isinstance(last_graded.get("submittedAt"), str) else None
	questions = last_graded.get("questions")
	if not isinstance(questions, list):
		return attempt_key, []

	summaries: list[str] = []
	for q in questions:
		if not isinstance(q, dict):
			continue
		if q.get("isCorrect") is not False:
			continue
		qq = q.get("question")
		ca = q.get("correctAnswer")
		if not isinstance(qq, str) or not qq.strip():
			continue
		if not isinstance(ca, str) or not ca.strip():
			continue
		summaries.append(f"- Missed concept from question: {qq}\n  Correct answer: {ca}")
		if len(summaries) >= max(1, min(n_questions, 10)):
			break

	return attempt_key, summaries


def _already_generated_for_attempt(quiz: dict[str, Any], attempt_key: str | None) -> bool:
	if not attempt_key:
		return False
	sets = quiz.get("sets")
	if not isinstance(sets, list) or not sets:
		return False
	last = sets[-1]
	if not isinstance(last, dict):
		return False
	focus = last.get("focus")
	if not isinstance(focus, dict):
		return False
	return focus.get("basedOnSubmittedAt") == attempt_key


def generate_quiz(topic_title: str, subtopic_title: str, n_questions: int = 5, force: bool = False) -> dict[str, Any]:
	"""Generate (or load cached) MCQ quiz JSON for a specific subtopic."""
	topic_title = (topic_title or "").strip()
	subtopic_title = (subtopic_title or "").strip()
	if not topic_title:
		raise ValueError("topic_title is required")
	if not subtopic_title:
		raise ValueError("subtopic_title is required")

	n_questions = max(1, min(int(n_questions), 10))
	topic_id = _slugify(topic_title)
	subtopic_id = _slugify(subtopic_title)
	path = _cache_path(topic_id, subtopic_id)

	# If we already have a file, optionally generate a follow-up set based on lastAttempt.wrong.
	if path.exists() and not force:
		cached = _load_json(path)
		if cached and cached.get("hash") == _content_hash(topic_title, subtopic_title, n_questions):
			cached = _ensure_sets_structure(cached)
			attempt_key, wrong_summaries = _attempt_wrong_question_summaries(cached, n_questions=n_questions)
			if wrong_summaries and not _already_generated_for_attempt(cached, attempt_key):
				try:
					model = _gemini_client()
					prior_prompts: list[str] = []
					for s in cached.get("sets", []):
						if not isinstance(s, dict):
							continue
						qs = s.get("questions")
						if not isinstance(qs, list):
							continue
						for q in qs:
							if isinstance(q, dict) and isinstance(q.get("prompt"), str):
								prior_prompts.append(q["prompt"])
						if len(prior_prompts) >= 30:
							break

					sets_existing = cached.get("sets")
					if not isinstance(sets_existing, list):
						sets_existing = []
					next_set_id = f"set_{len(sets_existing) + 1}"

					prompt = (
						"You are an expert tutor. Create a follow-up multiple-choice quiz that targets a learner's weak areas.\n"
						"Return ONLY valid JSON (no markdown, no backticks).\n\n"
						"JSON schema:\n"
						"{\n"
						"  \"questions\": [\n"
						"    {\n"
						"      \"prompt\": \"...\",\n"
						"      \"choices\": [\"A\", \"B\", \"C\", \"D\"],\n"
						"      \"answerIndex\": 0,\n"
						"      \"skill\": \"conceptual|procedural\"\n"
						"    }\n"
						"  ]\n"
						"}\n\n"
						"Rules:\n"
						f"- Exactly {n_questions} NEW questions\n"
						"- 4 choices each\n"
						"- answerIndex must be 0..3\n"
						"- Do NOT repeat any prior question prompts\n"
						"- Questions must be about the same topic/subtopic, focused on the missed concepts listed below\n\n"
						f"Topic: {topic_title}\n"
						f"Subtopic: {subtopic_title}\n\n"
						"Missed concepts (from previous wrong answers):\n"
						+ "\n".join(wrong_summaries)
						+ "\n\n"
						"Prior prompts to avoid (do not copy these):\n"
						+ "\n".join(f"- {p}" for p in prior_prompts[:30])
					)

					raw = model.generate_content(prompt).text
					obj_text = _extract_json_object(raw)
					if not obj_text:
						raise RuntimeError("Gemini did not return JSON")
					try:
						obj = json.loads(obj_text)
					except Exception as e:
						raise RuntimeError("Failed to parse Gemini JSON") from e

					questions = _normalize_questions(obj.get("questions"), n_questions)
					if len(questions) < n_questions:
						raise RuntimeError(f"Gemini returned insufficient valid questions ({len(questions)}/{n_questions})")

					cached = _ensure_sets_structure(cached)
					sets = cached.get("sets")
					if not isinstance(sets, list):
						sets = []
						cached["sets"] = sets
					set_id = f"set_{len(sets) + 1}"

					sets.append(
						{
							"setId": set_id,
							"generatedAt": _now_iso(),
							"focus": {
								"basedOnSubmittedAt": attempt_key,
							},
							"questions": questions,
						}
					)
					cached["activeSetId"] = set_id
					cached["questions"] = questions
					cached["updatedAt"] = _now_iso()
					_write_json(path, cached)
					return cached
				except Exception:
					_write_json(path, cached)
					return cached

			# No wrong answers (or already generated for the latest attempt) -> return current cached quiz.
			_write_json(path, cached)
			return cached

	# Fresh generation (or forced regeneration)
	model = _gemini_client()

	prompt = (
		"You are an expert tutor. Create a multiple-choice quiz.\n"
		"Return ONLY valid JSON (no markdown, no backticks).\n\n"
		"JSON schema:\n"
		"{\n"
		"  \"questions\": [\n"
		"    {\n"
		"      \"prompt\": \"...\",\n"
		"      \"choices\": [\"A\", \"B\", \"C\", \"D\"],\n"
		"      \"answerIndex\": 0,\n"
		"      \"skill\": \"conceptual|procedural\"\n"
		"    }\n"
		"  ]\n"
		"}\n\n"
		"Rules:\n"
		f"- Exactly {n_questions} questions\n"
		"- 4 choices each\n"
		"- answerIndex must be 0..3\n"
		"- Avoid trick questions; keep to the subtopic\n\n"
		f"Topic: {topic_title}\n"
		f"Subtopic: {subtopic_title}\n"
	)

	raw = model.generate_content(prompt).text
	obj_text = _extract_json_object(raw)
	if not obj_text:
		raise RuntimeError("Gemini did not return JSON")

	try:
		obj = json.loads(obj_text)
	except Exception as e:
		raise RuntimeError("Failed to parse Gemini JSON") from e

	set_id = "set_1"
	questions = _normalize_questions(obj.get("questions"), n_questions)
	if len(questions) < n_questions:
		raise RuntimeError(f"Gemini returned insufficient valid questions ({len(questions)}/{n_questions})")

	payload: dict[str, Any] = {
		"hash": _content_hash(topic_title, subtopic_title, n_questions),
		"generatedAt": _now_iso(),
		"updatedAt": _now_iso(),
		"topicTitle": topic_title,
		"topicId": topic_id,
		"subtopicTitle": subtopic_title,
		"subtopicId": subtopic_id,
		"questions": questions,
		"sets": [
			{
				"setId": set_id,
				"generatedAt": _now_iso(),
				"submittedAt": None,
				"focus": None,
				"questions": questions,
			}
		],
		"activeSetId": set_id,
	}

	# Persist cache
	_write_json(path, payload)

	return payload


def generate_and_save_quiz_json(topic_title: str, subtopic_title: str, n_questions: int = 5, force: bool = False) -> Path:
	data = generate_quiz(topic_title, subtopic_title, n_questions=n_questions, force=force)
	return _cache_path(data["topicId"], data["subtopicId"])


if __name__ == "__main__":
	import argparse

	p = argparse.ArgumentParser(description="Generate/cached 5-question MCQ quiz for a topic subtopic.")
	p.add_argument("--topic", required=True)
	p.add_argument("--subtopic", required=True)
	p.add_argument("--n", type=int, default=5)
	p.add_argument("--force", action="store_true")
	args = p.parse_args()

	out_path = generate_and_save_quiz_json(args.topic, args.subtopic, n_questions=args.n, force=args.force)
	print(str(out_path))
