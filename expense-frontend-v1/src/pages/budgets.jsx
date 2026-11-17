import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton, budgetTone } from '@/components/ui/misc';
import { CategoryIcon, ErrorState, Money } from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useAppState } from '@/lib/app-state';
import { formatPct, monthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS = {
  under: { label: 'On track', className: 'bg-ledger-green/12 text-ledger-green-deep' },
  near: { label: 'Close to limit', className: 'bg-stamp-amber/15 text-stamp-amber-deep' },
  over: { label: 'Over budget', className: 'bg-alert-coral/12 text-alert-coral-deep' },
};

export function BudgetsPage() {
  const { month } = useAppState();
  const budgets = useApi(`/budgets?month=${month}`);
  const d = budgets.data;

  if (budgets.error && !d) {
    return (
      <Card>
        <ErrorState error={budgets.error} onRetry={budgets.reload} />
      </Card>
    );
  }

  const set = d?.items.filter((i) => i.limit !== null) ?? [];
  const unset = d?.items.filter((i) => i.limit === null) ?? [];
  const overCount = set.filter((i) => i.usedPct > 100).length;
  const remaining = d ? d.totals.limit - d.totals.spentInBudgeted : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 desk:gap-6">
      <Card className="lg:col-span-12">
        <CardHeader title={`${monthLabel(month)} budget`} description="Limits you set, against what you've spent in those categories" />
        <CardBody>
          {!d ? (
            <div className="grid gap-6 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : set.length === 0 ? (
            <p className="text-sm text-paper-muted">No limits yet for this month. Set one for any category below.</p>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-paper-muted">Total budget</dt>
                  <dd className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                    <Money value={d.totals.limit} className="font-display" />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-paper-muted">Spent</dt>
                  <dd className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                    <Money value={d.totals.spentInBudgeted} className="font-display" />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-paper-muted">{remaining >= 0 ? 'Left to spend' : 'Over by'}</dt>
                  <dd
                    className={cn(
                      'mt-1 font-display text-xl font-semibold sm:text-2xl',
                      remaining >= 0 ? 'text-ledger-green-deep' : 'text-alert-coral-deep',
                    )}
                  >
                    <Money value={Math.abs(remaining)} className="font-display" />
                  </dd>
                </div>
              </dl>
              <Progress value={d.totals.usedPct} className="mt-6 h-2.5" label="Total budget used" />
              <p className="mt-2 flex justify-between text-xs text-paper-muted">
                <span className="figures">{formatPct(d.totals.usedPct)} used</span>
                <span>
                  {overCount > 0 ? `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over budget` : 'Every category is within its limit'}
                </span>
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-12">
        <CardHeader title="By category" description="Select a limit to change it. Green is under 80%, amber 80–100%, coral over." />
        <div className="pt-3 pb-2">
          {!d ? (
            <div className="space-y-4 px-5 pb-4 sm:px-6">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-paper-dim">
              {[...[...set].sort((a, b) => b.usedPct - a.usedPct), ...unset].map((item) => (
                <BudgetRow key={item.categoryId} item={item} month={month} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function BudgetRow({ item, month }) {
  const { invalidate } = useAppState();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.limit ? String(item.limit) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const tone = budgetTone(item.usedPct);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const n = Number(value);
    if (!value || !Number.isFinite(n) || n <= 0) {
      setError('Budget must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await api(`/budgets/${item.categoryId}?month=${month}`, { method: 'PUT', body: { amount: n } });
      toast.success(item.limit ? 'Budget updated' : 'Budget set', { description: `${item.name}: ₹${n.toLocaleString('en-IN')} for the month` });
      setEditing(false);
      setError('');
      invalidate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CategoryIcon icon={item.icon} color={item.color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{item.name}</span>
            {item.limit !== null && STATUS[tone] && (
              <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', STATUS[tone].className)}>{STATUS[tone].label}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-paper-muted">
            <Money value={item.spent} /> spent
            {item.limit !== null && (
              <>
                {' '}
                · <span className="figures">{formatPct(item.usedPct)}</span> of limit
              </>
            )}
          </p>
        </div>

        {editing ? (
          <form
            className="flex w-full items-start gap-2 sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="flex-1 sm:w-40 sm:flex-none">
              <div
                className={cn(
                  'flex h-9 items-center rounded-control border bg-white px-2.5 focus-within:border-stamp-amber',
                  error ? 'border-alert-coral-deep' : 'border-paper-line',
                )}
              >
                <span className="text-sm text-paper-muted">₹</span>
                <input
                  ref={inputRef}
                  inputMode="decimal"
                  aria-label={`Monthly limit for ${item.name}`}
                  aria-invalid={Boolean(error)}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value.replace(/[^\d.]/g, ''));
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                  className="figures w-full min-w-0 bg-transparent pl-1.5 text-right text-sm text-ink outline-none focus-visible:outline-none"
                />
              </div>
              {error && <p className="mt-1 text-xs text-alert-coral-deep">{error}</p>}
            </div>
            <Button type="submit" size="sm" disabled={saving} className="h-9">
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost-paper" className="h-9" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : item.limit !== null ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-center gap-2 rounded-control px-2 py-1 text-right hover:bg-paper-dim"
            aria-label={`Change ${item.name} limit, currently ₹${item.limit}`}
          >
            <span>
              <span className="block text-xs text-paper-muted">Limit</span>
              <Money value={item.limit} className="text-sm font-medium text-ink" />
            </span>
            <Pencil className="size-3.5 text-paper-muted group-hover:text-ink" />
          </button>
        ) : (
          <Button variant="secondary-paper" size="sm" onClick={() => setEditing(true)}>
            Set limit
          </Button>
        )}
      </div>
      {item.limit !== null && <Progress value={item.usedPct} className="mt-3" label={`${item.name} budget used`} />}
    </li>
  );
}
