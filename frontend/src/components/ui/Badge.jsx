import { cn } from '../../lib/cn'

export function Badge({ className, variant = 'neutral', ...props }) {
  const variants = {
    neutral: 'bg-bg-muted text-fg',
    primary: 'bg-primary/15 text-fg',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
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
