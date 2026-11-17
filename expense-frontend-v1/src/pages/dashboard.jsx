import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, PiggyBank, Plus, ReceiptText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { CategoryIcon, EmptyState, ErrorState, Money, RowsSkeleton } from '@/components/common';
import { LedgerRow } from '@/components/ledger-row';
import { CHART, ChartTooltip, axisProps } from '@/components/charts';
import { api } from '@/lib/api';
import { useApi, useAppState } from '@/lib/app-state';
import { formatINRAxis, formatPct, monthBounds, monthName, shiftMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

export function useLoadSampleData() {
  const { invalidate } = useAppState();
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await api('/sample-data', { method: 'POST' });
      invalidate();
      toast.success('Sample data loaded', { description: `${r.expensesAdded} expenses across 3 months, with budgets.` });
    } catch (err) {
      toast.error(err.status === 409 ? 'Sample data not loaded' : 'Sample data could not be loaded', { description: err.message });
    } finally {
      setBusy(false);
    }
  }
  return { load, busy };
}

export function DashboardPage() {
  const { month, openNewExpense, openEditExpense } = useAppState();
  const summary = useApi(`/expenses/summary?month=${month}`);
  const detail = useApi(`/insights/month?month=${month}`);
  const sample = useLoadSampleData();
  const s = summary.data;

  // A brand-new account: one inviting empty state instead of five empty cards.
  if (s && s.recent.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={ReceiptText}
          title="No expenses this month"
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
          Add one, or load sample data to explore. Sample data adds about 3 months of realistic expenses and budgets.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 desk:gap-6">
      <HeroCard summary={summary} month={month} />
      <TrendCard detail={detail} month={month} />
      <CategoryCard summary={summary} month={month} />
      <BudgetsCard summary={summary} />
      <Card className="lg:col-span-12">
        <CardHeader
          title="Recent expenses"
          description="Your last 8 entries"
          action={
            <Button asChild variant="link-paper" size="sm">
              <Link to="/expenses">
                View all <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="pt-2 pb-2">
          {summary.error && !s ? (
            <ErrorState error={summary.error} onRetry={summary.reload} />
          ) : !s ? (
            <RowsSkeleton rows={6} className="px-5 sm:px-6" />
          ) : (
            <ul className="divide-y divide-paper-dim">
              {s.recent.map((e) => (
                <LedgerRow key={e.id} expense={e} onClick={() => openEditExpense(e)} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function HeroCard({ summary, month }) {
  const s = summary.data;
  const prevName = monthName(shiftMonth(month, -1));
  const up = s && s.delta > 0;
  return (
    <Card className="flex flex-col lg:col-span-5">
      <CardHeader title={`Spent in ${monthName(month)}`} titleAs="h2" />
      <CardBody className="flex flex-1 flex-col">
        {summary.error && !s ? (
          <ErrorState error={summary.error} onRetry={summary.reload} className="py-4" />
        ) : !s ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-6 h-2 w-full" />
          </div>
        ) : (
          <>
            <p className="font-display text-[2.5rem] leading-none font-semibold tracking-tight text-ink tabular-nums sm:text-3xl">
              <Money value={s.total} display />
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-paper-muted">
              {s.previousTotal > 0 ? (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium',
                      up ? 'bg-alert-coral/12 text-alert-coral-deep' : 'bg-ledger-green/12 text-ledger-green-deep',
                    )}
                  >
                    {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                    <span className="figures">{formatPct(Math.abs(s.deltaPct))}</span>
                  </span>
                  <span>
                    {up ? 'more' : 'less'} than {prevName} (<Money value={s.previousTotal} />)
                  </span>
                </>
              ) : (
                <span>Nothing recorded in {prevName} to compare with.</span>
              )}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-paper-dim pt-4 text-sm">
              <div>
                <dt className="text-paper-muted">Expenses recorded</dt>
                <dd className="figures mt-0.5 text-ink">{s.count}</dd>
              </div>
              <div>
                <dt className="text-paper-muted">Biggest category</dt>
                <dd className="mt-0.5 truncate text-ink">{s.byCategory[0]?.name ?? '–'}</dd>
              </div>
            </dl>
            <div className="mt-auto pt-6">
              {s.budget.usedPct !== null ? (
                <>
                  <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-paper-muted">Budget used</span>
                    <span className="text-ink">
                      <Money value={s.budget.spent} /> <span className="text-paper-muted">of</span> <Money value={s.budget.limit} />
                    </span>
                  </div>
                  <Progress value={s.budget.usedPct} label="Budget used this month" />
                  <p className="figures mt-1.5 text-right text-xs text-paper-muted">{formatPct(s.budget.usedPct)} used</p>
                </>
              ) : (
                <p className="text-sm text-paper-muted">
                  No budgets set for this month.{' '}
                  <Link to="/budgets" className="font-medium text-stamp-amber-deep hover:underline">
                    Set a budget
                  </Link>
                </p>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function TrendCard({ detail, month }) {
  const d = detail.data;
  const data = useMemo(() => {
    if (!d) return [];
    let cur = 0;
    let prev = 0;
    return d.daily.map((row) => {
      if (row.current !== null) cur += row.current;
      if (row.previous !== null) prev += row.previous;
      return {
        day: row.day,
        current: row.current === null || row.day > d.stats.elapsedDays ? null : cur,
        previous: row.previous === null ? null : prev,
      };
    });
  }, [d]);
  const prevName = monthName(shiftMonth(month, -1));
  const hasData = d && (d.total > 0 || d.daily.some((x) => x.previous));

  return (
    <Card className="lg:col-span-7">
      <CardHeader
        title="Spending trend"
        description={`Running total by day, ${monthName(month)} against ${prevName}`}
        action={
          <div className="hidden items-center gap-4 text-xs text-paper-muted sm:flex" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-pill bg-ink" /> {monthName(month)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-ink-muted" /> {prevName}
            </span>
          </div>
        }
      />
      <CardBody className="pt-2">
        {detail.error && !d ? (
          <ErrorState error={detail.error} onRetry={detail.reload} className="py-6" />
        ) : !d ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasData ? (
          <EmptyState title="No spending to chart yet">Expenses you add this month will draw the line here.</EmptyState>
        ) : (
          <div className="h-[220px]" role="img" aria-label={`Running total of spending by day in ${monthName(month)} compared with ${prevName}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
                <YAxis {...axisProps} width={52} tickFormatter={formatINRAxis} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(day) => `Day ${day}`} valueLabels={{ current: monthName(month), previous: prevName }} />}
                  cursor={{ stroke: CHART.muted, strokeDasharray: '3 3' }}
                />
                <Line type="monotone" dataKey="previous" stroke={CHART.muted} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke={CHART.ink}
                  strokeWidth={2.25}
                  fill={CHART.ink}
                  fillOpacity={0.07}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART.amber, stroke: CHART.ink, strokeWidth: 1.5 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function CategoryCard({ summary, month }) {
  const s = summary.data;
  const navigate = useNavigate();
  const { from, to } = monthBounds(month);
  const open = (categoryId) => navigate(`/expenses?categoryIds=${categoryId}&from=${from}&to=${to}`);

  return (
    <Card className="lg:col-span-7">
      <CardHeader title="By category" description="Select a category to see its expenses" />
      <CardBody>
        {summary.error && !s ? (
          <ErrorState error={summary.error} onRetry={summary.reload} className="py-6" />
        ) : !s ? (
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Skeleton className="size-[180px] rounded-pill" />
            <div className="w-full flex-1 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          </div>
        ) : s.byCategory.length === 0 ? (
          <EmptyState title={`No expenses in ${monthName(month)}`}>Pick another month, or add an expense to see the split.</EmptyState>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative size-[180px] shrink-0" role="img" aria-label="Spending by category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.byCategory}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={1.5}
                    stroke="#F7F5EF"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={(entry) => open(entry.categoryId ?? entry.payload?.categoryId)}
                    className="cursor-pointer"
                  >
                    {s.byCategory.map((c) => (
                      <Cell key={c.categoryId} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-paper-muted">{s.byCategory.length} categories</span>
                <span className="font-display text-base font-semibold text-ink">{formatINRAxis(s.total)}</span>
              </div>
            </div>
            <ul className="w-full min-w-0 flex-1 divide-y divide-paper-dim">
              {s.byCategory.slice(0, 7).map((c) => (
                <li key={c.categoryId}>
                  <button
                    type="button"
                    onClick={() => open(c.categoryId)}
                    className="flex w-full items-center gap-3 rounded-tick py-2 text-left transition-colors hover:bg-paper-dim/60"
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                    <span className="figures w-12 text-right text-xs text-paper-muted">{formatPct(c.pct)}</span>
                    <Money value={c.total} className="w-28 text-right text-sm text-ink" />
                  </button>
                </li>
              ))}
              {s.byCategory.length > 7 && (
                <li className="pt-2 text-xs text-paper-muted">+{s.byCategory.length - 7} more in the chart</li>
              )}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function BudgetsCard({ summary }) {
  const s = summary.data;
  const top = s?.budget.categories.slice(0, 4) ?? [];
  return (
    <Card className="lg:col-span-5">
      <CardHeader
        title="Budgets at a glance"
        description="Most used first"
        action={
          <Button asChild variant="link-paper" size="sm">
            <Link to="/budgets">
              Manage <ArrowRight />
            </Link>
          </Button>
        }
      />
      <CardBody>
        {summary.error && !s ? (
          <ErrorState error={summary.error} onRetry={summary.reload} className="py-6" />
        ) : !s ? (
          <div className="space-y-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : top.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No budgets this month"
            action={
              <Button asChild variant="secondary-paper" size="sm">
                <Link to="/budgets">Set a budget</Link>
              </Button>
            }
          >
            Set monthly limits to see how close you are.
          </EmptyState>
        ) : (
          <ul className="space-y-5">
            {top.map((b) => {
              const over = b.usedPct > 100;
              return (
                <li key={b.categoryId}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <CategoryIcon icon={b.icon} color={b.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{b.name}</span>
                    <span className={cn('figures text-xs', over ? 'font-semibold text-alert-coral-deep' : 'text-paper-muted')}>
                      {formatPct(b.usedPct)}
                    </span>
                  </div>
                  <Progress value={b.usedPct} label={`${b.name} budget used`} />
                  <p className="figures mt-1.5 text-right text-xs text-paper-muted">
                    {over ? (
                      <span className="text-alert-coral-deep">
                        <Money value={b.spent - b.limit} /> over <Money value={b.limit} />
                      </span>
                    ) : (
                      <>
                        <Money value={b.spent} /> of <Money value={b.limit} />
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
