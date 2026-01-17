import { cn } from '../../lib/cn'

export function Card({ className, ...props }) {
  return <div className={cn('card', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b px-5 py-4 sm:px-6', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <div className={cn('text-base font-semibold', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4 sm:px-6', className)} {...props} />
}
