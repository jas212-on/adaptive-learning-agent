import { useMemo, useState, useEffect } from 'react'
import { BookOpen, CheckCircle2, Clock, ChevronDown, ChevronUp, Compass, HelpCircle, ListChecks } from 'lucide-react'
import { Badge } from './Badge'
import { Button } from './Button'
import { Tooltip, tooltipContent } from './Tooltip'
import { cn } from '../../lib/cn'

const STEPS = [
  { key: 'explainer', label: 'Explainer', icon: BookOpen, time: '5-10 min', required: true },
  { key: 'resources', label: 'Resources', icon: Compass, time: '10-15 min', required: true },
  { key: 'questions', label: 'Questions', icon: ListChecks, time: '5 min', required: false },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, time: '5-10 min', required: true },
]

/**
 * Module Overview panel showing all steps with completion status
 */
export function ModuleOverview({
  moduleId,
  moduleState,
  activeStep,
  onStepClick,
  sticky = false,
  className,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isSticky, setIsSticky] = useState(false)

  // Handle sticky behavior
  useEffect(() => {
    if (!sticky) return

    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sticky])

  const completedCount = useMemo(() => {
    return STEPS.filter((s) => s.required && moduleState?.[s.key]).length
  }, [moduleState])

  const requiredCount = STEPS.filter((s) => s.required).length
  const progressPct = (completedCount / requiredCount) * 100

  const firstIncomplete = useMemo(() => {
    return STEPS.find((s) => s.required && !moduleState?.[s.key])
  }, [moduleState])

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.03] transition-all',
        sticky && isSticky && 'sticky top-4 z-40 shadow-lg shadow-black/20',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-white">Module Overview</div>
          <Badge className="border border-white/10 bg-white/5 text-white/60">
            {completedCount}/{requiredCount} steps
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-24 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {isExpanded ? (
            <ChevronUp size={16} className="text-white/40" />
          ) : (
            <ChevronDown size={16} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4">
          {/* Steps Grid */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => {
              const isComplete = moduleState?.[step.key]
              const isActive = activeStep === step.key
              const Icon = step.icon

              return (
                <button
                  key={step.key}
                  onClick={() => onStepClick?.(step.key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition',
                    isActive
                      ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                      : isComplete
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                  )}
                >
                  {isComplete && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-2 text-emerald-400"
                    />
                  )}
                  <Icon size={20} />
                  <div className="text-xs font-medium">{step.label}</div>
                  <div className="flex items-center gap-1 text-[10px] text-white/40">
                    <Clock size={10} />
                    {step.time}
                    {!step.required && (
                      <Tooltip content={tooltipContent.optionalStep}>
                        <span className="ml-1 cursor-help text-white/30">(opt)</span>
                      </Tooltip>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Quick Action */}
          {firstIncomplete && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-white/50">
                Next: <span className="text-white/70">{firstIncomplete.label}</span>
              </div>
              <Button
                onClick={() => onStepClick?.(firstIncomplete.key)}
                className="rounded-lg bg-white px-3 py-1.5 text-xs text-black hover:bg-white/90"
              >
                Continue
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ModuleOverview
