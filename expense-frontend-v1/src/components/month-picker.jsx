import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppState } from '@/lib/app-state';
import { currentMonth, monthLabel, shiftMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MonthPicker({ className }) {
  const { month, setMonth } = useAppState();
  const isCurrent = month >= currentMonth();
  return (
    <div className={cn('inline-flex h-10 items-center rounded-control border border-ink-line bg-ink', className)}>
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, -1))}
        className="inline-flex h-full w-9 items-center justify-center rounded-l-control text-ink-muted transition-colors hover:bg-ink-hover hover:text-paper"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="figures min-w-[8.5rem] px-1 text-center text-sm text-paper" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, 1))}
        disabled={isCurrent}
        className="inline-flex h-full w-9 items-center justify-center rounded-r-control text-ink-muted transition-colors hover:bg-ink-hover hover:text-paper disabled:opacity-35 disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
