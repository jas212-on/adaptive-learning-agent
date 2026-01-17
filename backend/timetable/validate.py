"""Quick validation script for the timetable module."""

from datetime import date, time, timedelta
from timetable.models import (
    FixedEvent, DailyAvailability, StudyPreferences, LearningTopic,
    StudyTask, EventType, TaskStatus
)
from timetable.scoring import UrgencyScorer
from timetable.scheduler import TimetableScheduler
from timetable.utils import DateTimeUtils

def run_tests():
    print("=== Testing Models ===")

    # Test FixedEvent
    event = FixedEvent(
        id='exam_1',
        event_type=EventType.EXAM,
        subject='Math',
        topic='Calculus',
        target_date=date.today() + timedelta(days=7),
        priority_level=9,
        estimated_effort_hours=10.0,
    )
    print(f"FixedEvent: {event.subject} - {event.topic}")

    # Test DailyAvailability
    avail = DailyAvailability(weekday_hours=4.0, weekend_hours=6.0)
    print(f"Weekday hours: {avail.get_hours_for_date(date(2024, 1, 15))}")

    # Test StudyPreferences
    prefs = StudyPreferences(session_length_minutes=45)
    print(f"Session length: {prefs.session_length_minutes}")

    # Test LearningTopic
    topic = LearningTopic(
        id='t1', subject='Math', topic='Derivatives',
        difficulty_score=0.7, confidence_score=0.4
    )
    print(f"Topic: {topic.topic}, difficulty={topic.difficulty_score}")

    print("\n=== Testing Scoring ===")

    # Test UrgencyScorer
    scorer = UrgencyScorer()
    task = StudyTask(
        task_id='task_001',
        subject='Math',
        topic='Calculus',
        deadline=date.today() + timedelta(days=5),
        required_minutes=45,
        priority=8,
        difficulty_score=0.7,
        confidence_score=0.4,
    )
    score = scorer.calculate_score(task, date.today(), 30)
    print(f"Task urgency score: {score:.4f}")

    breakdown = scorer.calculate_score_with_breakdown(task, date.today(), 30)
    print(f"Breakdown: deadline={breakdown.deadline_component:.2f}, priority={breakdown.priority_component:.2f}")

    print("\n=== Testing Scheduler ===")

    scheduler = TimetableScheduler(
        events=[
            {
                'event_type': 'exam',
                'subject': 'Math',
                'target_date': (date.today() + timedelta(days=10)).isoformat(),
                'priority_level': 9,
                'estimated_effort_hours': 8
            },
            {
                'event_type': 'assignment',
                'subject': 'Physics',
                'target_date': (date.today() + timedelta(days=5)).isoformat(),
                'priority_level': 7,
                'estimated_effort_hours': 3
            },
        ],
        availability={'weekday_hours': 4, 'weekend_hours': 6},
        preferences={'session_length_minutes': 45, 'max_sessions_per_day': 6},
        topics=[
            {
                'subject': 'Math',
                'topic': 'Derivatives',
                'difficulty_score': 0.7,
                'confidence_score': 0.4,
                'is_concept_heavy': True
            },
            {
                'subject': 'Physics',
                'topic': 'Kinematics',
                'difficulty_score': 0.5,
                'confidence_score': 0.6
            },
        ],
    )

    result = scheduler.generate()
    print(f"Total tasks: {result['metadata']['total_tasks']}")
    print(f"Scheduled: {result['metadata']['scheduled_tasks']}")
    print(f"Days in schedule: {len(result['schedule'])}")
    print(f"Warnings: {len(result['warnings'])}")

    # Check schedule structure
    for date_str, day_data in list(result['schedule'].items())[:3]:
        slots = day_data.get('slots', [])
        print(f"  {date_str}: {len(slots)} slots")

    print("\n=== Testing Utils ===")
    dates = list(DateTimeUtils.date_range(date(2024, 1, 1), date(2024, 1, 3)))
    print(f"Date range (3 days): {len(dates)} dates")
    print(f"Days between: {DateTimeUtils.days_between(date(2024, 1, 1), date(2024, 1, 10))}")
    print(f"Add minutes: {DateTimeUtils.add_minutes_to_time(time(9, 30), 45)}")
    print(f"Format duration: {DateTimeUtils.format_duration(90)}")

    print("\n=== ALL TESTS PASSED ===")

if __name__ == "__main__":
    run_tests()
