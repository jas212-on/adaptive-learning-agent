"""
Timetable Generation Module for Adaptive Learning Agent

A deterministic, constraint-based study timetable generator.
No external AI models or probabilistic logic - fully explainable and debuggable.
"""

from .models import (
    FixedEvent,
    DailyAvailability,
    StudyPreferences,
    LearningTopic,
    StudyTask,
    TimeSlot,
    DaySchedule,
    TimetableOutput,
    TaskStatus,
    EventType,
)
from .scoring import UrgencyScorer
from .scheduler import TimetableScheduler
from .utils import DateTimeUtils

__all__ = [
    # Models
    "FixedEvent",
    "DailyAvailability",
    "StudyPreferences",
    "LearningTopic",
    "StudyTask",
    "TimeSlot",
    "DaySchedule",
    "TimetableOutput",
    "TaskStatus",
    "EventType",
    # Core classes
    "UrgencyScorer",
    "TimetableScheduler",
    "DateTimeUtils",
]


def generate_timetable(
    events: list[dict],
    availability: dict,
    preferences: dict,
    topics: list[dict],
    current_date: str | None = None,
) -> dict:
    """
    Main entry point for timetable generation.
    
    Args:
        events: List of fixed events (exams, assignments, deadlines)
        availability: Daily availability configuration
        preferences: Study preferences configuration
        topics: List of detected learning topics
        current_date: Optional start date (ISO format), defaults to today
        
    Returns:
        Generated timetable with date-indexed schedule
    """
    scheduler = TimetableScheduler(
        events=events,
        availability=availability,
        preferences=preferences,
        topics=topics,
        current_date=current_date,
    )
    return scheduler.generate()
