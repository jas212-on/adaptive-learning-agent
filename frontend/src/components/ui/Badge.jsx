import { cn } from '../../lib/cn'

export function Badge({ className, variant = 'neutral', ...props }) {
  const variants = {
    neutral: 'border border-white/10 bg-white/5 text-white/70',
    primary: 'border border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
    success: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    warning: 'border border-amber-500/30 bg-amber-500/15 text-amber-300',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
