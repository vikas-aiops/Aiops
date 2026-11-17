import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, ReceiptText, Search, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { CategoryChip, CategoryIcon, EmptyState, ErrorState, Money, StampMark } from '@/components/common';
import { LedgerRow } from '@/components/ledger-row';
import { useLoadSampleData } from '@/pages/dashboard';
import { api, qs } from '@/lib/api';
import { useApi, useAppState } from '@/lib/app-state';
import { formatDate, formatNumber, weekday } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
const SORTS = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'amount:desc', label: 'Highest amount' },
  { value: 'amount:asc', label: 'Lowest amount' },
];
const FILTER_KEYS = ['q', 'categoryIds', 'from', 'to', 'minAmount', 'maxAmount'];

export function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const { openEditExpense, openNewExpense, invalidate, stampId } = useAppState();
  const categories = useApi('/categories');
  const sample = useLoadSampleData();

  const filters = {
    q: params.get('q') ?? '',
    categoryIds: (params.get('categoryIds') ?? '').split(',').filter(Boolean).map(Number),
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    minAmount: params.get('minAmount') ?? '',
    maxAmount: params.get('maxAmount') ?? '',
    sort: params.get('sort') ?? 'date',
    order: params.get('order') ?? 'desc',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
  const path = `/expenses${qs({ ...filters, limit: PAGE_SIZE })}`;
  const list = useApi(path);
  const active = FILTER_KEYS.filter((k) => (Array.isArray(filters[k]) ? filters[k].length : filters[k])).length;

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Search: local input, debounced into the URL.
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return undefined;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const [showFilters, setShowFilters] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api(`/expenses/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Expense deleted');
      setToDelete(null);
      invalidate();
    } catch (err) {
      toast.error('Expense not deleted', { description: err.message });
    } finally {
      setDeleting(false);
    }
  }

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const firstRow = data && data.total > 0 ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = data ? Math.min(filters.page * PAGE_SIZE, data.total) : 0;

  return (
    <div className="space-y-4">
      {/* Filters bar, on ink */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            type="search"
            placeholder="Search descriptions"
            aria-label="Search expenses by description"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="flex-1 sm:flex-none">
            <SlidersHorizontal /> Filters
            {active > 0 && (
              <span className="figures inline-flex size-5 items-center justify-center rounded-pill bg-stamp-amber text-xs text-ink">{active}</span>
            )}
          </Button>
          <Select
            tone="ink"
            label="Sort expenses"
            className="w-44"
            value={`${filters.sort}:${filters.order}`}
            onValueChange={(v) => {
              const [sort, order] = v.split(':');
              update({ sort: sort === 'date' && order === 'desc' ? '' : sort, order: sort === 'date' && order === 'desc' ? '' : order });
            }}
            options={SORTS}
          />
        </div>
      </div>

      {showFilters && (
        <FilterPanel
          filters={filters}
          categories={categories.data?.items ?? []}
          onChange={update}
          onClear={() => {
            setQ('');
            setParams(new URLSearchParams(), { replace: true });
          }}
        />
      )}

      {active > 0 && !showFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>Filtered:</span>
          {filters.categoryIds.length > 0 && (
            <FilterTag onRemove={() => update({ categoryIds: [] })}>
              {filters.categoryIds.length === 1
                ? (categories.data?.items.find((c) => c.id === filters.categoryIds[0])?.name ?? '1 category')
                : `${filters.categoryIds.length} categories`}
            </FilterTag>
          )}
          {(filters.from || filters.to) && (
            <FilterTag onRemove={() => update({ from: '', to: '' })}>
              {filters.from ? formatDate(filters.from, { year: true }) : 'Any date'} – {filters.to ? formatDate(filters.to, { year: true }) : 'today'}
            </FilterTag>
          )}
          {(filters.minAmount || filters.maxAmount) && (
            <FilterTag onRemove={() => update({ minAmount: '', maxAmount: '' })}>
              ₹{filters.minAmount || '0'} – {filters.maxAmount ? `₹${filters.maxAmount}` : 'any'}
            </FilterTag>
          )}
          {filters.q && <FilterTag onRemove={() => { setQ(''); update({ q: '' }); }}>“{filters.q}”</FilterTag>}
        </div>
      )}

      <Card className="overflow-hidden">
        {list.error && !data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.total === 0 ? (
          active > 0 ? (
            <EmptyState
              icon={Search}
              title="No expenses match these filters"
              action={
                <Button variant="secondary-paper" onClick={() => { setQ(''); setParams(new URLSearchParams(), { replace: true }); }}>
                  Clear filters
                </Button>
              }
            >
              Try a wider date range, fewer categories or a different search.
            </EmptyState>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="Your ledger is empty"
              action={
                <>
                  <Button onClick={openNewExpense}>
                    <Plus /> Add expense
                  </Button>
                  <Button variant="secondary-paper" onClick={sample.load} disabled={sample.busy}>
                    <Sparkles /> {sample.busy ? 'Loading sample data…' : 'Load sample data'}
                  </Button>
                </>
              }
            >
              Add your first expense, or load sample data to explore.
            </EmptyState>
          )
        ) : (
          <>
            {/* Desktop and tablet: the ledger table. Scrolls inside its own container if narrow. */}
            <div className="scrollbar-thin hidden overflow-x-auto desk:block">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Expenses</caption>
                <thead>
                  <tr className="border-b border-paper-line text-left text-xs text-paper-muted">
                    <th scope="col" className="w-36 py-3 pl-6 font-medium">Date</th>
                    <th scope="col" className="py-3 font-medium">Description</th>
                    <th scope="col" className="w-48 py-3 font-medium">Category</th>
                    <th scope="col" className="w-40 py-3 pr-4 text-right font-medium">Amount</th>
                    <th scope="col" className="w-24 py-3 pr-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e, i) => (
                    <tr
                      key={e.id}
                      className={cn(
                        'group relative border-b border-paper-dim transition-colors last:border-b-0 hover:bg-paper-dim/60',
                        i % 2 === 1 && 'bg-paper-dim/35',
                        stampId === e.id && 'stamp-row animate-stamp-row',
                      )}
                    >
                      <td className="figures py-3 pl-6 text-paper-muted">
                        <span className="text-ink">{formatDate(e.expenseDate)}</span> <span className="text-xs">{weekday(e.expenseDate)}</span>
                        {stampId === e.id && <StampMark className="right-[14rem]" />}
                      </td>
                      <td className="max-w-0 py-3 pr-4">
                        <span className="block truncate font-medium text-ink">{e.description}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <CategoryChip category={e.category} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <Money value={e.amount} className="font-medium text-ink" />
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex justify-end gap-1 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <Button variant="ghost-paper" size="icon-sm" onClick={() => openEditExpense(e)} aria-label={`Edit ${e.description}`}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost-paper"
                            size="icon-sm"
                            className="hover:text-alert-coral-deep"
                            onClick={() => setToDelete(e)}
                            aria-label={`Delete ${e.description}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink/80 bg-paper-dim/50">
                    <td colSpan={3} className="py-3.5 pl-6 text-sm text-paper-muted">
                      Total of <span className="figures text-ink">{formatNumber(data.total)}</span> {data.total === 1 ? 'expense' : 'expenses'}
                      {active > 0 && ' matching filters'}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <Money value={data.sum} className="font-semibold text-ink" />
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: stacked ledger rows, amount on the right */}
            <div className="desk:hidden">
              <ul className="divide-y divide-paper-dim">
                {data.items.map((e) => (
                  <LedgerRow key={e.id} expense={e} onClick={() => openEditExpense(e)} />
                ))}
              </ul>
              <div className="flex items-center justify-between border-t-2 border-ink/80 bg-paper-dim/50 px-5 py-3.5 text-sm">
                <span className="text-paper-muted">
                  Total of <span className="figures text-ink">{formatNumber(data.total)}</span>
                </span>
                <Money value={data.sum} className="font-semibold text-ink" />
              </div>
            </div>
          </>
        )}
      </Card>

      {data && data.total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          <span className="figures whitespace-nowrap">
            {formatNumber(firstRow)}–{formatNumber(lastRow)}
            <span className="hidden sm:inline"> of {formatNumber(data.total)}</span>
          </span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              <ChevronLeft /> Previous
            </Button>
            <span className="figures px-1 text-paper">
              {filters.page} / {pages}
            </span>
            <Button variant="secondary" size="sm" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>
              Next <ChevronRight />
            </Button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this expense?"
        description={toDelete ? `“${toDelete.description}” will be removed from your ledger. This can't be undone.` : ''}
        confirmLabel="Delete expense"
        onConfirm={confirmDelete}
        busy={deleting}
      />
    </div>
  );
}

function FilterTag({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-ink-line bg-ink-raised py-1 pr-1 pl-3 text-paper">
      {children}
      <button type="button" onClick={onRemove} className="rounded-pill p-0.5 text-ink-muted hover:text-paper" aria-label="Remove filter">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function FilterPanel({ filters, categories, onChange, onClear }) {
  const selected = new Set(filters.categoryIds);
  const label =
    selected.size === 0 ? 'All categories' : selected.size === 1 ? categories.find((c) => selected.has(c.id))?.name : `${selected.size} categories`;
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ categoryIds: [...next] });
  };

  // Amount inputs: local state committed on blur / Enter, so typing doesn't refetch per keystroke.
  const [amounts, setAmounts] = useState({ minAmount: filters.minAmount, maxAmount: filters.maxAmount });
  useEffect(() => setAmounts({ minAmount: filters.minAmount, maxAmount: filters.maxAmount }), [filters.minAmount, filters.maxAmount]);
  const commit = () => onChange(amounts);

  return (
    <div className="grid grid-cols-1 gap-4 rounded-card border border-ink-line bg-ink-raised p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
      <div className="space-y-1.5">
        <Label className="text-ink-muted">Categories</Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-full items-center justify-between gap-2 rounded-control border border-ink-line bg-ink px-3 text-left text-sm text-paper hover:border-ink-muted/60"
            >
              <span className="truncate">{label}</span>
              <ChevronDown className="size-4 text-ink-muted" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="scrollbar-thin max-h-80 w-64 overflow-y-auto">
            <ul role="listbox" aria-multiselectable="true" aria-label="Categories">
              {categories.map((c) => {
                const on = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(c.id)}
                      className="flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-sm hover:bg-ink-hover"
                    >
                      <span
                        className={cn(
                          'inline-flex size-4 items-center justify-center rounded-tick border',
                          on ? 'border-stamp-amber bg-stamp-amber text-ink' : 'border-ink-muted',
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-6" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-from" className="text-ink-muted">From</Label>
        <Input id="f-from" type="date" className="figures" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-to" className="text-ink-muted">To</Label>
        <Input id="f-to" type="date" className="figures" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-min" className="text-ink-muted">Min amount (₹)</Label>
        <Input
          id="f-min"
          inputMode="decimal"
          placeholder="0"
          className="figures"
          value={amounts.minAmount}
          onChange={(e) => setAmounts((a) => ({ ...a, minAmount: e.target.value.replace(/[^\d.]/g, '') }))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-max" className="text-ink-muted">Max amount (₹)</Label>
        <Input
          id="f-max"
          inputMode="decimal"
          placeholder="Any"
          className="figures"
          value={amounts.maxAmount}
          onChange={(e) => setAmounts((a) => ({ ...a, maxAmount: e.target.value.replace(/[^\d.]/g, '') }))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </div>
      <Button variant="ghost" onClick={onClear} className="justify-self-start">
        Clear filters
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading expenses" className="divide-y divide-paper-dim">
      <div className="flex gap-6 px-6 py-3.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-3.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-5 w-28 rounded-pill sm:block" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
