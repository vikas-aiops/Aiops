import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { formatINR } from '@/lib/format';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/utils';

// ---- brand -----------------------------------------------------------------

export function Wordmark({ className, compact = false }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#F7F5EF" />
        <path d="M9 11h14M9 16h14M9 21h8" stroke="#10182B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="22.5" cy="21.5" r="4.5" fill="none" stroke="#E8873A" strokeWidth="2" />
      </svg>
      {!compact && <span className="font-display text-lg font-semibold tracking-tight text-paper">Expense</span>}
    </span>
  );
}

// ---- money: monospace, tabular, right-aligned by the caller ---------------

// display: hero numbers in Space Grotesk (tabular numerals); otherwise
// JetBrains Mono tabular figures for every amount.
export function Money({ value, className, signed = false, display = false }) {
  const text = formatINR(Math.abs(value));
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : value < 0 ? '−' : '';
  return (
    <span className={cn('whitespace-nowrap', display ? 'font-display tabular-nums' : 'figures', className)}>{sign + text}</span>
  );
}

// ---- categories --------------------------------------------------------------

export function CategoryIcon({ icon, color, size = 'md', className }) {
  const Icon = iconFor(icon);
  const box = { sm: 'size-7 rounded-[7px] [&_svg]:size-3.5', md: 'size-9 rounded-control [&_svg]:size-[18px]', lg: 'size-11 rounded-[10px] [&_svg]:size-5' }[size];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center text-white', box, className)}
      style={{ backgroundColor: color }}
    >
      <Icon strokeWidth={2} />
    </span>
  );
}

export function CategoryChip({ category, className }) {
  const Icon = iconFor(category.icon);
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 rounded-pill py-0.5 pr-2.5 pl-1 text-xs font-medium', className)}
      style={{ backgroundColor: `${category.color}1F`, color: 'var(--color-ink)' }}
    >
      <span className="inline-flex size-5 items-center justify-center rounded-pill text-white" style={{ backgroundColor: category.color }}>
        <Icon className="size-3" strokeWidth={2.25} />
      </span>
      <span className="truncate">{category.name}</span>
    </span>
  );
}

// ---- the stamp: one orchestrated moment when an expense is recorded --------

export function StampMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'stamp-mark pointer-events-none absolute top-1/2 right-[7.5rem] z-10 hidden h-9 items-center rounded-[6px] border-2 border-stamp-amber px-2.5 font-display text-sm font-bold tracking-wide text-stamp-amber-deep sm:inline-flex',
        'animate-stamp-mark bg-paper/80',
        className,
      )}
    >
      Recorded
    </span>
  );
}

// ---- states: skeleton, empty, error ----------------------------------------

export function EmptyState({ icon: Icon, title, children, action, tone = 'paper', className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {Icon && (
        <span
          className={cn(
            'mb-4 inline-flex size-12 items-center justify-center rounded-pill',
            tone === 'paper' ? 'bg-paper-dim text-paper-muted' : 'bg-ink-line text-ink-muted',
          )}
        >
          <Icon className="size-6" />
        </span>
      )}
      <p className={cn('font-medium', tone === 'paper' ? 'text-ink' : 'text-paper')}>{title}</p>
      {children && <p className={cn('mt-1 max-w-sm text-sm', tone === 'paper' ? 'text-paper-muted' : 'text-ink-muted')}>{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, tone = 'paper', className, title = "This couldn't be loaded" }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span
        className={cn(
          'mb-4 inline-flex size-12 items-center justify-center rounded-pill',
          tone === 'paper' ? 'bg-alert-coral/12 text-alert-coral-deep' : 'bg-alert-coral/15 text-alert-coral',
        )}
      >
        <AlertTriangle className="size-6" />
      </span>
      <p className={cn('font-medium', tone === 'paper' ? 'text-ink' : 'text-paper')}>{title}</p>
      <p className={cn('mt-1 max-w-sm text-sm', tone === 'paper' ? 'text-paper-muted' : 'text-ink-muted')}>
        {error?.message || 'The server did not respond. Check your connection and try again.'}
      </p>
      {onRetry && (
        <Button variant={tone === 'paper' ? 'secondary-paper' : 'secondary'} size="sm" className="mt-5" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}

export function RowsSkeleton({ rows = 5, className }) {
  return (
    <div className={cn('divide-y divide-paper-dim', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---- page heading inside content --------------------------------------------

export function SectionTitle({ children, className }) {
  return <h2 className={cn('text-base font-semibold text-paper', className)}>{children}</h2>;
}
