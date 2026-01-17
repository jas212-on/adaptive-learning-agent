"""
Data Models for Timetable Generation

Pydantic-compatible structures for all timetable-related data.
All models are immutable-friendly and serializable.
"""

from dataclasses import dataclass, field
from datetime import date, time, datetime
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    """Types of fixed events that affect scheduling."""
    EXAM = "exam"
    ASSIGNMENT = "assignment"
    DEADLINE = "deadline"
    LECTURE = "lecture"
    LAB = "lab"


class TaskStatus(str, Enum):
    """Status of a study task."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    MISSED = "missed"
    RESCHEDULED = "rescheduled"


class TaskType(str, Enum):
    """Type of study task."""
    INITIAL_LEARNING = "initial_learning"
    REVISION = "revision"
    PRACTICE = "practice"
    EXAM_PREP = "exam_prep"


@dataclass(frozen=True)
class FixedEvent:
    """
    Represents a fixed event like an exam, assignment, or deadline.
    
    Attributes:
        id: Unique identifier for the event
        event_type: Type of the event (exam, assignment, deadline)
        subject: Subject/course the event belongs to
        topic: Specific topic if applicable
        target_date: Date when the event occurs
        priority_level: Priority from 1 (lowest) to 10 (highest)
        estimated_effort_hours: Estimated hours needed to prepare
        description: Optional description
    """
    id: str
    event_type: EventType
    subject: str
    topic: Optional[str]
    target_date: date
    priority_level: int  # 1-10
    estimated_effort_hours: float
    description: str = ""
    
    def __post_init__(self):
        """Validate constraints after initialization."""
        if not 1 <= self.priority_level <= 10:
            raise ValueError(f"priority_level must be 1-10, got {self.priority_level}")
        if self.estimated_effort_hours < 0:
            raise ValueError("estimated_effort_hours cannot be negative")


@dataclass(frozen=True)
class DailyAvailability:
    """
    Defines available study hours per day type.
    
    Attributes:
        weekday_hours: Available hours on weekdays (Mon-Fri)
        weekend_hours: Available hours on weekends (Sat-Sun)
        start_time: Earliest time to start studying
        end_time: Latest time to end studying
        excluded_dates: Specific dates with no availability
    """
    weekday_hours: float = 4.0
    weekend_hours: float = 6.0
    start_time: time = field(default_factory=lambda: time(9, 0))
    end_time: time = field(default_factory=lambda: time(21, 0))
    excluded_dates: tuple[date, ...] = field(default_factory=tuple)
    
    def get_hours_for_date(self, target_date: date) -> float:
        """Get available hours for a specific date."""
        if target_date in self.excluded_dates:
            return 0.0
        # Monday=0, Sunday=6
        if target_date.weekday() < 5:
            return self.weekday_hours
        return self.weekend_hours


@dataclass(frozen=True)
class StudyPreferences:
    """
    User preferences for study sessions.
    
    Attributes:
        session_length_minutes: Preferred length of each study session
        break_length_minutes: Break duration between sessions
        max_sessions_per_day: Maximum number of study sessions per day
        max_subjects_per_day: Maximum different subjects to study per day
        buffer_percentage: Reserve capacity percentage (10-20%)
        prefer_morning: Whether to prefer morning sessions
        min_session_gap_minutes: Minimum gap between sessions
    """
    session_length_minutes: int = 45
    break_length_minutes: int = 15
    max_sessions_per_day: int = 6
    max_subjects_per_day: int = 3
    buffer_percentage: float = 0.15  # 15% buffer
    prefer_morning: bool = True
    min_session_gap_minutes: int = 5
    
    def __post_init__(self):
        """Validate constraints."""
        if self.session_length_minutes < 15:
            raise ValueError("session_length_minutes must be at least 15")
        if self.break_length_minutes < 0:
            raise ValueError("break_length_minutes cannot be negative")
        if not 0.1 <= self.buffer_percentage <= 0.3:
            raise ValueError("buffer_percentage should be between 0.1 and 0.3")


@dataclass(frozen=True)
class LearningTopic:
    """
    Represents a detected learning topic from the adaptive learning system.
    
    Attributes:
        id: Unique identifier
        subject: Subject/course name
        topic: Specific topic name
        difficulty_score: How difficult the topic is (0-1)
        confidence_score: User's confidence/mastery level (0-1)
        prerequisites: List of prerequisite topic IDs
        estimated_hours: Base estimated hours to learn
        is_concept_heavy: Whether topic requires memorization/revision
    """
    id: str
    subject: str
    topic: str
    difficulty_score: float  # 0-1
    confidence_score: float  # 0-1
    prerequisites: tuple[str, ...] = field(default_factory=tuple)
    estimated_hours: float = 2.0
    is_concept_heavy: bool = False
    
    def __post_init__(self):
        """Validate score ranges."""
        if not 0 <= self.difficulty_score <= 1:
            raise ValueError("difficulty_score must be between 0 and 1")
        if not 0 <= self.confidence_score <= 1:
            raise ValueError("confidence_score must be between 0 and 1")


@dataclass
class StudyTask:
    """
    An atomic study task that fits into one study session.
    
    This is a mutable class as task status changes during scheduling.
    
    Attributes:
        task_id: Unique identifier
        subject: Subject/course name
        topic: Specific topic name
        deadline: Task deadline (must complete by this date)
        required_minutes: Duration in minutes
        priority: Computed priority (1-10)
        difficulty_score: Topic difficulty (0-1)
        confidence_score: User confidence (0-1)
        status: Current task status
        task_type: Type of study task
        parent_task_id: For revision tasks, links to original
        source_event_id: ID of the event this task prepares for
        source_topic_id: ID of the learning topic this task covers
        scheduled_date: Date when task is scheduled (if any)
        scheduled_slot: Slot index when scheduled
        revision_iteration: For revision tasks, which iteration (1, 2, 3...)
    """
    task_id: str
    subject: str
    topic: str
    deadline: date
    required_minutes: int
    priority: int
    difficulty_score: float
    confidence_score: float
    status: TaskStatus = TaskStatus.PENDING
    task_type: TaskType = TaskType.INITIAL_LEARNING
    parent_task_id: Optional[str] = None
    source_event_id: Optional[str] = None
    source_topic_id: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_slot: Optional[int] = None
    revision_iteration: int = 0
    
    def mark_scheduled(self, scheduled_date: date, slot: int) -> None:
        """Mark task as scheduled."""
        self.status = TaskStatus.SCHEDULED
        self.scheduled_date = scheduled_date
        self.scheduled_slot = slot
    
    def mark_completed(self) -> None:
        """Mark task as completed."""
        self.status = TaskStatus.COMPLETED
    
    def mark_missed(self) -> None:
        """Mark task as missed."""
        self.status = TaskStatus.MISSED
    
    def clone_for_reschedule(self, new_task_id: str) -> "StudyTask":
        """Create a copy for rescheduling."""
        return StudyTask(
            task_id=new_task_id,
            subject=self.subject,
            topic=self.topic,
            deadline=self.deadline,
            required_minutes=self.required_minutes,
            priority=min(10, self.priority + 1),  # Increase priority
            difficulty_score=self.difficulty_score,
            confidence_score=self.confidence_score,
            status=TaskStatus.PENDING,
            task_type=self.task_type,
            parent_task_id=self.task_id,
            source_event_id=self.source_event_id,
            source_topic_id=self.source_topic_id,
        )


@dataclass(frozen=True)
class TimeSlot:
    """
    A scheduled time slot in the timetable.
    
    Attributes:
        start_time: Slot start time
        end_time: Slot end time
        subject: Subject being studied
        topic: Topic being studied
        task_id: ID of the scheduled task
        task_type: Type of study task
        is_break: Whether this is a break slot
    """
    start_time: time
    end_time: time
    subject: str
    topic: str
    task_id: str
    task_type: TaskType = TaskType.INITIAL_LEARNING
    is_break: bool = False
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "subject": self.subject,
            "topic": self.topic,
            "task_id": self.task_id,
            "task_type": self.task_type.value,
            "is_break": self.is_break,
        }


@dataclass
class DaySchedule:
    """
    Schedule for a single day.
    
    Attributes:
        date: The date this schedule is for
        slots: Ordered list of time slots
        total_study_minutes: Total study time scheduled
        subjects_covered: Set of subjects covered this day
        capacity_used: Percentage of daily capacity used
    """
    date: date
    slots: list[TimeSlot] = field(default_factory=list)
    total_study_minutes: int = 0
    subjects_covered: set[str] = field(default_factory=set)
    capacity_used: float = 0.0
    
    def add_slot(self, slot: TimeSlot) -> None:
        """Add a time slot to the day."""
        self.slots.append(slot)
        if not slot.is_break:
            # Calculate minutes from time objects
            start_minutes = slot.start_time.hour * 60 + slot.start_time.minute
            end_minutes = slot.end_time.hour * 60 + slot.end_time.minute
            self.total_study_minutes += end_minutes - start_minutes
            self.subjects_covered.add(slot.subject)
    
    def get_session_count(self) -> int:
        """Get number of study sessions (excluding breaks)."""
        return len([s for s in self.slots if not s.is_break])
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "date": self.date.isoformat(),
            "slots": [slot.to_dict() for slot in self.slots],
            "total_study_minutes": self.total_study_minutes,
            "subjects_covered": list(self.subjects_covered),
            "capacity_used": round(self.capacity_used, 2),
            "session_count": self.get_session_count(),
        }


@dataclass
class CapacityWarning:
    """
    Warning about capacity issues during scheduling.
    
    Attributes:
        date: Date with capacity issue
        message: Description of the issue
        affected_tasks: List of task IDs affected
        severity: Warning severity (info, warning, critical)
    """
    date: date
    message: str
    affected_tasks: list[str]
    severity: str = "warning"
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "date": self.date.isoformat(),
            "message": self.message,
            "affected_tasks": self.affected_tasks,
            "severity": self.severity,
        }


@dataclass
class TimetableOutput:
    """
    Complete timetable output.
    
    Attributes:
        schedule: Dictionary mapping date strings to DaySchedule
        tasks: All tasks (scheduled and unscheduled)
        warnings: Any warnings generated during scheduling
        metadata: Additional metadata about the generation
    """
    schedule: dict[str, DaySchedule]
    tasks: list[StudyTask]
    warnings: list[CapacityWarning]
    metadata: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "schedule": {
                date_str: day.to_dict() 
                for date_str, day in self.schedule.items()
            },
            "tasks": [
                {
                    "task_id": t.task_id,
                    "subject": t.subject,
                    "topic": t.topic,
                    "deadline": t.deadline.isoformat(),
                    "required_minutes": t.required_minutes,
                    "priority": t.priority,
                    "difficulty_score": t.difficulty_score,
                    "confidence_score": t.confidence_score,
                    "status": t.status.value,
                    "task_type": t.task_type.value,
                    "parent_task_id": t.parent_task_id,
                    "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
                }
                for t in self.tasks
            ],
            "warnings": [w.to_dict() for w in self.warnings],
            "metadata": self.metadata,
        }
    
    def get_schedule_for_date(self, target_date: date) -> Optional[DaySchedule]:
        """Get schedule for a specific date."""
        return self.schedule.get(target_date.isoformat())
    
    def get_unscheduled_tasks(self) -> list[StudyTask]:
        """Get all tasks that couldn't be scheduled."""
        return [t for t in self.tasks if t.status == TaskStatus.PENDING]
    
    def get_scheduled_tasks(self) -> list[StudyTask]:
        """Get all scheduled tasks."""
        return [t for t in self.tasks if t.status == TaskStatus.SCHEDULED]
