import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Accordion({ children, type = 'single', collapsible = true, defaultValue, className }) {
  return (
    <AccordionPrimitive.Root
      type={type}
      collapsible={collapsible}
      defaultValue={defaultValue}
      className={cn('space-y-2', className)}
    >
      {children}
    </AccordionPrimitive.Root>
  )
}

export function AccordionItem({ children, value, className }) {
  return (
    <AccordionPrimitive.Item
      value={value}
      className={cn(
        'overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]',
        className
      )}
    >
      {children}
    </AccordionPrimitive.Item>
  )
}

export function AccordionTrigger({ children, className }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-white transition',
          'hover:bg-white/[0.03]',
          '[&[data-state=open]>svg]:rotate-180',
          className
        )}
      >
        {children}
        <ChevronDown
          size={16}
          className="shrink-0 text-white/40 transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({ children, className }) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden text-sm',
        'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        className
      )}
    >
      <div className="border-t border-white/10 p-4">{children}</div>
    </AccordionPrimitive.Content>
  )
}

export default Accordion
