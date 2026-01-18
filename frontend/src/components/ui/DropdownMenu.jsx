import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/cn'

export function DropdownMenu({ children }) {
  return <DropdownMenuPrimitive.Root>{children}</DropdownMenuPrimitive.Root>
}

export function DropdownMenuTrigger({ children, asChild = true }) {
  return (
    <DropdownMenuPrimitive.Trigger asChild={asChild}>
      {children}
    </DropdownMenuPrimitive.Trigger>
  )
}

export function DropdownMenuContent({ children, className, align = 'end', sideOffset = 5 }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl',
          'animate-in fade-in-0 zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2',
          'data-[side=top]:slide-in-from-bottom-2',
          className
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ children, className, onSelect, disabled }) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 outline-none transition',
        'hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

export function DropdownMenuSeparator({ className }) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-white/10', className)}
    />
  )
}

export function DropdownMenuLabel({ children, className }) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-3 py-1.5 text-xs font-medium text-white/50', className)}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  )
}

export default DropdownMenu
