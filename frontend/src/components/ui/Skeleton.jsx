import { cn } from '../../lib/cn'

/**
 * Shimmering placeholder for loading states.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <SkeletonText lines={3} />
 *   <SkeletonCard />
 */
export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('card card-pad space-y-4', className)} aria-hidden="true">
      <Skeleton className="h-5 w-1/[0.03]" />
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  )
}

export default Skeleton
