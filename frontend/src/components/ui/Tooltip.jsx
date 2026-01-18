import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/cn'

export function TooltipProvider({ children, delayDuration = 300 }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export function Tooltip({ children, content, side = 'top', align = 'center', className }) {
  if (!content) return children

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={5}
          className={cn(
            'z-50 max-w-xs rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white/90 shadow-xl',
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2',
            'data-[side=top]:slide-in-from-bottom-2',
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-zinc-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

// Pre-defined tooltip content for common UI elements
export const tooltipContent = {
  confidence: (
    <div className="space-y-1">
      <div className="font-medium">Confidence Score</div>
      <div className="text-white/70">
        How certain the AI is about this topic detection. Higher scores mean clearer topic signals
        were found in your captured content.
      </div>
    </div>
  ),
  progress: (
    <div className="space-y-1">
      <div className="font-medium">Progress Calculation</div>
      <div className="text-white/70">
        Progress is calculated from: Explainer (33%), Resources (33%), and Quiz pass (34%). 
        Questions are optional and don't affect progress.
      </div>
    </div>
  ),
  optionalStep: (
    <div className="space-y-1">
      <div className="font-medium">Optional Step</div>
      <div className="text-white/70">
        This step helps reinforce learning but isn't required to complete the module. 
        Focus on required steps first.
      </div>
    </div>
  ),
  dependencyGraph: (
    <div className="space-y-1">
      <div className="font-medium">Dependency Graph</div>
      <div className="text-white/70">
        Shows how this topic connects to others. Learn prerequisites first for better understanding.
        Arrows point from foundational to advanced topics.
      </div>
    </div>
  ),
  level: {
    beginner: (
      <div className="space-y-1">
        <div className="font-medium">Beginner Level</div>
        <div className="text-white/70">
          Great for starting out. Content focuses on fundamentals and basic concepts.
        </div>
      </div>
    ),
    intermediate: (
      <div className="space-y-1">
        <div className="font-medium">Intermediate Level</div>
        <div className="text-white/70">
          Builds on basics. Includes practical applications and common patterns.
        </div>
      </div>
    ),
    advanced: (
      <div className="space-y-1">
        <div className="font-medium">Advanced Level</div>
        <div className="text-white/70">
          Deep dive into complex concepts. Best after mastering fundamentals.
        </div>
      </div>
    ),
  },
}

export default Tooltip
