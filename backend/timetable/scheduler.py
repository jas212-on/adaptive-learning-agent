"""
Core Scheduling Logic for Timetable Generation

Deterministic, constraint-based scheduling algorithm.
Implements greedy allocation with conflict resolution.
"""

from datetime import date, time
from dataclasses import dataclass, field
from typing import Optional
import uuid

from .models import (
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
from .scoring import UrgencyScorer, ScoreBreakdown
from .utils import DateTimeUtils, generate_task_id, clamp


@dataclass
class DayCapacity:
    """
    Tracks available capacity for a single day.
    
    Used for planning and allocation decisions.
    """
    date: date
    total_minutes: int
    available_minutes: int
    max_sessions: int
    sessions_used: int = 0
    subjects_used: set[str] = field(default_factory=set)
    last_topic: Optional[str] = None
    next_available_time: time = field(default_factory=lambda: time(9, 0))
    
    def can_fit_session(self, minutes: int, subject: str, topic: str, max_subjects: int) -> bool:
        """Check if a session can fit in this day's remaining capacity."""
        # Check minutes
        if self.available_minutes < minutes:
            return False
        
        # Check sessions
        if self.sessions_used >= self.max_sessions:
            return False
        
        # Check subjects (allow if already used or under limit)
        if subject not in self.subjects_used and len(self.subjects_used) >= max_subjects:
            return False
        
        # Avoid back-to-back same topic
        if self.last_topic == topic and self.sessions_used > 0:
            return False
        
        return True
    
    def allocate(self, minutes: int, subject: str, topic: str) -> None:
        """Allocate capacity for a session."""
        self.available_minutes -= minutes
        self.sessions_used += 1
        self.subjects_used.add(subject)
        self.last_topic = topic


class InputNormalizer:
    """
    Normalizes raw input data into internal model objects.
    
    Handles various input formats and validates constraints.
    """
    
    @staticmethod
    def normalize_events(events_data: list[dict]) -> list[FixedEvent]:
        """
        Normalize raw event data into FixedEvent objects.
        
        Args:
            events_data: List of event dictionaries
            
        Returns:
            List of validated FixedEvent objects
        """
        events = []
        for data in events_data:
            # Parse event type
            event_type_str = data.get("event_type", data.get("type", "deadline"))
            try:
                event_type = EventType(event_type_str.lower())
            except ValueError:
                event_type = EventType.DEADLINE
            
            # Parse date
            target_date = DateTimeUtils.parse_date(
                data.get("target_date", data.get("date", data.get("deadline")))
            )
            
            event = FixedEvent(
                id=data.get("id", str(uuid.uuid4())),
                event_type=event_type,
                subject=data.get("subject", "Unknown"),
                topic=data.get("topic"),
                target_date=target_date,
                priority_level=int(clamp(data.get("priority_level", data.get("priority", 5)), 1, 10)),
                estimated_effort_hours=float(data.get("estimated_effort_hours", data.get("effort_hours", 2.0))),
                description=data.get("description", ""),
            )
            events.append(event)
        
        return events
    
    @staticmethod
    def normalize_availability(availability_data: dict) -> DailyAvailability:
        """
        Normalize availability configuration.
        
        Args:
            availability_data: Availability configuration dictionary
            
        Returns:
            DailyAvailability object
        """
        excluded_dates = []
        for d in availability_data.get("excluded_dates", []):
            try:
                excluded_dates.append(DateTimeUtils.parse_date(d))
            except ValueError:
                continue
        
        return DailyAvailability(
            weekday_hours=float(availability_data.get("weekday_hours", 4.0)),
            weekend_hours=float(availability_data.get("weekend_hours", 6.0)),
            start_time=DateTimeUtils.parse_time(
                availability_data.get("start_time"), 
                default=time(9, 0)
            ),
            end_time=DateTimeUtils.parse_time(
                availability_data.get("end_time"),
                default=time(21, 0)
            ),
            excluded_dates=tuple(excluded_dates),
        )
    
    @staticmethod
    def normalize_preferences(preferences_data: dict) -> StudyPreferences:
        """
        Normalize study preferences.
        
        Args:
            preferences_data: Preferences configuration dictionary
            
        Returns:
            StudyPreferences object
        """
        return StudyPreferences(
            session_length_minutes=int(preferences_data.get("session_length_minutes", 45)),
            break_length_minutes=int(preferences_data.get("break_length_minutes", 15)),
            max_sessions_per_day=int(preferences_data.get("max_sessions_per_day", 6)),
            max_subjects_per_day=int(preferences_data.get("max_subjects_per_day", 3)),
            buffer_percentage=float(clamp(
                preferences_data.get("buffer_percentage", 0.15),
                0.1, 0.3
            )),
            prefer_morning=bool(preferences_data.get("prefer_morning", True)),
            min_session_gap_minutes=int(preferences_data.get("min_session_gap_minutes", 5)),
        )
    
    @staticmethod
    def normalize_topics(topics_data: list[dict]) -> list[LearningTopic]:
        """
        Normalize learning topics.
        
        Args:
            topics_data: List of topic dictionaries
            
        Returns:
            List of LearningTopic objects
        """
        topics = []
        for i, data in enumerate(topics_data):
            topic = LearningTopic(
                id=data.get("id", f"topic_{i}"),
                subject=data.get("subject", "Unknown"),
                topic=data.get("topic", data.get("name", f"Topic {i}")),
                difficulty_score=float(clamp(data.get("difficulty_score", data.get("difficulty", 0.5)), 0.0, 1.0)),
                confidence_score=float(clamp(data.get("confidence_score", data.get("confidence", 0.5)), 0.0, 1.0)),
                prerequisites=tuple(data.get("prerequisites", [])),
                estimated_hours=float(data.get("estimated_hours", 2.0)),
                is_concept_heavy=bool(data.get("is_concept_heavy", False)),
            )
            topics.append(topic)
        
        return topics


class TaskDecomposer:
    """
    Decomposes events and topics into atomic study tasks.
    
    Rules:
    - Each task fits into one study session
    - High difficulty or low confidence → smaller, repeated tasks
    - Tasks are independently schedulable
    """
    
    def __init__(self, preferences: StudyPreferences):
        """
        Initialize the decomposer.
        
        Args:
            preferences: Study preferences for session sizing
        """
        self.preferences = preferences
        self.session_length = preferences.session_length_minutes
        self._task_counter = 0
    
    def _next_task_id(self, prefix: str = "task") -> str:
        """Generate a unique task ID."""
        self._task_counter += 1
        return f"{prefix}_{self._task_counter:04d}"
    
    def decompose_event(self, event: FixedEvent) -> list[StudyTask]:
        """
        Decompose a fixed event into study tasks.
        
        Args:
            event: The event to decompose
            
        Returns:
            List of study tasks for this event
        """
        tasks = []
        total_minutes = DateTimeUtils.hours_to_minutes(event.estimated_effort_hours)
        
        # Determine task type based on event type
        task_type = TaskType.INITIAL_LEARNING
        if event.event_type == EventType.EXAM:
            task_type = TaskType.EXAM_PREP
        
        # Calculate number of sessions needed
        num_sessions = max(1, (total_minutes + self.session_length - 1) // self.session_length)
        
        # Calculate minutes per session (distribute evenly)
        minutes_per_session = total_minutes // num_sessions
        remainder = total_minutes % num_sessions
        
        for i in range(num_sessions):
            # Add remainder to first sessions
            session_minutes = minutes_per_session + (1 if i < remainder else 0)
            session_minutes = min(session_minutes, self.session_length)
            
            task = StudyTask(
                task_id=self._next_task_id("event"),
                subject=event.subject,
                topic=event.topic or f"{event.event_type.value} preparation",
                deadline=event.target_date,
                required_minutes=session_minutes,
                priority=event.priority_level,
                difficulty_score=0.5,  # Default for events
                confidence_score=0.5,
                task_type=task_type,
                source_event_id=event.id,
            )
            tasks.append(task)
        
        return tasks
    
    def decompose_topic(
        self,
        topic: LearningTopic,
        deadline: date
    ) -> list[StudyTask]:
        """
        Decompose a learning topic into study tasks.
        
        High difficulty or low confidence results in more, smaller tasks.
        
        Args:
            topic: The learning topic
            deadline: Deadline for completing this topic
            
        Returns:
            List of study tasks
        """
        tasks = []
        
        # Calculate base effort
        base_minutes = DateTimeUtils.hours_to_minutes(topic.estimated_hours)
        
        # Adjust for difficulty and confidence
        # High difficulty (>0.7) → 1.5x more time
        # Low confidence (<0.3) → 1.5x more time
        difficulty_multiplier = 1.0 + (topic.difficulty_score * 0.5)
        confidence_multiplier = 1.0 + ((1 - topic.confidence_score) * 0.5)
        
        adjusted_minutes = int(base_minutes * difficulty_multiplier * confidence_multiplier)
        
        # For difficult/low-confidence topics, use smaller sessions
        if topic.difficulty_score > 0.7 or topic.confidence_score < 0.3:
            effective_session_length = min(self.session_length, 30)  # Max 30 min
        else:
            effective_session_length = self.session_length
        
        # Calculate number of sessions
        num_sessions = max(1, (adjusted_minutes + effective_session_length - 1) // effective_session_length)
        
        # Cap at reasonable number
        num_sessions = min(num_sessions, 10)
        
        # Distribute minutes
        minutes_per_session = adjusted_minutes // num_sessions
        remainder = adjusted_minutes % num_sessions
        
        for i in range(num_sessions):
            session_minutes = minutes_per_session + (1 if i < remainder else 0)
            session_minutes = min(max(session_minutes, 15), self.session_length)  # 15 min minimum
            
            task = StudyTask(
                task_id=self._next_task_id("topic"),
                subject=topic.subject,
                topic=topic.topic,
                deadline=deadline,
                required_minutes=session_minutes,
                priority=self._calculate_topic_priority(topic),
                difficulty_score=topic.difficulty_score,
                confidence_score=topic.confidence_score,
                task_type=TaskType.INITIAL_LEARNING,
                source_topic_id=topic.id,
            )
            tasks.append(task)
        
        return tasks
    
    def _calculate_topic_priority(self, topic: LearningTopic) -> int:
        """
        Calculate priority for a topic-based task.
        
        Based on difficulty and confidence.
        """
        # Higher difficulty and lower confidence → higher priority
        priority_score = (topic.difficulty_score + (1 - topic.confidence_score)) / 2
        return int(clamp(priority_score * 10, 1, 10))
    
    def create_revision_task(
        self,
        original_task: StudyTask,
        revision_date: date,
        iteration: int
    ) -> StudyTask:
        """
        Create a revision task linked to an original task.
        
        Args:
            original_task: The original learning task
            revision_date: When to schedule the revision
            iteration: Revision iteration (1, 2, 3, ...)
            
        Returns:
            Revision study task
        """
        # Revision tasks are shorter
        revision_minutes = max(15, original_task.required_minutes // 2)
        
        return StudyTask(
            task_id=self._next_task_id("revision"),
            subject=original_task.subject,
            topic=original_task.topic,
            deadline=revision_date,
            required_minutes=revision_minutes,
            priority=max(1, original_task.priority - 1),  # Slightly lower priority
            difficulty_score=original_task.difficulty_score,
            confidence_score=min(1.0, original_task.confidence_score + 0.1 * iteration),
            task_type=TaskType.REVISION,
            parent_task_id=original_task.task_id,
            source_topic_id=original_task.source_topic_id,
            revision_iteration=iteration,
        )


class CapacityPlanner:
    """
    Plans and manages daily capacity for the scheduling horizon.
    """
    
    def __init__(
        self,
        availability: DailyAvailability,
        preferences: StudyPreferences
    ):
        """
        Initialize the capacity planner.
        
        Args:
            availability: Daily availability configuration
            preferences: Study preferences
        """
        self.availability = availability
        self.preferences = preferences
    
    def build_capacity_map(
        self,
        start_date: date,
        end_date: date
    ) -> dict[str, DayCapacity]:
        """
        Build a capacity map for each day in the planning horizon.
        
        Args:
            start_date: First day to plan
            end_date: Last day to plan
            
        Returns:
            Dictionary mapping date string to DayCapacity
        """
        capacity_map = {}
        
        for current_date in DateTimeUtils.date_range(start_date, end_date):
            # Get raw available hours
            raw_hours = self.availability.get_hours_for_date(current_date)
            
            # Convert to minutes and apply buffer
            raw_minutes = DateTimeUtils.hours_to_minutes(raw_hours)
            buffer = int(raw_minutes * self.preferences.buffer_percentage)
            available_minutes = raw_minutes - buffer
            
            capacity = DayCapacity(
                date=current_date,
                total_minutes=raw_minutes,
                available_minutes=available_minutes,
                max_sessions=self.preferences.max_sessions_per_day,
                next_available_time=self.availability.start_time,
            )
            
            capacity_map[current_date.isoformat()] = capacity
        
        return capacity_map
    
    def get_total_capacity(self, capacity_map: dict[str, DayCapacity]) -> int:
        """Get total available minutes across all days."""
        return sum(cap.available_minutes for cap in capacity_map.values())
    
    def get_remaining_capacity(self, capacity_map: dict[str, DayCapacity]) -> int:
        """Get remaining available minutes across all days."""
        return sum(cap.available_minutes for cap in capacity_map.values())


class TimetableScheduler:
    """
    Main scheduler class that orchestrates timetable generation.
    
    Implements a deterministic, constraint-based scheduling algorithm:
    1. Normalize inputs
    2. Decompose into tasks
    3. Build capacity map
    4. Score and rank tasks
    5. Greedy allocation with constraints
    6. Add spaced repetition
    7. Handle conflicts
    """
    
    # Spaced repetition intervals (days after initial learning)
    REVISION_INTERVALS = (1, 3, 7)
    
    def __init__(
        self,
        events: list[dict],
        availability: dict,
        preferences: dict,
        topics: list[dict],
        current_date: str | date | None = None,
    ):
        """
        Initialize the scheduler.
        
        Args:
            events: Raw event data
            availability: Raw availability configuration
            preferences: Raw preferences configuration
            topics: Raw topic data
            current_date: Start date (defaults to today)
        """
        # Parse current date
        self.current_date = DateTimeUtils.parse_date(current_date)
        
        # Normalize inputs
        self.normalizer = InputNormalizer()
        self.events = self.normalizer.normalize_events(events)
        self.availability = self.normalizer.normalize_availability(availability)
        self.preferences = self.normalizer.normalize_preferences(preferences)
        self.topics = self.normalizer.normalize_topics(topics)
        
        # Initialize components
        self.scorer = UrgencyScorer()
        self.decomposer = TaskDecomposer(self.preferences)
        self.capacity_planner = CapacityPlanner(self.availability, self.preferences)
        
        # State
        self.tasks: list[StudyTask] = []
        self.warnings: list[CapacityWarning] = []
        self.schedule: dict[str, DaySchedule] = {}
    
    def generate(self) -> dict:
        """
        Generate the timetable.
        
        Returns:
            Timetable output as a dictionary
        """
        # 1. Determine planning horizon
        end_date = self._determine_horizon()
        
        # 2. Decompose events and topics into tasks
        self._decompose_all(end_date)
        
        # 3. Build capacity map
        capacity_map = self.capacity_planner.build_capacity_map(
            self.current_date, end_date
        )
        
        # 4. Initialize schedule
        self._initialize_schedule(self.current_date, end_date)
        
        # 5. Score and schedule tasks
        self._schedule_tasks(capacity_map, end_date)
        
        # 6. Add spaced repetition tasks
        self._add_spaced_repetition(capacity_map, end_date)
        
        # 7. Check for unscheduled tasks and generate warnings
        self._check_completeness()
        
        # 8. Build output
        output = TimetableOutput(
            schedule=self.schedule,
            tasks=self.tasks,
            warnings=self.warnings,
            metadata={
                "generated_at": self.current_date.isoformat(),
                "horizon_end": end_date.isoformat(),
                "total_tasks": len(self.tasks),
                "scheduled_tasks": len([t for t in self.tasks if t.status == TaskStatus.SCHEDULED]),
                "total_events": len(self.events),
                "total_topics": len(self.topics),
            }
        )
        
        return output.to_dict()
    
    def _determine_horizon(self) -> date:
        """Determine the planning horizon end date."""
        # Collect all deadlines
        deadlines = [e.target_date for e in self.events]
        
        if not deadlines:
            # Default to 30 days if no events
            return DateTimeUtils.add_days(self.current_date, 30)
        
        latest = DateTimeUtils.find_latest_date(deadlines)
        
        # Add a few days buffer after last deadline
        return DateTimeUtils.add_days(latest, 3)
    
    def _decompose_all(self, end_date: date) -> None:
        """Decompose all events and topics into tasks."""
        # Decompose events
        for event in self.events:
            tasks = self.decomposer.decompose_event(event)
            self.tasks.extend(tasks)
        
        # Decompose topics
        # Use the latest event deadline or horizon end as topic deadline
        topic_deadline = end_date
        if self.events:
            topic_deadline = DateTimeUtils.find_latest_date(
                [e.target_date for e in self.events]
            )
        
        for topic in self.topics:
            tasks = self.decomposer.decompose_topic(topic, topic_deadline)
            self.tasks.extend(tasks)
    
    def _initialize_schedule(self, start_date: date, end_date: date) -> None:
        """Initialize empty day schedules."""
        for current_date in DateTimeUtils.date_range(start_date, end_date):
            self.schedule[current_date.isoformat()] = DaySchedule(date=current_date)
    
    def _schedule_tasks(
        self,
        capacity_map: dict[str, DayCapacity],
        end_date: date
    ) -> None:
        """
        Schedule tasks using greedy allocation.
        
        Tasks are sorted by urgency score and allocated day-by-day.
        """
        # Filter to pending tasks only
        pending_tasks = [t for t in self.tasks if t.status == TaskStatus.PENDING]
        
        # Calculate planning horizon for scoring
        horizon_days = DateTimeUtils.days_between(self.current_date, end_date)
        
        # Score and rank tasks
        ranked_tasks = self.scorer.rank_tasks(
            pending_tasks, self.current_date, horizon_days
        )
        
        # Allocate tasks
        for task, score, breakdown in ranked_tasks:
            self._allocate_task(task, capacity_map)
    
    def _allocate_task(
        self,
        task: StudyTask,
        capacity_map: dict[str, DayCapacity]
    ) -> bool:
        """
        Allocate a single task to a time slot.
        
        Uses greedy allocation with constraint checking.
        
        Returns:
            True if task was scheduled, False otherwise
        """
        # Get valid dates (current date to deadline)
        valid_dates = list(DateTimeUtils.date_range(self.current_date, task.deadline))
        
        for target_date in valid_dates:
            date_key = target_date.isoformat()
            
            if date_key not in capacity_map:
                continue
            
            capacity = capacity_map[date_key]
            
            # Check if task fits
            if capacity.can_fit_session(
                task.required_minutes,
                task.subject,
                task.topic,
                self.preferences.max_subjects_per_day
            ):
                # Allocate
                self._add_task_to_schedule(task, capacity, target_date)
                return True
        
        # Could not schedule - try pushing past deadline if low priority
        if task.priority <= 5:
            # Try a few days past deadline
            for offset in range(1, 4):
                fallback_date = DateTimeUtils.add_days(task.deadline, offset)
                date_key = fallback_date.isoformat()
                
                if date_key not in capacity_map:
                    continue
                
                capacity = capacity_map[date_key]
                
                if capacity.can_fit_session(
                    task.required_minutes,
                    task.subject,
                    task.topic,
                    self.preferences.max_subjects_per_day
                ):
                    # Allocate with warning
                    self._add_task_to_schedule(task, capacity, fallback_date)
                    self.warnings.append(CapacityWarning(
                        date=fallback_date,
                        message=f"Task '{task.topic}' pushed past deadline",
                        affected_tasks=[task.task_id],
                        severity="warning",
                    ))
                    return True
        
        # Failed to schedule
        return False
    
    def _add_task_to_schedule(
        self,
        task: StudyTask,
        capacity: DayCapacity,
        target_date: date
    ) -> None:
        """Add a task to the schedule and update capacity."""
        date_key = target_date.isoformat()
        day_schedule = self.schedule[date_key]
        
        # Calculate time slot
        start_time = capacity.next_available_time
        end_time = DateTimeUtils.add_minutes_to_time(start_time, task.required_minutes)
        
        # Create time slot
        slot = TimeSlot(
            start_time=start_time,
            end_time=end_time,
            subject=task.subject,
            topic=task.topic,
            task_id=task.task_id,
            task_type=task.task_type,
        )
        
        # Add to schedule
        day_schedule.add_slot(slot)
        
        # Update task
        task.mark_scheduled(target_date, len(day_schedule.slots) - 1)
        
        # Update capacity
        capacity.allocate(task.required_minutes, task.subject, task.topic)
        
        # Update next available time (add break)
        total_minutes = task.required_minutes + self.preferences.break_length_minutes
        capacity.next_available_time = DateTimeUtils.add_minutes_to_time(
            start_time, total_minutes
        )
        
        # Update capacity used percentage
        if capacity.total_minutes > 0:
            used = capacity.total_minutes - capacity.available_minutes
            day_schedule.capacity_used = used / capacity.total_minutes
    
    def _add_spaced_repetition(
        self,
        capacity_map: dict[str, DayCapacity],
        end_date: date
    ) -> None:
        """
        Add spaced repetition tasks for concept-heavy topics.
        
        Follows intervals: +1 day, +3 days, +7 days after initial learning.
        """
        # Find scheduled initial learning tasks for concept-heavy topics
        concept_topic_ids = {t.id for t in self.topics if t.is_concept_heavy}
        
        initial_tasks = [
            t for t in self.tasks
            if t.status == TaskStatus.SCHEDULED
            and t.task_type == TaskType.INITIAL_LEARNING
            and t.source_topic_id in concept_topic_ids
            and t.scheduled_date is not None
        ]
        
        # Group by topic to avoid duplicate revisions
        topic_tasks: dict[str, StudyTask] = {}
        for task in initial_tasks:
            if task.source_topic_id:
                # Keep the earliest scheduled task for each topic
                existing = topic_tasks.get(task.source_topic_id)
                if not existing or (task.scheduled_date and existing.scheduled_date and 
                                   task.scheduled_date < existing.scheduled_date):
                    topic_tasks[task.source_topic_id] = task
        
        # Create revision tasks
        for source_task in topic_tasks.values():
            if source_task.scheduled_date is None:
                continue
                
            revision_dates = DateTimeUtils.get_spaced_repetition_dates(
                source_task.scheduled_date,
                end_date,
                self.REVISION_INTERVALS
            )
            
            for i, rev_date in enumerate(revision_dates, 1):
                revision_task = self.decomposer.create_revision_task(
                    source_task, rev_date, i
                )
                
                # Try to schedule
                date_key = rev_date.isoformat()
                if date_key in capacity_map:
                    capacity = capacity_map[date_key]
                    
                    if capacity.can_fit_session(
                        revision_task.required_minutes,
                        revision_task.subject,
                        revision_task.topic,
                        self.preferences.max_subjects_per_day
                    ):
                        self.tasks.append(revision_task)
                        self._add_task_to_schedule(revision_task, capacity, rev_date)
    
    def _check_completeness(self) -> None:
        """Check for unscheduled tasks and generate warnings."""
        unscheduled = [t for t in self.tasks if t.status == TaskStatus.PENDING]
        
        if unscheduled:
            # Group by deadline
            by_deadline: dict[date, list[StudyTask]] = {}
            for task in unscheduled:
                if task.deadline not in by_deadline:
                    by_deadline[task.deadline] = []
                by_deadline[task.deadline].append(task)
            
            for deadline, tasks in by_deadline.items():
                severity = "critical" if any(t.priority >= 8 for t in tasks) else "warning"
                
                self.warnings.append(CapacityWarning(
                    date=deadline,
                    message=f"Could not schedule {len(tasks)} task(s) before deadline",
                    affected_tasks=[t.task_id for t in tasks],
                    severity=severity,
                ))


# Convenience functions for adaptivity support

def handle_missed_session(
    timetable: TimetableOutput,
    task_id: str,
    current_date: date
) -> TimetableOutput:
    """
    Handle a missed study session.
    
    Increases task urgency and attempts to reschedule.
    
    Args:
        timetable: Current timetable
        task_id: ID of the missed task
        current_date: Current date
        
    Returns:
        Updated timetable
    """
    # Find the task
    task = next((t for t in timetable.tasks if t.task_id == task_id), None)
    
    if task is None:
        return timetable
    
    # Mark as missed
    task.mark_missed()
    
    # Create rescheduled task with higher priority
    rescheduled = task.clone_for_reschedule(f"{task_id}_reschedule")
    timetable.tasks.append(rescheduled)
    
    # Add warning
    timetable.warnings.append(CapacityWarning(
        date=current_date,
        message=f"Task '{task.topic}' was missed and needs rescheduling",
        affected_tasks=[task_id, rescheduled.task_id],
        severity="warning",
    ))
    
    return timetable


def update_confidence(
    timetable: TimetableOutput,
    topic_id: str,
    new_confidence: float
) -> list[StudyTask]:
    """
    Update confidence score for a topic and add revision tasks if needed.
    
    Args:
        timetable: Current timetable
        topic_id: ID of the topic
        new_confidence: New confidence score (0-1)
        
    Returns:
        List of new revision tasks to schedule
    """
    new_confidence = clamp(new_confidence, 0.0, 1.0)
    new_tasks = []
    
    # Update all tasks for this topic
    for task in timetable.tasks:
        if task.source_topic_id == topic_id:
            old_confidence = task.confidence_score
            task.confidence_score = new_confidence
            
            # If confidence dropped significantly, add revision
            if new_confidence < old_confidence - 0.2:
                revision = StudyTask(
                    task_id=f"{task.task_id}_confidence_revision",
                    subject=task.subject,
                    topic=task.topic,
                    deadline=task.deadline,
                    required_minutes=max(15, task.required_minutes // 2),
                    priority=min(10, task.priority + 2),
                    difficulty_score=task.difficulty_score,
                    confidence_score=new_confidence,
                    task_type=TaskType.REVISION,
                    parent_task_id=task.task_id,
                    source_topic_id=topic_id,
                )
                new_tasks.append(revision)
                break  # Only add one revision per confidence update
    
    return new_tasks
