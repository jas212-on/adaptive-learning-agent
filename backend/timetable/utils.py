"""
Date and Time Utilities for Timetable Generation

Pure Python helper functions for date manipulation and time calculations.
All functions are deterministic and side-effect free.
"""

from datetime import date, time, datetime, timedelta
from typing import Iterator, Optional


class DateTimeUtils:
    """Utility class for date and time operations."""
    
    @staticmethod
    def parse_date(date_input: str | date | None, default: date | None = None) -> date:
        """
        Parse a date from various input formats.
        
        Args:
            date_input: Date as ISO string, date object, or None
            default: Default date if input is None
            
        Returns:
            Parsed date object
            
        Raises:
            ValueError: If date cannot be parsed
        """
        if date_input is None:
            if default is not None:
                return default
            return date.today()
        
        if isinstance(date_input, date):
            return date_input
        
        if isinstance(date_input, datetime):
            return date_input.date()
        
        if isinstance(date_input, str):
            # Try ISO format first (YYYY-MM-DD)
            try:
                return date.fromisoformat(date_input)
            except ValueError:
                pass
            
            # Try other common formats
            formats = [
                "%Y/%m/%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
                "%m-%d-%Y",
                "%m/%d/%Y",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_input, fmt).date()
                except ValueError:
                    continue
        
        raise ValueError(f"Cannot parse date: {date_input}")
    
    @staticmethod
    def parse_time(time_input: str | time | None, default: time | None = None) -> time:
        """
        Parse a time from various input formats.
        
        Args:
            time_input: Time as string (HH:MM or HH:MM:SS), time object, or None
            default: Default time if input is None
            
        Returns:
            Parsed time object
        """
        if time_input is None:
            if default is not None:
                return default
            return time(9, 0)  # Default 9 AM
        
        if isinstance(time_input, time):
            return time_input
        
        if isinstance(time_input, str):
            # Try HH:MM:SS
            try:
                return time.fromisoformat(time_input)
            except ValueError:
                pass
            
            # Try HH:MM
            try:
                parts = time_input.split(":")
                if len(parts) >= 2:
                    return time(int(parts[0]), int(parts[1]))
            except (ValueError, IndexError):
                pass
        
        raise ValueError(f"Cannot parse time: {time_input}")
    
    @staticmethod
    def date_range(start_date: date, end_date: date) -> Iterator[date]:
        """
        Generate a range of dates from start to end (inclusive).
        
        Args:
            start_date: First date in range
            end_date: Last date in range (inclusive)
            
        Yields:
            Each date in the range
        """
        current = start_date
        while current <= end_date:
            yield current
            current += timedelta(days=1)
    
    @staticmethod
    def days_between(start_date: date, end_date: date) -> int:
        """
        Calculate the number of days between two dates.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            Number of days (can be negative if end < start)
        """
        return (end_date - start_date).days
    
    @staticmethod
    def add_days(base_date: date, days: int) -> date:
        """Add days to a date."""
        return base_date + timedelta(days=days)
    
    @staticmethod
    def is_weekend(target_date: date) -> bool:
        """Check if a date is a weekend (Saturday or Sunday)."""
        return target_date.weekday() >= 5
    
    @staticmethod
    def is_weekday(target_date: date) -> bool:
        """Check if a date is a weekday (Monday to Friday)."""
        return target_date.weekday() < 5
    
    @staticmethod
    def get_day_name(target_date: date) -> str:
        """Get the day name for a date."""
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return days[target_date.weekday()]
    
    @staticmethod
    def add_minutes_to_time(base_time: time, minutes: int) -> time:
        """
        Add minutes to a time, wrapping at midnight.
        
        Args:
            base_time: Starting time
            minutes: Minutes to add
            
        Returns:
            New time after adding minutes
        """
        total_minutes = base_time.hour * 60 + base_time.minute + minutes
        # Handle wrap-around (cap at 23:59)
        if total_minutes >= 24 * 60:
            return time(23, 59)
        if total_minutes < 0:
            return time(0, 0)
        
        hours = total_minutes // 60
        mins = total_minutes % 60
        return time(hours, mins)
    
    @staticmethod
    def minutes_between_times(start_time: time, end_time: time) -> int:
        """
        Calculate minutes between two times.
        
        Args:
            start_time: Start time
            end_time: End time
            
        Returns:
            Minutes between (assumes same day)
        """
        start_minutes = start_time.hour * 60 + start_time.minute
        end_minutes = end_time.hour * 60 + end_time.minute
        return end_minutes - start_minutes
    
    @staticmethod
    def time_to_minutes(t: time) -> int:
        """Convert a time to total minutes from midnight."""
        return t.hour * 60 + t.minute
    
    @staticmethod
    def minutes_to_time(minutes: int) -> time:
        """Convert minutes from midnight to a time object."""
        if minutes < 0:
            return time(0, 0)
        if minutes >= 24 * 60:
            return time(23, 59)
        return time(minutes // 60, minutes % 60)
    
    @staticmethod
    def find_latest_date(dates: list[date]) -> Optional[date]:
        """Find the latest date in a list."""
        if not dates:
            return None
        return max(dates)
    
    @staticmethod
    def find_earliest_date(dates: list[date]) -> Optional[date]:
        """Find the earliest date in a list."""
        if not dates:
            return None
        return min(dates)
    
    @staticmethod
    def get_spaced_repetition_dates(
        initial_date: date,
        end_date: date,
        intervals: tuple[int, ...] = (1, 3, 7)
    ) -> list[date]:
        """
        Calculate spaced repetition dates from an initial learning date.
        
        Args:
            initial_date: Date of initial learning
            end_date: Latest allowed date
            intervals: Day intervals for repetition (default: +1, +3, +7 days)
            
        Returns:
            List of valid repetition dates within the range
        """
        dates = []
        for interval in intervals:
            rep_date = initial_date + timedelta(days=interval)
            if rep_date <= end_date:
                dates.append(rep_date)
        return dates
    
    @staticmethod
    def hours_to_minutes(hours: float) -> int:
        """Convert hours to minutes."""
        return int(hours * 60)
    
    @staticmethod
    def minutes_to_hours(minutes: int) -> float:
        """Convert minutes to hours."""
        return minutes / 60.0
    
    @staticmethod
    def format_duration(minutes: int) -> str:
        """
        Format a duration in minutes to a human-readable string.
        
        Args:
            minutes: Duration in minutes
            
        Returns:
            Formatted string like "1h 30m" or "45m"
        """
        if minutes < 60:
            return f"{minutes}m"
        
        hours = minutes // 60
        remaining_mins = minutes % 60
        
        if remaining_mins == 0:
            return f"{hours}h"
        return f"{hours}h {remaining_mins}m"


def generate_task_id(prefix: str, *components: str | int) -> str:
    """
    Generate a deterministic task ID.
    
    Args:
        prefix: ID prefix (e.g., "task", "revision")
        components: Additional components to include in ID
        
    Returns:
        Deterministic task ID
    """
    parts = [prefix] + [str(c) for c in components]
    return "_".join(parts)


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp a value to a range."""
    return max(min_val, min(max_val, value))


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safely divide, returning default if denominator is zero."""
    if denominator == 0:
        return default
    return numerator / denominator
