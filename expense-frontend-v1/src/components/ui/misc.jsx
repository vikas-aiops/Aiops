import { Popover as PopoverPrimitive } from 'radix-ui';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';

// Skeleton: a calm, slowly pulsing block in the surface's own dim tone.
export function Skeleton({ className, tone = 'paper' }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control', tone === 'paper' ? 'bg-paper-dim' : 'bg-ink-line/70', className)}
    />
  );
}

// Progress bar: green < 80%, amber 80-100%, coral > 100%.
export function budgetTone(pct) {
  if (pct === null || pct === undefined) return 'none';
  if (pct > 100) return 'over';
  if (pct >= 80) return 'near';
  return 'under';
}
const barColors = { under: 'bg-ledger-green', near: 'bg-stamp-amber', over: 'bg-alert-coral', none: 'bg-paper-muted/40' };

export function Progress({ value, tone, className, label, track = 'paper' }) {
  const t = tone || budgetTone(value);
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value ?? 0)}
      className={cn('h-2 w-full overflow-hidden rounded-pill', track === 'paper' ? 'bg-paper-dim' : 'bg-ink-line', className)}
    >
      <div className={cn('h-full rounded-pill transition-[width] duration-500', barColors[t])} style={{ width: `${width}%` }} />
    </div>
  );
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({ className, align = 'start', ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 rounded-control border border-ink-line bg-ink-raised p-2 text-paper shadow-float data-[state=open]:animate-[fade-in_120ms_ease-out]',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// Toasts on raised ink, sentence-case messages that echo the action.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={20}
      mobileOffset={{ bottom: 88, left: 16, right: 16 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-card border border-ink-line bg-ink-raised px-4 py-3 text-sm text-paper shadow-float sm:w-[356px]',
          title: 'font-medium',
          description: 'text-ink-muted',
          icon: 'text-stamp-amber',
          success: '[&_[data-icon]]:text-ledger-green',
          error: '[&_[data-icon]]:text-alert-coral',
          actionButton: 'ml-auto rounded-control bg-stamp-amber px-3 py-1.5 text-xs font-medium text-ink',
        },
      }}
    />
  );
}
