import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Route, Network, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Breadcrumb } from '../../components/ui/Breadcrumb'
import { TopicSidebar } from '../../components/ui/TopicSidebar'
import { FloatingActionButton } from '../../components/ui/FloatingActionButton'
import { Tooltip, TooltipProvider, tooltipContent } from '../../components/ui/Tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as api from '../../services/api'
import RoadmapIndex from './topic/RoadmapIndex'
import { saveLastViewedPosition } from '../../services/api'

function levelVariant(level) {
  if (level === 'beginner') return 'success'
  if (level === 'intermediate') return 'primary'
  if (level === 'advanced') return 'warning'
  return 'neutral'
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, badge }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-white/60" />
          <span className="text-sm font-semibold text-white">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown size={18} className="text-white/40" />
        ) : (
          <ChevronRight size={18} className="text-white/40" />
        )}
      </button>
      {isOpen && <div className="border-t border-white/10 p-4">{children}</div>}
    </div>
  )
}

export default function TopicDetails() {
  const { topicId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showProgressOverlay, setShowProgressOverlay] = useState(false)

  // Get module and step from URL params
  const activeModule = searchParams.get('module')
  const activeStep = searchParams.get('step') || 'explainer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getTopic(topicId)
        if (!mounted) return
        setTopic(res)
        // Save last viewed position
        saveLastViewedPosition(topicId, { module: activeModule, step: activeStep })
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Failed to load topic')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [topicId])

  // Update URL when module/step changes
  const handleModuleChange = useCallback((moduleId, step) => {
    const params = new URLSearchParams(searchParams)
    if (moduleId) {
      params.set('module', moduleId)
      if (step) params.set('step', step)
    } else {
      params.delete('module')
      params.delete('step')
    }
    setSearchParams(params)
    saveLastViewedPosition(topicId, { module: moduleId, step })
  }, [searchParams, setSearchParams, topicId])

  const breadcrumbItems = useMemo(() => {
    const items = [
      { label: 'Topics', href: '/dashboard/topics' },
      { label: topic?.title || 'Loading...' },
    ]
    if (activeModule) {
      items.push({ label: activeModule.replace(/-/g, ' ') })
    }
    return items
  }, [topic, activeModule])

  const headerRight = useMemo(() => {
    if (!topic) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip content={tooltipContent.level[topic.level]}>
          <span>
            <Badge variant={levelVariant(topic.level)} className="cursor-help">
              {topic.level}
            </Badge>
          </span>
        </Tooltip>
        <Tooltip content={tooltipContent.confidence}>
          <span>
            <Badge className="cursor-help border border-white/10 bg-white/5 text-white/80">
              {topic.confidence === null || topic.confidence === undefined
                ? 'Confidence: —'
                : `${Math.round(topic.confidence * 100)}% confidence`}
            </Badge>
          </span>
        </Tooltip>
      </div>
    )
  }, [topic])

  const handleExportSummary = useCallback(() => {
    if (!topic) return
    const content = `# ${topic.title}\n\n${topic.summary || 'No summary available.'}\n\n## Tags\n${(topic.tags || []).join(', ')}`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${topic.id}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [topic])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Spinner /> Loading topic…
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-400">{error}</div>
          <div className="mt-4">
            <Link to="/dashboard/topics" className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white">
              <ArrowLeft size={16} /> Back to topics
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Breadcrumb Navigation */}
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {headerRight}
            <Link
              to={`/learn/${topicId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
            >
              Learning Mode
            </Link>
            <Link
              to={`/dashboard/dependency-graph?topic=${topicId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-400 transition hover:bg-indigo-500/20"
            >
              <Network size={16} />
              View Graph
            </Link>
          </div>
        </div>

        {/* Main Layout with Sidebar */}
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate">{topic.title}</CardTitle>
                  <div className="mt-1 text-sm font-light text-white/50">
                    View detected content and explore subtopics to master this topic.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(topic.tags || []).map((t) => (
                    <Badge key={t} className="border border-white/10 bg-white/5 text-white/70">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Section - Always visible at top */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-white/60">Summary</div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    {topic.summary ? (
                      <div className="text-sm text-white/80 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: (props) => <ul className="my-2 list-disc pl-5" {...props} />,
                            ol: (props) => <ol className="my-2 list-decimal pl-5" {...props} />,
                            li: (props) => <li className="my-1" {...props} />,
                            strong: (props) => <strong className="font-semibold text-white" {...props} />,
                            em: (props) => <em className="italic" {...props} />,
                            code: (props) => (
                              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-white/90" {...props} />
                            ),
                            pre: (props) => (
                              <pre className="overflow-auto rounded bg-white/10 p-3 font-mono text-[0.85em]" {...props} />
                            ),
                          }}
                        >
                          {topic.summary}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm font-light text-white/40">No summary yet — start detection and capture some content.</div>
                    )}
                  </div>
                </div>

                {/* Captured Snippets Section - Collapsible */}
                <CollapsibleSection
                  title="Captured Snippets"
                  icon={FileText}
                  defaultOpen={true}
                  badge={
                    <Badge className="border border-white/10 bg-white/5 text-white/60 text-xs">
                      {(topic.snippets || []).length} captured
                    </Badge>
                  }
                >
                  {(topic.snippets || []).length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(topic.snippets || []).map((s, idx) => (
                        <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-white">{s.where}</div>
                            <Badge className="border border-white/10 bg-white/5 text-white/70">{s.strength}</Badge>
                          </div>
                          <div className="mt-2 text-sm font-light text-white/60">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm font-light text-white/40">No snippets captured yet.</div>
                  )}
                </CollapsibleSection>

                {/* Roadmap Section - Collapsible */}
                <CollapsibleSection
                  title="Learning Roadmap"
                  icon={Route}
                  defaultOpen={true}
                >
                  <RoadmapIndex 
                    topic={topic} 
                    activeModule={activeModule}
                    activeStep={activeStep}
                    onModuleChange={handleModuleChange}
                  />
                </CollapsibleSection>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Sidebar - Hidden on mobile */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-4">
              <TopicSidebar topic={topic} />
            </div>
          </div>
        </div>

        {/* Floating Action Button */}
        <FloatingActionButton
          topicId={topicId}
          onViewProgress={() => setShowProgressOverlay(true)}
          onExportSummary={handleExportSummary}
        />
      </div>
    </TooltipProvider>
  )
}
