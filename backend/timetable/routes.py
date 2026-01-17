"""
FastAPI Router for Timetable Generation

REST API endpoints for the timetable generation module.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .scheduler import TimetableScheduler, handle_missed_session, update_confidence
from .models import TimetableOutput


# ============================================================================
# Pydantic Request/Response Models
# ============================================================================

class FixedEventInput(BaseModel):
    """Input model for a fixed event."""
    id: Optional[str] = None
    event_type: str = Field(default="deadline", description="Type: exam, assignment, deadline, lecture, lab")
    subject: str = Field(..., description="Subject/course name")
    topic: Optional[str] = Field(default=None, description="Specific topic")
    target_date: str = Field(..., description="Date in ISO format (YYYY-MM-DD)")
    priority_level: int = Field(default=5, ge=1, le=10, description="Priority 1-10")
    estimated_effort_hours: float = Field(default=2.0, ge=0, description="Hours needed to prepare")
    description: str = Field(default="", description="Optional description")


class DailyAvailabilityInput(BaseModel):
    """Input model for daily availability."""
    weekday_hours: float = Field(default=4.0, ge=0, le=16, description="Available hours on weekdays")
    weekend_hours: float = Field(default=6.0, ge=0, le=16, description="Available hours on weekends")
    start_time: str = Field(default="09:00", description="Earliest study time (HH:MM)")
    end_time: str = Field(default="21:00", description="Latest study time (HH:MM)")
    excluded_dates: list[str] = Field(default_factory=list, description="Dates with no availability")


class StudyPreferencesInput(BaseModel):
    """Input model for study preferences."""
    session_length_minutes: int = Field(default=45, ge=15, le=120, description="Session duration")
    break_length_minutes: int = Field(default=15, ge=0, le=60, description="Break between sessions")
    max_sessions_per_day: int = Field(default=6, ge=1, le=12, description="Max sessions per day")
    max_subjects_per_day: int = Field(default=3, ge=1, le=6, description="Max different subjects per day")
    buffer_percentage: float = Field(default=0.15, ge=0.1, le=0.3, description="Reserve capacity (10-30%)")
    prefer_morning: bool = Field(default=True, description="Prefer morning sessions")


class LearningTopicInput(BaseModel):
    """Input model for a learning topic."""
    id: Optional[str] = None
    subject: str = Field(..., description="Subject/course name")
    topic: str = Field(..., description="Topic name")
    difficulty_score: float = Field(default=0.5, ge=0, le=1, description="Difficulty 0-1")
    confidence_score: float = Field(default=0.5, ge=0, le=1, description="Confidence/mastery 0-1")
    prerequisites: list[str] = Field(default_factory=list, description="Prerequisite topic IDs")
    estimated_hours: float = Field(default=2.0, ge=0.5, le=20, description="Base hours to learn")
    is_concept_heavy: bool = Field(default=False, description="Needs spaced repetition")


class GenerateTimetableRequest(BaseModel):
    """Request model for timetable generation."""
    events: list[FixedEventInput] = Field(default_factory=list, description="Fixed events")
    availability: DailyAvailabilityInput = Field(default_factory=DailyAvailabilityInput)
    preferences: StudyPreferencesInput = Field(default_factory=StudyPreferencesInput)
    topics: list[LearningTopicInput] = Field(default_factory=list, description="Learning topics")
    current_date: Optional[str] = Field(default=None, description="Start date (defaults to today)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "events": [
                    {
                        "event_type": "exam",
                        "subject": "Mathematics",
                        "topic": "Calculus",
                        "target_date": "2024-02-15",
                        "priority_level": 9,
                        "estimated_effort_hours": 10
                    }
                ],
                "availability": {
                    "weekday_hours": 4,
                    "weekend_hours": 6,
                    "start_time": "09:00",
                    "end_time": "21:00"
                },
                "preferences": {
                    "session_length_minutes": 45,
                    "break_length_minutes": 15,
                    "max_sessions_per_day": 6,
                    "max_subjects_per_day": 3
                },
                "topics": [
                    {
                        "subject": "Mathematics",
                        "topic": "Derivatives",
                        "difficulty_score": 0.7,
                        "confidence_score": 0.4,
                        "is_concept_heavy": True
                    }
                ]
            }
        }
    }


class MissedSessionRequest(BaseModel):
    """Request model for handling missed sessions."""
    task_id: str = Field(..., description="ID of the missed task")
    current_date: Optional[str] = Field(default=None, description="Current date")


class UpdateConfidenceRequest(BaseModel):
    """Request model for updating topic confidence."""
    topic_id: str = Field(..., description="ID of the topic")
    new_confidence: float = Field(..., ge=0, le=1, description="New confidence score")


class TimetableResponse(BaseModel):
    """Response model for generated timetable."""
    success: bool
    data: dict
    message: str = ""


# ============================================================================
# FastAPI Router
# ============================================================================

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post("/generate", response_model=TimetableResponse)
async def generate_timetable(request: GenerateTimetableRequest) -> TimetableResponse:
    """
    Generate a study timetable.
    
    Takes events, availability, preferences, and topics as input.
    Returns a deterministic, constraint-based schedule.
    """
    try:
        # Convert Pydantic models to dicts
        events = [e.model_dump() for e in request.events]
        availability = request.availability.model_dump()
        preferences = request.preferences.model_dump()
        topics = [t.model_dump() for t in request.topics]
        
        # Generate timetable
        scheduler = TimetableScheduler(
            events=events,
            availability=availability,
            preferences=preferences,
            topics=topics,
            current_date=request.current_date,
        )
        
        result = scheduler.generate()
        
        # Check for warnings
        warnings_count = len(result.get("warnings", []))
        message = "Timetable generated successfully"
        if warnings_count > 0:
            message = f"Timetable generated with {warnings_count} warning(s)"
        
        return TimetableResponse(
            success=True,
            data=result,
            message=message,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate timetable: {str(e)}")


@router.get("/sample", response_model=TimetableResponse)
async def get_sample_timetable() -> TimetableResponse:
    """
    Generate a sample timetable for demonstration.
    
    Uses predefined sample data to show the system's capabilities.
    """
    # Sample events
    sample_events = [
        {
            "id": "exam_1",
            "event_type": "exam",
            "subject": "Mathematics",
            "topic": "Calculus Final",
            "target_date": date.today().isoformat(),
            "priority_level": 9,
            "estimated_effort_hours": 12,
        },
        {
            "id": "assignment_1",
            "event_type": "assignment",
            "subject": "Physics",
            "topic": "Lab Report",
            "target_date": date.today().isoformat(),
            "priority_level": 7,
            "estimated_effort_hours": 4,
        },
    ]
    
    # Adjust dates to be in the future
    from datetime import timedelta
    for i, event in enumerate(sample_events):
        future_date = date.today() + timedelta(days=7 + i * 3)
        event["target_date"] = future_date.isoformat()
    
    # Sample topics
    sample_topics = [
        {
            "id": "topic_1",
            "subject": "Mathematics",
            "topic": "Derivatives",
            "difficulty_score": 0.7,
            "confidence_score": 0.4,
            "is_concept_heavy": True,
            "estimated_hours": 3,
        },
        {
            "id": "topic_2",
            "subject": "Mathematics",
            "topic": "Integrals",
            "difficulty_score": 0.8,
            "confidence_score": 0.3,
            "is_concept_heavy": True,
            "estimated_hours": 4,
        },
        {
            "id": "topic_3",
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
        events=sample_events,
        availability={
            "weekday_hours": 4,
            "weekend_hours": 6,
        },
        preferences={
            "session_length_minutes": 45,
            "max_sessions_per_day": 6,
        },
        topics=sample_topics,
    )
    
    result = scheduler.generate()
    
    return TimetableResponse(
        success=True,
        data=result,
        message="Sample timetable generated",
    )


@router.post("/validate", response_model=TimetableResponse)
async def validate_inputs(request: GenerateTimetableRequest) -> TimetableResponse:
    """
    Validate timetable inputs without generating a schedule.
    
    Useful for checking if inputs are valid before generation.
    """
    try:
        # Try to normalize inputs (will raise if invalid)
        from .scheduler import InputNormalizer
        
        normalizer = InputNormalizer()
        
        events = normalizer.normalize_events([e.model_dump() for e in request.events])
        availability = normalizer.normalize_availability(request.availability.model_dump())
        preferences = normalizer.normalize_preferences(request.preferences.model_dump())
        topics = normalizer.normalize_topics([t.model_dump() for t in request.topics])
        
        return TimetableResponse(
            success=True,
            data={
                "events_count": len(events),
                "topics_count": len(topics),
                "weekday_hours": availability.weekday_hours,
                "weekend_hours": availability.weekend_hours,
                "session_length": preferences.session_length_minutes,
            },
            message="All inputs are valid",
        )
        
    except ValueError as e:
        return TimetableResponse(
            success=False,
            data={"error": str(e)},
            message="Validation failed",
        )


# Export the router
__all__ = ["router"]
