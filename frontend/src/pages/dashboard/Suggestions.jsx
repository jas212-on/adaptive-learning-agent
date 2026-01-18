import { useEffect, useState } from 'react'
import { 
  Sparkles, 
  RefreshCw, 
  ArrowUp, 
  ArrowRight, 
  ArrowUpRight,
  Lightbulb,
  BookOpen,
  GraduationCap,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

function getPriorityIcon(priority) {
  switch (priority) {
    case 'high':
      return <ArrowUp size={14} className="text-red-400" />
    case 'medium':
      return <ArrowRight size={14} className="text-amber-400" />
    case 'low':
      return <ArrowUpRight size={14} className="text-emerald-400" />
    default:
      return <ArrowRight size={14} className="text-white/40" />
  }
}

function getPriorityVariant(priority) {
  switch (priority) {
    case 'high':
      return 'warning'
    case 'medium':
      return 'primary'
    case 'low':
      return 'success'
    default:
      return 'neutral'
  }
}

function getCategoryIcon(category) {
  switch (category) {
    case 'prerequisite':
      return <BookOpen size={14} />
    case 'parallel':
      return <Lightbulb size={14} />
    case 'advanced':
      return <GraduationCap size={14} />
    default:
      return <Lightbulb size={14} />
  }
}

function getCategoryLabel(category) {
  switch (category) {
    case 'prerequisite':
      return 'Learn First'
    case 'parallel':
      return 'Learn Alongside'
    case 'advanced':
      return 'Advanced'
    default:
      return category
  }
}

function SuggestionCard({ suggestion }) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {getPriorityIcon(suggestion.priority)}
            <span className="font-semibold text-white truncate">{suggestion.title}</span>
          </div>
          <p className="mt-2 text-sm font-light text-white/60 leading-relaxed">
            {suggestion.reason}
          </p>
        </div>
      </div>
      
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={getPriorityVariant(suggestion.priority)} className="text-xs">
          {suggestion.priority} priority
        </Badge>
        <Badge className="border border-white/10 bg-white/5 text-white/70 text-xs flex items-center gap-1">
          {getCategoryIcon(suggestion.category)}
          {getCategoryLabel(suggestion.category)}
        </Badge>
      </div>
      
      {suggestion.relatedTo && suggestion.relatedTo.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-white/40 mb-1">Related to:</div>
          <div className="flex flex-wrap gap-1">
            {suggestion.relatedTo.map((topic, idx) => (
              <span key={idx} className="text-xs text-white/50 bg-white/5 rounded px-1.5 py-0.5">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Suggestions() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function loadSuggestions(force = false) {
    if (force) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    
    try {
      const res = await api.getSuggestions(force)
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to load suggestions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSuggestions()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Spinner /> Generating AI suggestions based on your topics…
      </div>
    )
  }

  if (error && !data) {
    return <div className="text-sm text-red-400">{error}</div>
  }

  const suggestions = data?.suggestions || []
  const basedOnTopics = data?.basedOnTopics || []
  const hasError = data?.error

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" /> 
            AI-Powered Suggestions
          </CardTitle>
          <Button
            variant="secondary"
            className="rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            onClick={() => loadSuggestions(true)}
            disabled={refreshing}
          >
            {refreshing ? <Spinner /> : <RefreshCw size={16} />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasError && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertCircle size={16} />
              {hasError}
            </div>
          )}
          
          {basedOnTopics.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-white/40 mb-2">Based on your detected topics:</div>
              <div className="flex flex-wrap gap-1.5">
                {basedOnTopics.map((topic, idx) => (
                  <Badge key={idx} className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm font-light text-white/50">
            The AI suggests connected topics and what to learn next based on your current learning path.
          </div>

          {suggestions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {suggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
              <Sparkles size={32} className="mx-auto text-white/20 mb-3" />
              <p className="text-sm text-white/40">
                No suggestions yet. Start detecting topics to get personalized recommendations.
              </p>
            </div>
          )}

          {data?.generatedAt && (
            <div className="text-xs text-white/30 text-right">
              Generated: {new Date(data.generatedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
