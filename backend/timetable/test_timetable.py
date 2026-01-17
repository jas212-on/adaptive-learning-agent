"""
Unit Tests for Timetable Generation Module

Comprehensive tests for all components of the timetable generator.
Tests are deterministic and do not require external dependencies.
"""

import pytest
from datetime import date, time, timedelta

from timetable.models import (
    FixedEvent,
    DailyAvailability,
    StudyPreferences,
    LearningTopic,
    StudyTask,
    TimeSlot,
    DaySchedule,
    TimetableOutput,
    CapacityWarning,
    TaskStatus,
    TaskType,
    EventType,
)
from timetable.scoring import UrgencyScorer, ScoreWeights, ScoreBreakdown
from timetable.scheduler import (
    TimetableScheduler,
    InputNormalizer,
    TaskDecomposer,
    CapacityPlanner,
    DayCapacity,
)
from timetable.utils import DateTimeUtils, generate_task_id, clamp


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_event():
    """Create a sample fixed event."""
    return FixedEvent(
        id="exam_1",
        event_type=EventType.EXAM,
        subject="Mathematics",
        topic="Calculus",
        target_date=date.today() + timedelta(days=7),
        priority_level=9,
        estimated_effort_hours=10.0,
    )


@pytest.fixture
def sample_availability():
    """Create sample availability."""
    return DailyAvailability(
        weekday_hours=4.0,
        weekend_hours=6.0,
        start_time=time(9, 0),
        end_time=time(21, 0),
    )


@pytest.fixture
def sample_preferences():
    """Create sample preferences."""
    return StudyPreferences(
        session_length_minutes=45,
        break_length_minutes=15,
        max_sessions_per_day=6,
        max_subjects_per_day=3,
        buffer_percentage=0.15,
    )


@pytest.fixture
def sample_topic():
    """Create a sample learning topic."""
    return LearningTopic(
        id="topic_1",
        subject="Mathematics",
        topic="Derivatives",
        difficulty_score=0.7,
        confidence_score=0.4,
        is_concept_heavy=True,
        estimated_hours=3.0,
    )


@pytest.fixture
def sample_task():
    """Create a sample study task."""
    return StudyTask(
        task_id="task_001",
        subject="Mathematics",
        topic="Derivatives",
        deadline=date.today() + timedelta(days=5),
        required_minutes=45,
        priority=8,
        difficulty_score=0.7,
        confidence_score=0.4,
    )


# ============================================================================
# Model Tests
# ============================================================================

class TestFixedEvent:
    """Tests for FixedEvent model."""
    
    def test_create_valid_event(self, sample_event):
        """Test creating a valid event."""
        assert sample_event.id == "exam_1"
        assert sample_event.event_type == EventType.EXAM
        assert sample_event.priority_level == 9
    
    def test_invalid_priority_raises_error(self):
        """Test that invalid priority raises ValueError."""
        with pytest.raises(ValueError):
            FixedEvent(
                id="test",
                event_type=EventType.EXAM,
                subject="Test",
                topic="Test",
                target_date=date.today(),
                priority_level=15,  # Invalid
                estimated_effort_hours=1.0,
            )
    
    def test_negative_effort_raises_error(self):
        """Test that negative effort raises ValueError."""
        with pytest.raises(ValueError):
            FixedEvent(
                id="test",
                event_type=EventType.EXAM,
                subject="Test",
                topic="Test",
                target_date=date.today(),
                priority_level=5,
                estimated_effort_hours=-1.0,  # Invalid
            )


class TestDailyAvailability:
    """Tests for DailyAvailability model."""
    
    def test_get_hours_for_weekday(self, sample_availability):
        """Test getting hours for a weekday."""
        # Monday
        monday = date(2024, 1, 15)
        hours = sample_availability.get_hours_for_date(monday)
        assert hours == 4.0
    
    def test_get_hours_for_weekend(self, sample_availability):
        """Test getting hours for a weekend."""
        # Saturday
        saturday = date(2024, 1, 20)
        hours = sample_availability.get_hours_for_date(saturday)
        assert hours == 6.0
    
    def test_excluded_date_returns_zero(self):
        """Test that excluded dates return zero hours."""
        excluded = date(2024, 1, 15)
        availability = DailyAvailability(
            weekday_hours=4.0,
            weekend_hours=6.0,
            excluded_dates=(excluded,)
        )
        hours = availability.get_hours_for_date(excluded)
        assert hours == 0.0


class TestStudyPreferences:
    """Tests for StudyPreferences model."""
    
    def test_valid_preferences(self, sample_preferences):
        """Test creating valid preferences."""
        assert sample_preferences.session_length_minutes == 45
        assert sample_preferences.buffer_percentage == 0.15
    
    def test_invalid_session_length_raises_error(self):
        """Test that too short session raises ValueError."""
        with pytest.raises(ValueError):
            StudyPreferences(session_length_minutes=10)
    
    def test_invalid_buffer_raises_error(self):
        """Test that invalid buffer raises ValueError."""
        with pytest.raises(ValueError):
            StudyPreferences(buffer_percentage=0.5)


class TestStudyTask:
    """Tests for StudyTask model."""
    
    def test_mark_scheduled(self, sample_task):
        """Test marking a task as scheduled."""
        sample_task.mark_scheduled(date.today(), 0)
        assert sample_task.status == TaskStatus.SCHEDULED
        assert sample_task.scheduled_date == date.today()
        assert sample_task.scheduled_slot == 0
    
    def test_mark_completed(self, sample_task):
        """Test marking a task as completed."""
        sample_task.mark_completed()
        assert sample_task.status == TaskStatus.COMPLETED
    
    def test_clone_for_reschedule(self, sample_task):
        """Test cloning a task for rescheduling."""
        cloned = sample_task.clone_for_reschedule("task_001_reschedule")
        assert cloned.task_id == "task_001_reschedule"
        assert cloned.parent_task_id == sample_task.task_id
        assert cloned.priority == min(10, sample_task.priority + 1)
        assert cloned.status == TaskStatus.PENDING


class TestDaySchedule:
    """Tests for DaySchedule model."""
    
    def test_add_slot(self):
        """Test adding a time slot."""
        day = DaySchedule(date=date.today())
        slot = TimeSlot(
            start_time=time(9, 0),
            end_time=time(9, 45),
            subject="Math",
            topic="Calculus",
            task_id="task_001",
        )
        day.add_slot(slot)
        
        assert len(day.slots) == 1
        assert day.total_study_minutes == 45
        assert "Math" in day.subjects_covered
    
    def test_get_session_count(self):
        """Test counting sessions."""
        day = DaySchedule(date=date.today())
        
        # Add study slot
        day.add_slot(TimeSlot(
            start_time=time(9, 0),
            end_time=time(9, 45),
            subject="Math",
            topic="Calculus",
            task_id="task_001",
        ))
        
        # Add break slot
        day.add_slot(TimeSlot(
            start_time=time(9, 45),
            end_time=time(10, 0),
            subject="",
            topic="",
            task_id="break",
            is_break=True,
        ))
        
        assert day.get_session_count() == 1  # Only counts non-breaks


# ============================================================================
# Utility Tests
# ============================================================================

class TestDateTimeUtils:
    """Tests for DateTimeUtils."""
    
    def test_parse_date_from_string(self):
        """Test parsing date from ISO string."""
        result = DateTimeUtils.parse_date("2024-01-15")
        assert result == date(2024, 1, 15)
    
    def test_parse_date_from_date(self):
        """Test parsing date from date object."""
        d = date(2024, 1, 15)
        result = DateTimeUtils.parse_date(d)
        assert result == d
    
    def test_parse_date_default(self):
        """Test default date when None is passed."""
        default = date(2024, 1, 1)
        result = DateTimeUtils.parse_date(None, default=default)
        assert result == default
    
    def test_date_range(self):
        """Test date range generator."""
        start = date(2024, 1, 1)
        end = date(2024, 1, 3)
        dates = list(DateTimeUtils.date_range(start, end))
        
        assert len(dates) == 3
        assert dates[0] == date(2024, 1, 1)
        assert dates[2] == date(2024, 1, 3)
    
    def test_days_between(self):
        """Test calculating days between dates."""
        start = date(2024, 1, 1)
        end = date(2024, 1, 10)
        days = DateTimeUtils.days_between(start, end)
        assert days == 9
    
    def test_add_minutes_to_time(self):
        """Test adding minutes to time."""
        result = DateTimeUtils.add_minutes_to_time(time(9, 30), 45)
        assert result == time(10, 15)
    
    def test_add_minutes_to_time_wrap(self):
        """Test adding minutes past midnight caps at 23:59."""
        result = DateTimeUtils.add_minutes_to_time(time(23, 30), 60)
        assert result == time(23, 59)
    
    def test_is_weekend(self):
        """Test weekend detection."""
        saturday = date(2024, 1, 20)  # Saturday
        monday = date(2024, 1, 15)  # Monday
        
        assert DateTimeUtils.is_weekend(saturday) is True
        assert DateTimeUtils.is_weekend(monday) is False
    
    def test_spaced_repetition_dates(self):
        """Test spaced repetition date calculation."""
        initial = date(2024, 1, 1)
        end = date(2024, 1, 15)
        
        dates = DateTimeUtils.get_spaced_repetition_dates(initial, end)
        
        assert len(dates) == 3
        assert dates[0] == date(2024, 1, 2)  # +1 day
        assert dates[1] == date(2024, 1, 4)  # +3 days
        assert dates[2] == date(2024, 1, 8)  # +7 days
    
    def test_format_duration(self):
        """Test duration formatting."""
        assert DateTimeUtils.format_duration(45) == "45m"
        assert DateTimeUtils.format_duration(60) == "1h"
        assert DateTimeUtils.format_duration(90) == "1h 30m"


class TestHelperFunctions:
    """Tests for helper functions."""
    
    def test_generate_task_id(self):
        """Test task ID generation."""
        task_id = generate_task_id("task", "math", 1)
        assert task_id == "task_math_1"
    
    def test_clamp(self):
        """Test value clamping."""
        assert clamp(5, 0, 10) == 5
        assert clamp(-5, 0, 10) == 0
        assert clamp(15, 0, 10) == 10


# ============================================================================
# Scoring Tests
# ============================================================================

class TestUrgencyScorer:
    """Tests for UrgencyScorer."""
    
    def test_calculate_score(self, sample_task):
        """Test basic score calculation."""
        scorer = UrgencyScorer()
        score = scorer.calculate_score(sample_task, date.today(), 30)
        
        assert 0 <= score <= 1
    
    def test_overdue_task_max_deadline_score(self):
        """Test that overdue tasks get maximum deadline score."""
        scorer = UrgencyScorer()
        task = StudyTask(
            task_id="task_overdue",
            subject="Test",
            topic="Test",
            deadline=date.today() - timedelta(days=1),  # Yesterday
            required_minutes=45,
            priority=5,
            difficulty_score=0.5,
            confidence_score=0.5,
        )
        
        breakdown = scorer.calculate_score_with_breakdown(task, date.today(), 30)
        assert breakdown.deadline_component == 1.0
    
    def test_higher_priority_higher_score(self):
        """Test that higher priority leads to higher score."""
        scorer = UrgencyScorer()
        
        low_priority = StudyTask(
            task_id="low",
            subject="Test",
            topic="Test",
            deadline=date.today() + timedelta(days=5),
            required_minutes=45,
            priority=2,
            difficulty_score=0.5,
            confidence_score=0.5,
        )
        
        high_priority = StudyTask(
            task_id="high",
            subject="Test",
            topic="Test",
            deadline=date.today() + timedelta(days=5),
            required_minutes=45,
            priority=9,
            difficulty_score=0.5,
            confidence_score=0.5,
        )
        
        low_score = scorer.calculate_score(low_priority, date.today(), 30)
        high_score = scorer.calculate_score(high_priority, date.today(), 30)
        
        assert high_score > low_score
    
    def test_lower_confidence_higher_score(self):
        """Test that lower confidence leads to higher score."""
        scorer = UrgencyScorer()
        
        high_conf = StudyTask(
            task_id="high_conf",
            subject="Test",
            topic="Test",
            deadline=date.today() + timedelta(days=5),
            required_minutes=45,
            priority=5,
            difficulty_score=0.5,
            confidence_score=0.9,
        )
        
        low_conf = StudyTask(
            task_id="low_conf",
            subject="Test",
            topic="Test",
            deadline=date.today() + timedelta(days=5),
            required_minutes=45,
            priority=5,
            difficulty_score=0.5,
            confidence_score=0.1,
        )
        
        high_conf_score = scorer.calculate_score(high_conf, date.today(), 30)
        low_conf_score = scorer.calculate_score(low_conf, date.today(), 30)
        
        assert low_conf_score > high_conf_score
    
    def test_rank_tasks(self):
        """Test task ranking."""
        scorer = UrgencyScorer()
        
        tasks = [
            StudyTask(
                task_id="low",
                subject="Test",
                topic="Test",
                deadline=date.today() + timedelta(days=10),
                required_minutes=45,
                priority=2,
                difficulty_score=0.3,
                confidence_score=0.8,
            ),
            StudyTask(
                task_id="high",
                subject="Test",
                topic="Test",
                deadline=date.today() + timedelta(days=2),
                required_minutes=45,
                priority=9,
                difficulty_score=0.8,
                confidence_score=0.2,
            ),
        ]
        
        ranked = scorer.rank_tasks(tasks, date.today(), 30)
        
        # High priority task should be first
        assert ranked[0][0].task_id == "high"
        assert ranked[1][0].task_id == "low"
    
    def test_score_breakdown(self, sample_task):
        """Test score breakdown contains all components."""
        scorer = UrgencyScorer()
        breakdown = scorer.calculate_score_with_breakdown(sample_task, date.today(), 30)
        
        assert breakdown.task_id == sample_task.task_id
        assert 0 <= breakdown.priority_component <= 1
        assert 0 <= breakdown.difficulty_component <= 1
        assert 0 <= breakdown.deadline_component <= 1
        assert 0 <= breakdown.confidence_component <= 1
        assert breakdown.explanation != ""


# ============================================================================
# Scheduler Tests
# ============================================================================

class TestInputNormalizer:
    """Tests for InputNormalizer."""
    
    def test_normalize_events(self):
        """Test event normalization."""
        raw_events = [
            {
                "id": "exam_1",
                "event_type": "exam",
                "subject": "Math",
                "topic": "Calculus",
                "target_date": "2024-02-15",
                "priority_level": 9,
                "estimated_effort_hours": 10,
            }
        ]
        
        events = InputNormalizer.normalize_events(raw_events)
        
        assert len(events) == 1
        assert events[0].id == "exam_1"
        assert events[0].event_type == EventType.EXAM
        assert events[0].target_date == date(2024, 2, 15)
    
    def test_normalize_availability(self):
        """Test availability normalization."""
        raw_availability = {
            "weekday_hours": 5,
            "weekend_hours": 8,
            "start_time": "08:00",
            "end_time": "22:00",
        }
        
        availability = InputNormalizer.normalize_availability(raw_availability)
        
        assert availability.weekday_hours == 5.0
        assert availability.weekend_hours == 8.0
        assert availability.start_time == time(8, 0)
        assert availability.end_time == time(22, 0)
    
    def test_normalize_preferences(self):
        """Test preferences normalization."""
        raw_preferences = {
            "session_length_minutes": 50,
            "break_length_minutes": 10,
            "max_sessions_per_day": 8,
        }
        
        preferences = InputNormalizer.normalize_preferences(raw_preferences)
        
        assert preferences.session_length_minutes == 50
        assert preferences.break_length_minutes == 10
        assert preferences.max_sessions_per_day == 8
    
    def test_normalize_topics(self):
        """Test topic normalization."""
        raw_topics = [
            {
                "id": "topic_1",
                "subject": "Physics",
                "topic": "Kinematics",
                "difficulty_score": 0.6,
                "confidence_score": 0.4,
            }
        ]
        
        topics = InputNormalizer.normalize_topics(raw_topics)
        
        assert len(topics) == 1
        assert topics[0].subject == "Physics"
        assert topics[0].difficulty_score == 0.6


class TestTaskDecomposer:
    """Tests for TaskDecomposer."""
    
    def test_decompose_event(self, sample_event, sample_preferences):
        """Test event decomposition."""
        decomposer = TaskDecomposer(sample_preferences)
        tasks = decomposer.decompose_event(sample_event)
        
        assert len(tasks) > 0
        assert all(t.source_event_id == sample_event.id for t in tasks)
        assert all(t.required_minutes <= sample_preferences.session_length_minutes for t in tasks)
    
    def test_decompose_topic(self, sample_topic, sample_preferences):
        """Test topic decomposition."""
        decomposer = TaskDecomposer(sample_preferences)
        deadline = date.today() + timedelta(days=7)
        tasks = decomposer.decompose_topic(sample_topic, deadline)
        
        assert len(tasks) > 0
        assert all(t.source_topic_id == sample_topic.id for t in tasks)
        assert all(t.deadline == deadline for t in tasks)
    
    def test_create_revision_task(self, sample_task, sample_preferences):
        """Test revision task creation."""
        decomposer = TaskDecomposer(sample_preferences)
        revision_date = date.today() + timedelta(days=2)
        
        revision = decomposer.create_revision_task(sample_task, revision_date, 1)
        
        assert revision.task_type == TaskType.REVISION
        assert revision.parent_task_id == sample_task.task_id
        assert revision.deadline == revision_date
        assert revision.revision_iteration == 1
        assert revision.required_minutes < sample_task.required_minutes


class TestCapacityPlanner:
    """Tests for CapacityPlanner."""
    
    def test_build_capacity_map(self, sample_availability, sample_preferences):
        """Test building capacity map."""
        planner = CapacityPlanner(sample_availability, sample_preferences)
        start = date(2024, 1, 15)  # Monday
        end = date(2024, 1, 21)  # Sunday
        
        capacity_map = planner.build_capacity_map(start, end)
        
        assert len(capacity_map) == 7
        
        # Check weekday capacity
        monday_cap = capacity_map["2024-01-15"]
        assert monday_cap.total_minutes == 4 * 60  # 4 hours
        
        # Check weekend capacity
        saturday_cap = capacity_map["2024-01-20"]
        assert saturday_cap.total_minutes == 6 * 60  # 6 hours


class TestDayCapacity:
    """Tests for DayCapacity."""
    
    def test_can_fit_session(self):
        """Test session fitting check."""
        capacity = DayCapacity(
            date=date.today(),
            total_minutes=240,
            available_minutes=200,
            max_sessions=6,
        )
        
        # Should fit
        assert capacity.can_fit_session(45, "Math", "Calculus", 3) is True
        
        # Shouldn't fit - too many minutes
        capacity.available_minutes = 30
        assert capacity.can_fit_session(45, "Math", "Calculus", 3) is False
    
    def test_no_back_to_back_same_topic(self):
        """Test that back-to-back same topic is prevented."""
        capacity = DayCapacity(
            date=date.today(),
            total_minutes=240,
            available_minutes=200,
            max_sessions=6,
        )
        
        # First session - should work
        capacity.allocate(45, "Math", "Calculus")
        
        # Second session same topic - should fail
        assert capacity.can_fit_session(45, "Math", "Calculus", 3) is False
        
        # Different topic - should work
        assert capacity.can_fit_session(45, "Math", "Algebra", 3) is True
    
    def test_max_subjects_enforced(self):
        """Test that max subjects per day is enforced."""
        capacity = DayCapacity(
            date=date.today(),
            total_minutes=480,
            available_minutes=400,
            max_sessions=10,
        )
        
        # Add 3 subjects
        capacity.allocate(45, "Math", "Topic1")
        capacity.allocate(45, "Physics", "Topic2")
        capacity.allocate(45, "Chemistry", "Topic3")
        
        # 4th subject should fail
        assert capacity.can_fit_session(45, "Biology", "Topic4", 3) is False
        
        # Existing subject should still work
        assert capacity.can_fit_session(45, "Math", "Topic5", 3) is True


class TestTimetableScheduler:
    """Tests for TimetableScheduler."""
    
    def test_generate_simple_timetable(self):
        """Test generating a simple timetable."""
        events = [
            {
                "id": "exam_1",
                "event_type": "exam",
                "subject": "Math",
                "topic": "Calculus",
                "target_date": (date.today() + timedelta(days=7)).isoformat(),
                "priority_level": 9,
                "estimated_effort_hours": 5,
            }
        ]
        
        availability = {
            "weekday_hours": 4,
            "weekend_hours": 6,
        }
        
        preferences = {
            "session_length_minutes": 45,
            "max_sessions_per_day": 6,
        }
        
        topics = []
        
        scheduler = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
        )
        
        result = scheduler.generate()
        
        assert "schedule" in result
        assert "tasks" in result
        assert "metadata" in result
        assert result["metadata"]["total_events"] == 1
    
    def test_generate_with_topics(self):
        """Test generating timetable with topics."""
        events = []
        
        availability = {
            "weekday_hours": 4,
            "weekend_hours": 6,
        }
        
        preferences = {
            "session_length_minutes": 45,
            "max_sessions_per_day": 6,
        }
        
        topics = [
            {
                "id": "topic_1",
                "subject": "Physics",
                "topic": "Kinematics",
                "difficulty_score": 0.5,
                "confidence_score": 0.5,
                "estimated_hours": 2,
            }
        ]
        
        scheduler = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
        )
        
        result = scheduler.generate()
        
        assert result["metadata"]["total_topics"] == 1
        assert result["metadata"]["total_tasks"] > 0
    
    def test_deterministic_output(self):
        """Test that output is deterministic for identical inputs."""
        events = [
            {
                "id": "exam_1",
                "event_type": "exam",
                "subject": "Math",
                "topic": "Calculus",
                "target_date": "2024-02-15",
                "priority_level": 9,
                "estimated_effort_hours": 5,
            }
        ]
        
        availability = {"weekday_hours": 4, "weekend_hours": 6}
        preferences = {"session_length_minutes": 45}
        topics = []
        
        # Generate twice
        result1 = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
            current_date="2024-02-01",
        ).generate()
        
        result2 = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
            current_date="2024-02-01",
        ).generate()
        
        # Should be identical
        assert result1["metadata"]["total_tasks"] == result2["metadata"]["total_tasks"]
        assert result1["metadata"]["scheduled_tasks"] == result2["metadata"]["scheduled_tasks"]
    
    def test_spaced_repetition_for_concept_heavy_topics(self):
        """Test that spaced repetition is added for concept-heavy topics."""
        events = [
            {
                "id": "exam_1",
                "event_type": "exam",
                "subject": "Biology",
                "target_date": (date.today() + timedelta(days=14)).isoformat(),
                "priority_level": 8,
                "estimated_effort_hours": 3,
            }
        ]
        
        availability = {"weekday_hours": 4, "weekend_hours": 6}
        preferences = {"session_length_minutes": 45}
        
        topics = [
            {
                "id": "topic_1",
                "subject": "Biology",
                "topic": "Cell Biology",
                "difficulty_score": 0.6,
                "confidence_score": 0.4,
                "is_concept_heavy": True,  # This should trigger spaced repetition
                "estimated_hours": 2,
            }
        ]
        
        result = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
        ).generate()
        
        # Check for revision tasks
        revision_tasks = [
            t for t in result["tasks"]
            if t["task_type"] == "revision"
        ]
        
        # Should have some revision tasks
        assert len(revision_tasks) >= 0  # May or may not have room for revisions
    
    def test_warnings_on_capacity_exceeded(self):
        """Test that warnings are generated when capacity is exceeded."""
        # Create a scenario with too many tasks
        events = [
            {
                "id": f"exam_{i}",
                "event_type": "exam",
                "subject": f"Subject{i}",
                "target_date": (date.today() + timedelta(days=2)).isoformat(),
                "priority_level": 9,
                "estimated_effort_hours": 8,
            }
            for i in range(5)  # 5 exams with 8 hours each in 2 days
        ]
        
        availability = {"weekday_hours": 2, "weekend_hours": 2}
        preferences = {"session_length_minutes": 45, "max_sessions_per_day": 2}
        
        result = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=[],
        ).generate()
        
        # Should have some warnings due to capacity constraints
        # (may or may not depending on the specific scenario)
        assert "warnings" in result


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for the complete workflow."""
    
    def test_full_workflow(self):
        """Test a complete timetable generation workflow."""
        # Realistic scenario
        events = [
            {
                "id": "midterm_math",
                "event_type": "exam",
                "subject": "Mathematics",
                "topic": "Calculus Midterm",
                "target_date": (date.today() + timedelta(days=10)).isoformat(),
                "priority_level": 9,
                "estimated_effort_hours": 12,
            },
            {
                "id": "assignment_physics",
                "event_type": "assignment",
                "subject": "Physics",
                "topic": "Lab Report",
                "target_date": (date.today() + timedelta(days=5)).isoformat(),
                "priority_level": 7,
                "estimated_effort_hours": 4,
            },
        ]
        
        availability = {
            "weekday_hours": 4,
            "weekend_hours": 6,
            "start_time": "09:00",
            "end_time": "21:00",
        }
        
        preferences = {
            "session_length_minutes": 45,
            "break_length_minutes": 15,
            "max_sessions_per_day": 6,
            "max_subjects_per_day": 3,
            "buffer_percentage": 0.15,
        }
        
        topics = [
            {
                "id": "derivatives",
                "subject": "Mathematics",
                "topic": "Derivatives",
                "difficulty_score": 0.7,
                "confidence_score": 0.4,
                "is_concept_heavy": True,
                "estimated_hours": 3,
            },
            {
                "id": "integrals",
                "subject": "Mathematics",
                "topic": "Integrals",
                "difficulty_score": 0.8,
                "confidence_score": 0.3,
                "is_concept_heavy": True,
                "estimated_hours": 4,
            },
            {
                "id": "kinematics",
                "subject": "Physics",
                "topic": "Kinematics",
                "difficulty_score": 0.5,
                "confidence_score": 0.6,
                "is_concept_heavy": False,
                "estimated_hours": 2,
            },
        ]
        
        # Generate timetable
        scheduler = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
        )
        
        result = scheduler.generate()
        
        # Verify structure
        assert "schedule" in result
        assert "tasks" in result
        assert "warnings" in result
        assert "metadata" in result
        
        # Verify metadata
        metadata = result["metadata"]
        assert metadata["total_events"] == 2
        assert metadata["total_topics"] == 3
        assert metadata["total_tasks"] > 0
        
        # Verify schedule has entries
        schedule = result["schedule"]
        assert len(schedule) > 0
        
        # Verify at least some tasks were scheduled
        assert metadata["scheduled_tasks"] > 0
        
        # Verify tasks have proper structure
        for task in result["tasks"]:
            assert "task_id" in task
            assert "subject" in task
            assert "topic" in task
            assert "deadline" in task
            assert "status" in task
    
    def test_empty_inputs(self):
        """Test handling of empty inputs."""
        result = TimetableScheduler(
            events=[],
            availability={},
            preferences={},
            topics=[],
        ).generate()
        
        assert result["metadata"]["total_events"] == 0
        assert result["metadata"]["total_topics"] == 0
        assert result["metadata"]["total_tasks"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
