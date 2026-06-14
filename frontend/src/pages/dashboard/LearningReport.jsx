import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Skeleton } from '../../components/ui/Skeleton'
import { Button } from '../../components/ui/Button'
import * as api from '../../services/api'

function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400'
  if (s >= 45) return 'text-amber-400'
  return 'text-red-400/80'
}

export default function LearningReport() {
  const [report, setReport] = useState(null)
  const [studyStats, setStudyStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [r, s] = await Promise.all([api.getLearningReport(), api.getStudyStats(30)])
        setReport(r)
        setStudyStats(s)
      } catch (err) {
        setError(err?.message || 'Failed to load report')
      } finally { setLoading(false) }
    }
    load()
  }, [])

  function downloadJson() {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `learning-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-10 w-64 rounded" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-5 text-[13px] text-red-400/80">
      {error}
    </div>
  )

  if (!report) return null

  const hasQuizHistory = report.quizHistory?.length > 0
  const hasMastery = report.mastery?.length > 0

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">30-day</p>
          <h1 className="mt-1.5 text-[38px] font-extralight tracking-tight text-white/88">Learning Report</h1>
        </div>
        <Button
          onClick={downloadJson}
          className="mb-1.5 flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-transparent text-[11px] text-white/30 hover:bg-white/[0.04] hover:text-white/55"
        >
          <Download size={11} />
          Export JSON
        </Button>
      </div>

      {/* Headline stats — no boxes, just numbers */}
      <div className="mb-14 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {[
          { v: report.topicsCount ?? 0, l: 'topics studied' },
          { v: report.quizzesCompleted ?? 0, l: 'quizzes done' },
          { v: `${report.avgScore ?? 0}%`, l: 'avg score', color: scoreColor(report.avgScore ?? 0) },
          { v: `${Math.round(report.totalStudyMinutes ?? 0)}m`, l: 'study time' },
        ].map(({ v, l, color }) => (
          <div key={l}>
            <div className={`text-[36px] font-extralight leading-none ${color || 'text-white/82'}`}>{v}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/22">{l}</div>
          </div>
        ))}
      </div>

      {/* Streak — inline, no box */}
      {report.streak && (
        <div className="mb-12">
          <p className="mb-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Streak</p>
          <div className="flex items-center gap-8">
            {[
              { v: report.streak.currentStreak || 0, l: 'current' },
              { v: report.streak.longestStreak || 0, l: 'longest' },
              { v: report.streak.totalDaysStudied || 0, l: 'total days' },
            ].map(({ v, l }) => (
              <div key={l}>
                <span className="text-[28px] font-extralight text-white/65">{v}</span>
                <span className="ml-1.5 text-[11px] text-white/25">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mastery breakdown */}
      {hasMastery && (
        <div className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Mastery</p>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          <div>
            {report.mastery.slice(0, 15).map((m, i) => {
              const pct = Math.round(m.mastery * 100)
              return (
                <div key={i} className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white/62">
                      {m.topicId}
                      <span className="mx-1.5 text-white/20">/</span>
                      <span className="text-white/38">{m.subtopicId}</span>
                    </p>
                  </div>
                  <div className="w-20 shrink-0">
                    <div className="h-[2px] rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          pct >= 75 ? 'bg-emerald-400/50' : pct >= 40 ? 'bg-amber-400/45' : 'bg-red-400/40'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] text-white/30">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quiz history */}
      {hasQuizHistory && (
        <div className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Quiz History</p>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          <div>
            {report.quizHistory.slice(0, 20).map((q, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-4 py-3 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white/58">{q.topicId}</p>
                  <p className="truncate text-[11px] text-white/28">{q.subtopicId}</p>
                </div>
                <span className={`shrink-0 text-[14px] font-semibold ${scoreColor(q.scorePct)}`}>
                  {q.scorePct}%
                </span>
                <span className="shrink-0 text-[10.5px] text-white/22">
                  {q.correctCount}/{q.total}
                </span>
                <span className="shrink-0 text-[10px] text-white/18">
                  {new Date(q.submittedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Study time breakdown */}
      {studyStats && (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Time by Activity</p>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              {Object.entries(studyStats.byActivity || {}).map(([act, mins]) => (
                <div key={act} className="flex items-center justify-between border-b border-white/[0.04] py-2.5">
                  <span className="text-[12px] capitalize text-white/45">{act}</span>
                  <span className="text-[12px] text-white/30">{mins}m</span>
                </div>
              ))}
            </div>
            <div>
              {Object.entries(studyStats.byTopic || {}).slice(0, 8).map(([tid, mins]) => (
                <div key={tid} className="flex items-center justify-between border-b border-white/[0.04] py-2.5">
                  <span className="truncate mr-4 text-[12px] text-white/45">{tid}</span>
                  <span className="shrink-0 text-[12px] text-white/30">{mins}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
