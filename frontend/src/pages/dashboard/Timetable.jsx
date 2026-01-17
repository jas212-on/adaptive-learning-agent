import { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays,
  Wand2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import * as api from '../../services/api'

// Helper to format time from "HH:MM:SS" to "HH:MM"
function formatTime(timeStr) {
  if (!timeStr) return ''
  return timeStr.slice(0, 5)
}

// Helper to format duration in minutes
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Helper to get date display
function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Get today's date in ISO format
function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

// Add days to a date
function addDays(dateStr, days) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

// Event type badge colors
const EVENT_TYPE_COLORS = {
  exam: 'bg-red-500/20 text-red-400 border-red-500/30',
  assignment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  deadline: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lecture: 'bg-green-500/20 text-green-400 border-green-500/30',
  lab: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

// Task type badge colors
const TASK_TYPE_COLORS = {
  initial_learning: 'bg-blue-500/20 text-blue-300',
  revision: 'bg-green-500/20 text-green-300',
  practice: 'bg-yellow-500/20 text-yellow-300',
  exam_prep: 'bg-red-500/20 text-red-300',
}

// Default event template
const DEFAULT_EVENT = {
  event_type: 'exam',
  subject: '',
  topic: '',
  target_date: addDays(getTodayISO(), 7),
  priority_level: 7,
  estimated_effort_hours: 5,
}

// Default topic template
const DEFAULT_TOPIC = {
  subject: '',
  topic: '',
  difficulty_score: 0.5,
  confidence_score: 0.5,
  estimated_hours: 2,
  is_concept_heavy: false,
}

export default function Timetable() {
  // Input state
  const [events, setEvents] = useState([{ ...DEFAULT_EVENT, id: 'event_1' }])
  const [topics, setTopics] = useState([])
  const [availability, setAvailability] = useState({
    weekdayHours: 4,
    weekendHours: 6,
    startTime: '09:00',
    endTime: '21:00',
  })
  const [preferences, setPreferences] = useState({
    sessionLengthMinutes: 45,
    breakLengthMinutes: 15,
    maxSessionsPerDay: 6,
    maxSubjectsPerDay: 3,
    bufferPercentage: 0.15,
  })

  // UI state
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTopics, setShowTopics] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  // Event counter for unique IDs
  const [eventCounter, setEventCounter] = useState(2)
  const [topicCounter, setTopicCounter] = useState(1)

  // Add a new event
  function addEvent() {
    setEvents([
      ...events,
      { ...DEFAULT_EVENT, id: `event_${eventCounter}`, target_date: addDays(getTodayISO(), 7 + events.length) },
    ])
    setEventCounter(eventCounter + 1)
  }

  // Remove an event
  function removeEvent(id) {
    setEvents(events.filter((e) => e.id !== id))
  }

  // Update an event field
  function updateEvent(id, field, value) {
    setEvents(events.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  // Add a new topic
  function addTopic() {
    setTopics([...topics, { ...DEFAULT_TOPIC, id: `topic_${topicCounter}` }])
    setTopicCounter(topicCounter + 1)
  }

  // Remove a topic
  function removeTopic(id) {
    setTopics(topics.filter((t) => t.id !== id))
  }

  // Update a topic field
  function updateTopic(id, field, value) {
    setTopics(topics.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  // Generate timetable
  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateTimetable({
        events: events.filter((e) => e.subject && e.target_date),
        availability,
        preferences,
        topics: topics.filter((t) => t.subject && t.topic),
      })

      if (res.success) {
        setData(res.data)
        // Select first date with slots
        const firstDate = Object.keys(res.data.schedule).find(
          (d) => res.data.schedule[d].slots?.length > 0
        )
        setSelectedDate(firstDate || null)
      } else {
        setError(res.message || 'Failed to generate timetable')
      }
    } catch (err) {
      setError(err?.message || 'Failed to generate timetable')
    } finally {
      setLoading(false)
    }
  }

  // Load sample timetable
  async function loadSample() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getSampleTimetable()
      if (res.success) {
        setData(res.data)
        const firstDate = Object.keys(res.data.schedule).find(
          (d) => res.data.schedule[d].slots?.length > 0
        )
        setSelectedDate(firstDate || null)
      }
    } catch (err) {
      setError(err?.message || 'Failed to load sample')
    } finally {
      setLoading(false)
    }
  }

  // Get sorted dates from schedule
  const sortedDates = useMemo(() => {
    if (!data?.schedule) return []
    return Object.keys(data.schedule).sort()
  }, [data])

  // Get stats
  const stats = useMemo(() => {
    if (!data) return null
    return {
      totalTasks: data.metadata?.total_tasks || 0,
      scheduledTasks: data.metadata?.scheduled_tasks || 0,
      totalEvents: data.metadata?.total_events || 0,
      totalTopics: data.metadata?.total_topics || 0,
      warningsCount: data.warnings?.length || 0,
    }
  }, [data])

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={18} /> Study Timetable Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Events Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-white">Fixed Events (Exams, Assignments, Deadlines)</label>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={addEvent}
              >
                <Plus size={16} /> Add Event
              </Button>
            </div>

            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2"
                >
                  <select
                    value={event.event_type}
                    onChange={(e) => updateEvent(event.id, 'event_type', e.target.value)}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white"
                  >
                    <option value="exam">Exam</option>
                    <option value="assignment">Assignment</option>
                    <option value="deadline">Deadline</option>
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                  </select>

                  <Input
                    placeholder="Subject"
                    value={event.subject}
                    onChange={(e) => updateEvent(event.id, 'subject', e.target.value)}
                    className="h-9 w-32"
                  />

                  <Input
                    placeholder="Topic (optional)"
                    value={event.topic}
                    onChange={(e) => updateEvent(event.id, 'topic', e.target.value)}
                    className="h-9 w-40"
                  />

                  <Input
                    type="date"
                    value={event.target_date}
                    onChange={(e) => updateEvent(event.id, 'target_date', e.target.value)}
                    className="h-9 w-36"
                  />

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/50">Pri:</span>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={event.priority_level}
                      onChange={(e) => updateEvent(event.id, 'priority_level', parseInt(e.target.value) || 5)}
                      className="h-9 w-14"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/50">Hours:</span>
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={event.estimated_effort_hours}
                      onChange={(e) =>
                        updateEvent(event.id, 'estimated_effort_hours', parseFloat(e.target.value) || 1)
                      }
                      className="h-9 w-16"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEvent(event.id)}
                    className="ml-auto h-8 w-8 text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}

              {events.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-white/50">
                  No events added. Click "Add Event" to add exams, assignments, or deadlines.
                </div>
              )}
            </div>
          </div>

          {/* Topics Section (Collapsible) */}
          <div>
            <button
              onClick={() => setShowTopics(!showTopics)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2 text-sm font-medium text-white hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <BookOpen size={16} />
                Learning Topics ({topics.length})
              </span>
              {showTopics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTopics && (
              <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={addTopic}>
                    <Plus size={16} /> Add Topic
                  </Button>
                </div>

                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
                  >
                    <Input
                      placeholder="Subject"
                      value={topic.subject}
                      onChange={(e) => updateTopic(topic.id, 'subject', e.target.value)}
                      className="h-9 w-32"
                    />

                    <Input
                      placeholder="Topic Name"
                      value={topic.topic}
                      onChange={(e) => updateTopic(topic.id, 'topic', e.target.value)}
                      className="h-9 w-40"
                    />

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-white/50">Difficulty:</span>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={topic.difficulty_score}
                        onChange={(e) =>
                          updateTopic(topic.id, 'difficulty_score', parseFloat(e.target.value) || 0.5)
                        }
                        className="h-9 w-16"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-white/50">Confidence:</span>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={topic.confidence_score}
                        onChange={(e) =>
                          updateTopic(topic.id, 'confidence_score', parseFloat(e.target.value) || 0.5)
                        }
                        className="h-9 w-16"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-white/50">Hours:</span>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={topic.estimated_hours}
                        onChange={(e) =>
                          updateTopic(topic.id, 'estimated_hours', parseFloat(e.target.value) || 2)
                        }
                        className="h-9 w-16"
                      />
                    </div>

                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={topic.is_concept_heavy}
                        onChange={(e) => updateTopic(topic.id, 'is_concept_heavy', e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      Needs revision
                    </label>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTopic(topic.id)}
                      className="ml-auto h-8 w-8 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}

                {topics.length === 0 && (
                  <div className="text-center text-sm text-white/50">
                    Add learning topics to include them in your study plan.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings Section (Collapsible) */}
          <div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2 text-sm font-medium text-white hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <Settings size={16} />
                Availability & Preferences
              </span>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSettings && (
              <div className="mt-2 grid gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-medium">Availability</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Weekday hours:</label>
                      <Input
                        type="number"
                        min={0}
                        max={16}
                        value={availability.weekdayHours}
                        onChange={(e) =>
                          setAvailability({ ...availability, weekdayHours: parseFloat(e.target.value) || 4 })
                        }
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Weekend hours:</label>
                      <Input
                        type="number"
                        min={0}
                        max={16}
                        value={availability.weekendHours}
                        onChange={(e) =>
                          setAvailability({ ...availability, weekendHours: parseFloat(e.target.value) || 6 })
                        }
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Start time:</label>
                      <Input
                        type="time"
                        value={availability.startTime}
                        onChange={(e) => setAvailability({ ...availability, startTime: e.target.value })}
                        className="h-8 w-28"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">End time:</label>
                      <Input
                        type="time"
                        value={availability.endTime}
                        onChange={(e) => setAvailability({ ...availability, endTime: e.target.value })}
                        className="h-8 w-28"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium">Preferences</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Session length:</label>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={preferences.sessionLengthMinutes}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            sessionLengthMinutes: parseInt(e.target.value) || 45,
                          })
                        }
                        className="h-8 w-20"
                      />
                      <span className="text-xs text-white/50">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Break length:</label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={preferences.breakLengthMinutes}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            breakLengthMinutes: parseInt(e.target.value) || 15,
                          })
                        }
                        className="h-8 w-20"
                      />
                      <span className="text-xs text-white/50">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Max sessions/day:</label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={preferences.maxSessionsPerDay}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            maxSessionsPerDay: parseInt(e.target.value) || 6,
                          })
                        }
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-32 text-xs text-white/50">Max subjects/day:</label>
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        value={preferences.maxSubjectsPerDay}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            maxSubjectsPerDay: parseInt(e.target.value) || 3,
                          })
                        }
                        className="h-8 w-20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-xl bg-white text-black hover:bg-white/90"
              onClick={generate}
              disabled={loading}
            >
              {loading ? <Spinner /> : <Wand2 size={18} />}
              Generate Timetable
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              onClick={loadSample}
              disabled={loading}
            >
              Load Sample
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
              <AlertTriangle size={18} className="text-red-400" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalTasks}</div>
              <div className="text-xs font-light text-white/50">Total Tasks</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.scheduledTasks}</div>
              <div className="text-xs font-light text-white/50">Scheduled</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalEvents}</div>
              <div className="text-xs font-light text-white/50">Events</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalTopics}</div>
              <div className="text-xs font-light text-white/50">Topics</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className={`text-2xl font-bold ${stats.warningsCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {stats.warningsCount}
              </div>
              <div className="text-xs font-light text-white/50">Warnings</div>
            </div>
          </div>

          {/* Warnings */}
          {data.warnings?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle size={18} /> Scheduling Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 ${
                        warning.severity === 'critical'
                          ? 'border-red-500/30 bg-red-500/10'
                          : 'border-yellow-500/30 bg-yellow-500/10'
                      }`}
                    >
                      <div className="text-sm">{warning.message}</div>
                      <div className="mt-1 text-xs text-white/50">
                        Date: {formatDate(warning.date)} • Tasks: {warning.affected_tasks?.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule Calendar View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays size={18} /> Generated Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Date Tabs */}
              <div className="mb-4 flex flex-wrap gap-1">
                {sortedDates.map((dateStr) => {
                  const dayData = data.schedule[dateStr]
                  const hasSlots = dayData?.slots?.length > 0
                  const isSelected = selectedDate === dateStr

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : hasSlots
                            ? 'border-white/10 hover:border-white/20 hover:bg-white/5'
                            : 'border-white/10 opacity-50'
                      }`}
                    >
                      <div className="font-medium">{formatDate(dateStr)}</div>
                      <div className="text-xs text-white/50">
                        {dayData?.session_count || 0} sessions
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selected Day Schedule */}
              {selectedDate && data.schedule[selectedDate] && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-white/50">
                    <span>
                      {data.schedule[selectedDate].subjects_covered?.length || 0} subject(s) •{' '}
                      {formatDuration(data.schedule[selectedDate].total_study_minutes || 0)} total
                    </span>
                    <span>
                      Capacity: {Math.round((data.schedule[selectedDate].capacity_used || 0) * 100)}%
                    </span>
                  </div>

                  {data.schedule[selectedDate].slots?.length > 0 ? (
                    <div className="space-y-2">
                      {data.schedule[selectedDate].slots.map((slot, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 ${
                            slot.is_break ? 'border-dashed opacity-50' : ''
                          }`}
                        >
                          <div className="flex w-24 flex-col items-center text-sm">
                            <span className="font-mono font-medium">{formatTime(slot.start_time)}</span>
                            <span className="text-xs text-white/50">to</span>
                            <span className="font-mono">{formatTime(slot.end_time)}</span>
                          </div>

                          <div className="h-10 w-px bg-white/10" />

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{slot.topic}</span>
                              <Badge className={TASK_TYPE_COLORS[slot.task_type] || ''}>
                                {slot.task_type?.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-sm text-white/60">{slot.subject}</div>
                          </div>

                          <div className="text-xs text-white/50">{slot.task_id}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-white/50">
                      No study sessions scheduled for this day
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle size={18} /> All Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.tasks?.slice(0, 20).map((task) => (
                  <div key={task.task_id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-sm">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        task.status === 'scheduled'
                          ? 'bg-green-500'
                          : task.status === 'completed'
                            ? 'bg-blue-500'
                            : 'bg-yellow-500'
                      }`}
                    />
                    <div className="flex-1">
                      <span className="font-medium">{task.topic}</span>
                      <span className="text-white/50"> • {task.subject}</span>
                    </div>
                    <Badge className={TASK_TYPE_COLORS[task.task_type] || ''}>{task.task_type}</Badge>
                    <div className="text-xs text-white/50">
                      {task.scheduled_date ? formatDate(task.scheduled_date) : 'Unscheduled'}
                    </div>
                    <div className="w-16 text-right text-xs text-white/50">
                      {formatDuration(task.required_minutes)}
                    </div>
                  </div>
                ))}
                {data.tasks?.length > 20 && (
                  <div className="text-center text-sm text-white/50">
                    ...and {data.tasks.length - 20} more tasks
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}