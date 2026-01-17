import { cn } from '../../lib/cn'

export function Spinner({ className }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary',
        className,
      )}
      aria-label="Loading"
    />
  )
}
