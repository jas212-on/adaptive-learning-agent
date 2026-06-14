import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Plus, LogIn, Copy, CheckCircle2, Trophy, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import * as api from '../../services/api'

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  // Leaderboard & detail state
  const [selectedClassroom, setSelectedClassroom] = useState(null)
  const [classroomDetail, setClassroomDetail] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)

  async function loadClassrooms() {
    setLoading(true)
    try {
      const res = await api.listClassrooms()
      setClassrooms(res.classrooms || [])
    } catch {
      setClassrooms([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClassrooms()
  }, [])

  async function handleCreate() {
    if (!createName.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await api.createClassroom({ name: createName.trim(), description: createDesc.trim() })
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      loadClassrooms()
    } catch (err) {
      setError(err?.message || 'Failed to create classroom')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setActionLoading(true)
    setError(null)
    try {
      await api.joinClassroom(joinCode.trim())
      setShowJoin(false)
      setJoinCode('')
      loadClassrooms()
    } catch (err) {
      setError(err?.message || 'Failed to join classroom')
    } finally {
      setActionLoading(false)
    }
  }

  async function viewClassroom(id) {
    setSelectedClassroom(id)
    try {
      const [detail, lb] = await Promise.all([
        api.getClassroom(id),
        api.getLeaderboard(id),
      ])
      setClassroomDetail(detail)
      setLeaderboard(lb)
    } catch {
      // best-effort
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">Collaborative</p>
          <h1 className="mt-1 text-[26px] font-extralight tracking-tight text-white/90">Classrooms</h1>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setShowJoin(true); setShowCreate(false) }}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] text-white/60 hover:bg-white/[0.05] text-[12px]"
          >
            <LogIn size={13} className="mr-1.5" />
            Join
          </Button>
          <Button
            onClick={() => { setShowCreate(true); setShowJoin(false) }}
            className="rounded-xl bg-indigo-500/80 text-white hover:bg-indigo-500 text-[12px]"
          >
            <Plus size={13} className="mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
          <input
            type="text"
            placeholder="Classroom name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={actionLoading || !createName.trim()}
              className="rounded-lg bg-indigo-500 text-white text-sm">
              Create
            </Button>
            <Button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] text-white/50 text-sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
          <input
            type="text"
            placeholder="Enter join code (e.g. ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm text-white font-mono placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <div className="flex gap-2">
            <Button onClick={handleJoin} disabled={actionLoading || joinCode.length < 4}
              className="rounded-lg bg-indigo-500 text-white text-sm">
              Join
            </Button>
            <Button onClick={() => setShowJoin(false)}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] text-white/50 text-sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Classroom list */}
      {classrooms?.length === 0 && !showCreate && !showJoin ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
          <Users size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/50">No classrooms yet.</p>
          <p className="text-xs text-white/30 mt-1">Create one to share roadmaps or join with a code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classrooms?.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 cursor-pointer hover:bg-white/[0.04] transition"
              onClick={() => viewClassroom(c.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{c.name}</div>
                  {c.description && <div className="text-xs text-white/40 mt-0.5">{c.description}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30">{c.memberCount || 0} members</span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
                    c.role === 'instructor' ? 'border-indigo-500/30 text-indigo-400' : 'border-white/[0.07] text-white/40'
                  }`}>
                    {c.role}
                  </span>
                  {c.join_code && (
                    <button
                      onClick={(e) => { e.stopPropagation(); copyCode(c.join_code) }}
                      className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60"
                    >
                      {copiedCode === c.join_code ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {c.join_code}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Classroom detail + leaderboard */}
      {selectedClassroom && classroomDetail && (
        <div className="space-y-4">
          <h2 className="text-lg font-light text-white/80">
            {classroomDetail.classroom?.name}
          </h2>

          {/* Members */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-widest text-white/25 mb-2">
              Members ({classroomDetail.members?.length || 0})
            </h3>
            <div className="space-y-1">
              {classroomDetail.members?.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{m.user_id.slice(0, 8)}...</span>
                  <span className="text-[10px] text-white/30">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          {leaderboard?.entries?.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-widest text-white/25 mb-2 flex items-center gap-1">
                <Trophy size={12} className="text-amber-400" />
                Leaderboard (Week of {leaderboard.weekStart})
              </h3>
              <div className="space-y-2">
                {leaderboard.entries.map((e, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      e.isYou ? 'border border-indigo-500/30 bg-indigo-500/10' : 'bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 font-mono w-6">#{e.rank}</span>
                      <span className="text-white/70">{e.isYou ? 'You' : `Student ${e.rank}`}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span>{e.avgScore}% avg</span>
                      <span>{e.quizzesCompleted} quizzes</span>
                      <span>{e.streakDays}d streak</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared roadmaps */}
          {classroomDetail.roadmaps?.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-widest text-white/25 mb-2 flex items-center gap-1">
                <Share2 size={12} />
                Shared Roadmaps
              </h3>
              <div className="space-y-2">
                {classroomDetail.roadmaps.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/60">{r.title}</span>
                    <span className="text-xs text-white/30">{r.subtopics?.length || 0} subtopics</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
