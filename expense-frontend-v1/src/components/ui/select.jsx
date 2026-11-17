import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// shadcn/ui Select, restyled. `tone` matches the surface it sits on.
export function Select({ value, onValueChange, options, label, tone = 'paper', className, id }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={label}
        className={cn(
          'inline-flex h-10 w-full items-center justify-between gap-2 rounded-control border px-3 text-sm transition-colors focus-visible:border-stamp-amber',
          tone === 'paper'
            ? 'border-paper-line bg-white text-ink hover:border-paper-muted/60'
            : 'border-ink-line bg-ink text-paper hover:border-ink-muted/60',
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown className={cn('size-4', tone === 'paper' ? 'text-paper-muted' : 'text-ink-muted')} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-ink-line bg-ink-raised p-1 text-paper shadow-float data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex h-9 cursor-pointer items-center rounded-[6px] pr-8 pl-3 text-sm outline-none select-none data-[highlighted]:bg-ink-hover data-[state=checked]:text-stamp-amber"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
