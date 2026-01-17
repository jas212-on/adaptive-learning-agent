import { cn } from '../../lib/cn'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-white/10 px-5 py-4 sm:px-6', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <div className={cn('text-base font-semibold text-white', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4 sm:px-6', className)} {...props} />
}
