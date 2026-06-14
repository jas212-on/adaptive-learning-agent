import { useState, useMemo } from 'react'
import {
  CalendarDays, Wand2, Plus, Trash2, AlertTriangle, CheckCircle,
  Clock, BookOpen, Settings, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

function formatTime(t) { return t ? t.slice(0, 5) : '' }
function formatDuration(m) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function getTodayISO() { return new Date().toISOString().split('T')[0] }
function addDays(d, n) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date.toISOString().split('T')[0]
}

const EVENT_COLORS = {
  exam:       'bg-red-500/15 text-red-400 border-red-500/20',
  assignment: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  deadline:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  lecture:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  lab:        'bg-violet-500/15 text-violet-400 border-violet-500/20',
}
const TASK_COLORS = {
  initial_learning: 'bg-indigo-500/15 text-indigo-300',
  revision:         'bg-emerald-500/15 text-emerald-300',
  practice:         'bg-amber-500/15 text-amber-300',
  exam_prep:        'bg-red-500/15 text-red-300',
}

const DEFAULT_EVENT = { event_type: 'exam', subject: '', topic: '', target_date: addDays(getTodayISO(), 7), priority_level: 7, estimated_effort_hours: 5 }
const DEFAULT_TOPIC = { subject: '', topic: '', difficulty_score: 0.5, confidence_score: 0.5, estimated_hours: 2, is_concept_heavy: false }

function StyledSelect({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`rounded-lg border border-white/[0.08] bg-[#111] px-2.5 py-2 text-xs text-white/80 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition ${className}`}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function StyledInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`rounded-lg border border-white/[0.08] bg-[#111] px-2.5 py-2 text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition ${className}`}
    />
  )
}

function Section({ label, icon: Icon, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        className={`flex w-full items-center justify-between ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-white/30">
          {Icon && <Icon size={11} />}
          {label}
        </div>
        {collapsible && (open ? <ChevronUp size={12} className="text-white/25" /> : <ChevronDown size={12} className="text-white/25" />)}
      </button>
      {(!collapsible || open) && <div className="mt-3">{children}</div>}
    </div>
  )
}

export default function Timetable() {
  const [events, setEvents] = useState([{ ...DEFAULT_EVENT, id: 'event_1' }])
  const [topics, setTopics] = useState([])
  const [availability, setAvailability] = useState({ weekdayHours: 4, weekendHours: 6, startTime: '09:00', endTime: '21:00' })
  const [preferences, setPreferences] = useState({ sessionLengthMinutes: 45, breakLengthMinutes: 15, maxSessionsPerDay: 6, maxSubjectsPerDay: 3 })
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [eventCounter, setEventCounter] = useState(2)
  const [topicCounter, setTopicCounter] = useState(1)

  function addEvent() { setEvents(e => [...e, { ...DEFAULT_EVENT, id: `event_${eventCounter}`, target_date: addDays(getTodayISO(), 7 + e.length) }]); setEventCounter(c => c + 1) }
  function removeEvent(id) { setEvents(e => e.filter(x => x.id !== id)) }
  function updateEvent(id, field, value) { setEvents(e => e.map(x => x.id === id ? { ...x, [field]: value } : x)) }

  function addTopic() { setTopics(t => [...t, { ...DEFAULT_TOPIC, id: `topic_${topicCounter}` }]); setTopicCounter(c => c + 1) }
  function removeTopic(id) { setTopics(t => t.filter(x => x.id !== id)) }
  function updateTopic(id, field, value) { setTopics(t => t.map(x => x.id === id ? { ...x, [field]: value } : x)) }

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await api.generateTimetable({
        events: events.filter(e => e.subject && e.target_date),
        availability, preferences,
        topics: topics.filter(t => t.subject && t.topic),
      })
      if (res.success) {
        setData(res.data)
        const first = Object.keys(res.data.schedule).find(d => res.data.schedule[d].slots?.length > 0)
        setSelectedDate(first || null)
      } else { setError(res.message || 'Failed to generate') }
    } catch (err) { setError(err?.message || 'Failed to generate') }
    finally { setLoading(false) }
  }

  async function loadSample() {
    setLoading(true); setError(null)
    try {
      const res = await api.getSampleTimetable()
      if (res.success) {
        setData(res.data)
        const first = Object.keys(res.data.schedule).find(d => res.data.schedule[d].slots?.length > 0)
        setSelectedDate(first || null)
      }
    } catch (err) { setError(err?.message || 'Failed to load sample') }
    finally { setLoading(false) }
  }

  const sortedDates = useMemo(() => data?.schedule ? Object.keys(data.schedule).sort() : [], [data])
  const stats = useMemo(() => !data ? null : ({
    totalTasks: data.metadata?.total_tasks || 0,
    scheduledTasks: data.metadata?.scheduled_tasks || 0,
    totalEvents: data.metadata?.total_events || 0,
    warningsCount: data.warnings?.length || 0,
  }), [data])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">Planning</p>
        <h1 className="mt-1 text-[26px] font-extralight tracking-tight text-white/90">Study Timetable</h1>
      </div>

      {/* Config panel */}
      <div className="space-y-6 rounded-xl border border-white/[0.07] bg-white/[0.01] p-6">
        {/* Events */}
        <Section label="Fixed Events" icon={CalendarDays}>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <StyledSelect
                  value={ev.event_type}
                  onChange={e => updateEvent(ev.id, 'event_type', e.target.value)}
                  options={[
                    { value: 'exam', label: 'Exam' },
                    { value: 'assignment', label: 'Assignment' },
                    { value: 'deadline', label: 'Deadline' },
                    { value: 'lecture', label: 'Lecture' },
                    { value: 'lab', label: 'Lab' },
                  ]}
                  className="w-28"
                />
                <StyledInput placeholder="Subject" value={ev.subject} onChange={e => updateEvent(ev.id, 'subject', e.target.value)} className="w-28" />
                <StyledInput placeholder="Topic (optional)" value={ev.topic} onChange={e => updateEvent(ev.id, 'topic', e.target.value)} className="w-36" />
                <StyledInput type="date" value={ev.target_date} onChange={e => updateEvent(ev.id, 'target_date', e.target.value)} className="w-34" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Pri</span>
                  <StyledInput type="number" min={1} max={10} value={ev.priority_level} onChange={e => updateEvent(ev.id, 'priority_level', parseInt(e.target.value) || 5)} className="w-12 text-center" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">h</span>
                  <StyledInput type="number" min={0.5} step={0.5} value={ev.estimated_effort_hours} onChange={e => updateEvent(ev.id, 'estimated_effort_hours', parseFloat(e.target.value) || 1)} className="w-14 text-center" />
                </div>
                <button onClick={() => removeEvent(ev.id)} className="ml-auto rounded-lg p-1.5 text-white/25 transition hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button onClick={addEvent} className="inline-flex items-center gap-1.5 text-xs font-light text-white/40 transition hover:text-white/60">
              <Plus size={12} /> Add Event
            </button>
          </div>
        </Section>

        <div className="border-t border-white/[0.05]" />

        {/* Topics */}
        <Section label={`Learning Topics (${topics.length})`} icon={BookOpen} collapsible defaultOpen={false}>
          <div className="space-y-2">
            {topics.map(t => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <StyledInput placeholder="Subject" value={t.subject} onChange={e => updateTopic(t.id, 'subject', e.target.value)} className="w-28" />
                <StyledInput placeholder="Topic" value={t.topic} onChange={e => updateTopic(t.id, 'topic', e.target.value)} className="w-36" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Difficulty</span>
                  <StyledInput type="number" min={0} max={1} step={0.1} value={t.difficulty_score} onChange={e => updateTopic(t.id, 'difficulty_score', parseFloat(e.target.value) || 0.5)} className="w-14 text-center" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Hours</span>
                  <StyledInput type="number" min={0.5} step={0.5} value={t.estimated_hours} onChange={e => updateTopic(t.id, 'estimated_hours', parseFloat(e.target.value) || 2)} className="w-14 text-center" />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white/40">
                  <input type="checkbox" checked={t.is_concept_heavy} onChange={e => updateTopic(t.id, 'is_concept_heavy', e.target.checked)} className="rounded accent-indigo-500" />
                  Needs revision
                </label>
                <button onClick={() => removeTopic(t.id)} className="ml-auto rounded-lg p-1.5 text-white/25 transition hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button onClick={addTopic} className="inline-flex items-center gap-1.5 text-xs font-light text-white/40 transition hover:text-white/60">
              <Plus size={12} /> Add Topic
            </button>
          </div>
        </Section>

        <div className="border-t border-white/[0.05]" />

        {/* Settings */}
        <Section label="Availability & Preferences" icon={Settings} collapsible defaultOpen={false}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/20">Availability</div>
              {[
                { label: 'Weekday hours', field: 'weekdayHours', min: 0, max: 16 },
                { label: 'Weekend hours', field: 'weekendHours', min: 0, max: 16 },
              ].map(({ label, field, min, max }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{label}</span>
                  <StyledInput type="number" min={min} max={max} value={availability[field]} onChange={e => setAvailability(a => ({ ...a, [field]: parseFloat(e.target.value) || 4 }))} className="w-16 text-center" />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Start time</span>
                <StyledInput type="time" value={availability.startTime} onChange={e => setAvailability(a => ({ ...a, startTime: e.target.value }))} className="w-24" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">End time</span>
                <StyledInput type="time" value={availability.endTime} onChange={e => setAvailability(a => ({ ...a, endTime: e.target.value }))} className="w-24" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/20">Session Settings</div>
              {[
                { label: 'Session length (min)', field: 'sessionLengthMinutes', min: 15, max: 120 },
                { label: 'Break length (min)', field: 'breakLengthMinutes', min: 0, max: 60 },
                { label: 'Max sessions/day', field: 'maxSessionsPerDay', min: 1, max: 12 },
                { label: 'Max subjects/day', field: 'maxSubjectsPerDay', min: 1, max: 6 },
              ].map(({ label, field, min, max }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{label}</span>
                  <StyledInput type="number" min={min} max={max} value={preferences[field]} onChange={e => setPreferences(p => ({ ...p, [field]: parseInt(e.target.value) || min }))} className="w-16 text-center" />
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? <Spinner className="h-4 w-4 border-black/30 border-t-black" /> : <Wand2 size={15} />}
            Generate
          </button>
          <button
            onClick={loadSample}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-light text-white/60 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <Zap size={14} />
            Load Sample
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-400">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Total Tasks', value: stats.totalTasks, color: 'text-white' },
              { label: 'Scheduled', value: stats.scheduledTasks, color: 'text-emerald-400' },
              { label: 'Events', value: stats.totalEvents, color: 'text-white' },
              { label: 'Warnings', value: stats.warningsCount, color: stats.warningsCount > 0 ? 'text-amber-400' : 'text-white' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
                <div className={`text-2xl font-light ${s.color}`}>{s.value}</div>
                <div className="mt-0.5 text-[10px] font-light text-white/30">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {data.warnings?.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-amber-400">
                <AlertTriangle size={12} /> Scheduling Warnings
              </div>
              <div className="space-y-2">
                {data.warnings.map((w, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${w.severity === 'critical' ? 'border-red-500/20 bg-red-500/[0.08] text-red-300' : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300'}`}>
                    {w.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar */}
          <div>
            <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-white/25">Generated Schedule</div>

            {/* Date strip */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {sortedDates.map(d => {
                const day = data.schedule[d]
                const hasSessions = day?.slots?.length > 0
                const isSelected = selectedDate === d
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                      isSelected
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                        : hasSessions
                          ? 'border-white/[0.08] text-white/60 hover:border-white/[0.15] hover:bg-white/[0.04]'
                          : 'border-white/[0.04] text-white/20'
                    }`}
                  >
                    <div className="font-medium">{formatDate(d)}</div>
                    <div className="text-[10px] opacity-60">{day?.session_count || 0} sessions</div>
                  </button>
                )
              })}
            </div>

            {/* Day schedule */}
            {selectedDate && data.schedule[selectedDate] && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
                  <span className="text-xs font-medium text-white/60">{formatDate(selectedDate)}</span>
                  <span className="text-xs text-white/30">
                    {data.schedule[selectedDate].subjects_covered?.length || 0} subject(s) ·{' '}
                    {formatDuration(data.schedule[selectedDate].total_study_minutes || 0)} ·{' '}
                    {Math.round((data.schedule[selectedDate].capacity_used || 0) * 100)}% capacity
                  </span>
                </div>

                {data.schedule[selectedDate].slots?.length > 0 ? (
                  <div className="divide-y divide-white/[0.03]">
                    {data.schedule[selectedDate].slots.map((slot, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 px-5 py-3.5 ${slot.is_break ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}
                      >
                        <div className="w-20 flex-shrink-0 font-mono text-xs text-white/40">
                          {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                        </div>
                        <div className="h-8 w-px flex-shrink-0 bg-white/[0.06]" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white">{slot.topic}</span>
                          {slot.subject && <span className="ml-2 text-xs text-white/35">{slot.subject}</span>}
                        </div>
                        {slot.task_type && (
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${TASK_COLORS[slot.task_type] || 'text-white/50'}`}>
                            {slot.task_type.replace('_', ' ')}
                          </span>
                        )}
                        <div className="text-[10px] text-white/25 flex-shrink-0">{slot.task_id}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-white/30">No sessions for this day</div>
                )}
              </div>
            )}
          </div>

          {/* Tasks list */}
          {data.tasks?.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-white/25">All Tasks</div>
              <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-hidden">
                {data.tasks.slice(0, 25).map(task => (
                  <div key={task.task_id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]">
                    <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${task.status === 'scheduled' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-medium text-white">{task.topic}</span>
                      <span className="ml-2 text-white/35">{task.subject}</span>
                    </div>
                    {task.task_type && (
                      <span className={`rounded-md px-2 py-0.5 text-[10px] ${TASK_COLORS[task.task_type] || ''}`}>
                        {task.task_type}
                      </span>
                    )}
                    <span className="text-xs text-white/30 flex-shrink-0">
                      {task.scheduled_date ? formatDate(task.scheduled_date) : 'Unscheduled'}
                    </span>
                    <span className="w-14 text-right text-xs text-white/25 flex-shrink-0">
                      {formatDuration(task.required_minutes)}
                    </span>
                  </div>
                ))}
                {data.tasks.length > 25 && (
                  <div className="px-5 py-3 text-center text-xs text-white/30">
                    +{data.tasks.length - 25} more tasks
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
