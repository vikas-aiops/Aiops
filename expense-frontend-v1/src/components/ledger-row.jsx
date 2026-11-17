import { CategoryIcon, Money, StampMark } from '@/components/common';
import { useAppState } from '@/lib/app-state';
import { relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';

// One line in the ledger: icon, description, category · date, amount on the
// right in tabular figures. Used on the dashboard and on mobile Expenses.
export function LedgerRow({ expense, onClick, actions }) {
  const { stampId } = useAppState();
  const stamped = stampId === expense.id;
  const Comp = onClick ? 'button' : 'div';
  return (
    <li className={cn('relative', stamped && 'stamp-row animate-stamp-row')}>
      <Comp
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6',
          onClick && 'transition-colors hover:bg-paper-dim/60',
        )}
      >
        <CategoryIcon icon={expense.category.icon} color={expense.category.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{expense.description}</span>
          <span className="mt-0.5 block truncate text-xs text-paper-muted">
            {expense.category.name}
            <span aria-hidden="true"> · </span>
            <span className="figures">{relativeDay(expense.expenseDate)}</span>
          </span>
        </span>
        <Money value={expense.amount} className="text-right text-sm font-medium text-ink" />
        {actions}
      </Comp>
      {stamped && <StampMark />}
    </li>
  );
}
