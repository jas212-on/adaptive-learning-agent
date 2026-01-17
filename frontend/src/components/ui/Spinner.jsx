import { cn } from '../../lib/cn'

export function Spinner({ className }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white',
        className,
      )}
      aria-label="Loading"
    />
  )
}
