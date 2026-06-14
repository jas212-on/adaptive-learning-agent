import { cn } from '../../lib/cn'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.07] bg-white/[0.015]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-white/[0.06] px-5 py-4', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <div className={cn('text-sm font-medium text-white/80', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}
