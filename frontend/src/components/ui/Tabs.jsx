import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

export function Tabs({ children, defaultValue, value, onValueChange, className }) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col', className)}
    >
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabsList({ children, className }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  )
}

export function TabsTrigger({ children, value, className, disabled }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
        'text-white/50 hover:text-white/70',
        'data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
        className
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export function TabsContent({ children, value, className, forceMount }) {
  return (
    <TabsPrimitive.Content
      value={value}
      forceMount={forceMount}
      className={cn(
        'mt-4 outline-none',
        'data-[state=inactive]:hidden',
        'focus-visible:ring-2 focus-visible:ring-white/20',
        className
      )}
    >
      {children}
    </TabsPrimitive.Content>
  )
}

export default Tabs
