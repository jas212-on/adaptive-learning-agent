"""
Urgency Scoring System for Timetable Generation

Deterministic scoring algorithms for task prioritization.
All calculations are explainable and reproducible.
"""

from datetime import date
from dataclasses import dataclass
from typing import Optional

from .models import StudyTask, TaskType, TaskStatus
from .utils import DateTimeUtils, clamp, safe_divide


@dataclass(frozen=True)
class ScoreWeights:
    """
    Configurable weights for urgency score calculation.
    
    All weights should sum to approximately 1.0 for normalized scoring.
    """
    priority_weight: float = 0.25      # Weight for task priority (1-10)
    difficulty_weight: float = 0.15    # Weight for difficulty score (0-1)
    deadline_weight: float = 0.35      # Weight for deadline urgency
    confidence_weight: float = 0.15    # Weight for inverse confidence
    type_weight: float = 0.10          # Weight for task type bonus
    
    def __post_init__(self):
        """Validate weights sum reasonably close to 1.0."""
        total = (
            self.priority_weight + 
            self.difficulty_weight + 
            self.deadline_weight + 
            self.confidence_weight + 
            self.type_weight
        )
        if not 0.95 <= total <= 1.05:
            raise ValueError(f"Weights should sum to ~1.0, got {total}")


@dataclass
class ScoreBreakdown:
    """
    Detailed breakdown of urgency score components.
    
    Useful for debugging and explaining scheduling decisions.
    """
    task_id: str
    total_score: float
    priority_component: float
    difficulty_component: float
    deadline_component: float
    confidence_component: float
    type_component: float
    days_until_deadline: int
    explanation: str
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "task_id": self.task_id,
            "total_score": round(self.total_score, 4),
            "components": {
                "priority": round(self.priority_component, 4),
                "difficulty": round(self.difficulty_component, 4),
                "deadline": round(self.deadline_component, 4),
                "confidence": round(self.confidence_component, 4),
                "type": round(self.type_component, 4),
            },
            "days_until_deadline": self.days_until_deadline,
            "explanation": self.explanation,
        }


class UrgencyScorer:
    """
    Calculates urgency scores for study tasks.
    
    The urgency score determines task scheduling priority.
    Higher scores = more urgent = scheduled earlier.
    
    Score components:
    1. Priority: Direct mapping from task priority (1-10 → 0.1-1.0)
    2. Difficulty: Higher difficulty → needs more time → higher urgency
    3. Deadline: Closer deadline → exponentially higher urgency
    4. Confidence: Lower confidence → needs more practice → higher urgency
    5. Type: Exam prep and revision get slight boosts
    """
    
    # Task type bonus multipliers
    TYPE_BONUSES = {
        TaskType.EXAM_PREP: 0.15,
        TaskType.REVISION: 0.08,
        TaskType.INITIAL_LEARNING: 0.05,
        TaskType.PRACTICE: 0.02,
    }
    
    def __init__(self, weights: Optional[ScoreWeights] = None):
        """
        Initialize the scorer.
        
        Args:
            weights: Custom score weights, or None for defaults
        """
        self.weights = weights or ScoreWeights()
    
    def calculate_score(
        self,
        task: StudyTask,
        current_date: date,
        planning_horizon_days: int = 30
    ) -> float:
        """
        Calculate the urgency score for a task.
        
        Args:
            task: The task to score
            current_date: Current/reference date for calculations
            planning_horizon_days: Total planning horizon for normalization
            
        Returns:
            Urgency score between 0 and 1 (higher = more urgent)
        """
        breakdown = self.calculate_score_with_breakdown(
            task, current_date, planning_horizon_days
        )
        return breakdown.total_score
    
    def calculate_score_with_breakdown(
        self,
        task: StudyTask,
        current_date: date,
        planning_horizon_days: int = 30
    ) -> ScoreBreakdown:
        """
        Calculate urgency score with detailed breakdown.
        
        Args:
            task: The task to score
            current_date: Current/reference date for calculations
            planning_horizon_days: Total planning horizon for normalization
            
        Returns:
            ScoreBreakdown with all component details
        """
        # 1. Priority component (normalize 1-10 to 0.1-1.0)
        priority_component = self._calculate_priority_component(task.priority)
        
        # 2. Difficulty component (already 0-1)
        difficulty_component = self._calculate_difficulty_component(task.difficulty_score)
        
        # 3. Deadline urgency component
        days_remaining = DateTimeUtils.days_between(current_date, task.deadline)
        deadline_component = self._calculate_deadline_component(
            days_remaining, planning_horizon_days
        )
        
        # 4. Confidence component (inverse - lower confidence = higher urgency)
        confidence_component = self._calculate_confidence_component(task.confidence_score)
        
        # 5. Task type bonus
        type_component = self._calculate_type_component(task.task_type)
        
        # Weighted sum
        total_score = (
            priority_component * self.weights.priority_weight +
            difficulty_component * self.weights.difficulty_weight +
            deadline_component * self.weights.deadline_weight +
            confidence_component * self.weights.confidence_weight +
            type_component * self.weights.type_weight
        )
        
        # Clamp final score to [0, 1]
        total_score = clamp(total_score, 0.0, 1.0)
        
        # Generate explanation
        explanation = self._generate_explanation(
            task, days_remaining, priority_component, 
            deadline_component, confidence_component
        )
        
        return ScoreBreakdown(
            task_id=task.task_id,
            total_score=total_score,
            priority_component=priority_component,
            difficulty_component=difficulty_component,
            deadline_component=deadline_component,
            confidence_component=confidence_component,
            type_component=type_component,
            days_until_deadline=days_remaining,
            explanation=explanation,
        )
    
    def _calculate_priority_component(self, priority: int) -> float:
        """
        Calculate priority component.
        
        Maps priority 1-10 to score 0.1-1.0 linearly.
        """
        # Ensure priority is in valid range
        priority = clamp(priority, 1, 10)
        return priority / 10.0
    
    def _calculate_difficulty_component(self, difficulty_score: float) -> float:
        """
        Calculate difficulty component.
        
        Higher difficulty = higher urgency (needs more time).
        """
        return clamp(difficulty_score, 0.0, 1.0)
    
    def _calculate_deadline_component(
        self,
        days_remaining: int,
        planning_horizon_days: int
    ) -> float:
        """
        Calculate deadline urgency component.
        
        Uses an exponential decay function:
        - Far deadlines (>horizon) → low urgency (~0.1)
        - Medium deadlines → medium urgency
        - Close deadlines (<3 days) → high urgency (~0.9-1.0)
        - Overdue → maximum urgency (1.0)
        """
        if days_remaining <= 0:
            # Overdue - maximum urgency
            return 1.0
        
        if days_remaining >= planning_horizon_days:
            # Far deadline - minimal urgency
            return 0.1
        
        # Exponential decay: urgency increases as deadline approaches
        # Formula: 1 - (days_remaining / horizon) ^ decay_factor
        decay_factor = 0.5  # Adjust for steepness
        normalized_days = days_remaining / planning_horizon_days
        urgency = 1.0 - (normalized_days ** decay_factor)
        
        # Ensure minimum urgency of 0.1
        return max(0.1, urgency)
    
    def _calculate_confidence_component(self, confidence_score: float) -> float:
        """
        Calculate inverse confidence component.
        
        Lower confidence = higher urgency (needs more practice).
        """
        confidence = clamp(confidence_score, 0.0, 1.0)
        # Inverse: low confidence (0.2) → high urgency (0.8)
        return 1.0 - confidence
    
    def _calculate_type_component(self, task_type: TaskType) -> float:
        """
        Calculate task type bonus.
        
        Exam prep and revision get priority boosts.
        """
        return self.TYPE_BONUSES.get(task_type, 0.0)
    
    def _generate_explanation(
        self,
        task: StudyTask,
        days_remaining: int,
        priority_comp: float,
        deadline_comp: float,
        confidence_comp: float
    ) -> str:
        """Generate a human-readable explanation of the score."""
        factors = []
        
        if task.priority >= 8:
            factors.append("high priority")
        elif task.priority <= 3:
            factors.append("low priority")
        
        if days_remaining <= 0:
            factors.append("OVERDUE")
        elif days_remaining <= 3:
            factors.append("deadline imminent")
        elif days_remaining <= 7:
            factors.append("deadline approaching")
        
        if task.confidence_score < 0.3:
            factors.append("low confidence")
        elif task.confidence_score > 0.8:
            factors.append("high confidence")
        
        if task.difficulty_score > 0.7:
            factors.append("high difficulty")
        
        if task.task_type == TaskType.EXAM_PREP:
            factors.append("exam preparation")
        elif task.task_type == TaskType.REVISION:
            factors.append("revision task")
        
        if not factors:
            return "Standard priority task"
        
        return ", ".join(factors).capitalize()
    
    def rank_tasks(
        self,
        tasks: list[StudyTask],
        current_date: date,
        planning_horizon_days: int = 30
    ) -> list[tuple[StudyTask, float, ScoreBreakdown]]:
        """
        Rank a list of tasks by urgency score.
        
        Args:
            tasks: List of tasks to rank
            current_date: Current date for calculations
            planning_horizon_days: Planning horizon for normalization
            
        Returns:
            List of (task, score, breakdown) tuples, sorted by score descending
        """
        scored_tasks = []
        for task in tasks:
            breakdown = self.calculate_score_with_breakdown(
                task, current_date, planning_horizon_days
            )
            scored_tasks.append((task, breakdown.total_score, breakdown))
        
        # Sort by score descending (most urgent first)
        # Secondary sort by deadline (earlier deadline first for ties)
        scored_tasks.sort(key=lambda x: (-x[1], x[0].deadline))
        
        return scored_tasks
    
    def filter_schedulable_tasks(
        self,
        tasks: list[StudyTask],
        current_date: date
    ) -> list[StudyTask]:
        """
        Filter tasks to only those that can still be scheduled.
        
        Excludes:
        - Completed tasks
        - Tasks with deadlines in the past
        
        Args:
            tasks: All tasks
            current_date: Current date
            
        Returns:
            List of schedulable tasks
        """
        schedulable = []
        for task in tasks:
            # Skip completed tasks
            if task.status == TaskStatus.COMPLETED:
                continue
            
            # Skip tasks that are overdue by more than 1 day
            # (Allow 1 day grace for "today" deadlines)
            days_remaining = DateTimeUtils.days_between(current_date, task.deadline)
            if days_remaining < -1:
                continue
            
            schedulable.append(task)
        
        return schedulable


def compute_task_urgency_batch(
    tasks: list[StudyTask],
    current_date: date,
    weights: Optional[ScoreWeights] = None,
    planning_horizon_days: int = 30
) -> dict[str, float]:
    """
    Convenience function to compute urgency scores for multiple tasks.
    
    Args:
        tasks: List of tasks to score
        current_date: Current date for calculations
        weights: Optional custom weights
        planning_horizon_days: Planning horizon
        
    Returns:
        Dictionary mapping task_id to urgency score
    """
    scorer = UrgencyScorer(weights)
    return {
        task.task_id: scorer.calculate_score(task, current_date, planning_horizon_days)
        for task in tasks
    }
