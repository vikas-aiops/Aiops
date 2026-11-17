import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, LineChart as LineChartIcon, TrendingUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { CategoryIcon, EmptyState, ErrorState, Money, RowsSkeleton } from '@/components/common';
import { CHART, ChartTooltip, axisProps } from '@/components/charts';
import { useApi, useAppState } from '@/lib/app-state';
import { formatDate, formatINRAxis, monthLabel, monthName, monthShort, shiftMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

export function InsightsPage() {
  const { month } = useAppState();
  const trend = useApi(`/insights/trend?months=6&month=${month}`);
  const detail = useApi(`/insights/month?month=${month}`);
  const d = detail.data;
  const prevName = monthName(shiftMonth(month, -1));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 desk:gap-6">
      {/* Stat tiles */}
      <StatTile
        className="lg:col-span-4"
        icon={TrendingUp}
        label="Average daily spend"
        loading={!d && !detail.error}
        error={detail.error && !d ? detail : null}
        value={d && <Money value={d.stats.averageDaily} className="font-display" />}
        note={d && `Over ${d.stats.elapsedDays} ${d.stats.elapsedDays === 1 ? 'day' : 'days'} of ${monthName(month)}`}
      />
      <StatTile
        className="lg:col-span-4"
        icon={CalendarDays}
        label="Highest-spending weekday"
        loading={!d && !detail.error}
        error={detail.error && !d ? detail : null}
        value={d && (d.stats.highestWeekday ?? 'None yet')}
        note={
          d &&
          (d.stats.highestWeekday ? (
            <>
              <Money value={d.stats.weekdays.find((w) => w.name === d.stats.highestWeekday).total} /> spent on{' '}
              {d.stats.highestWeekday}s this month
            </>
          ) : (
            'No spending recorded this month'
          ))
        }
      >
        {d?.stats.highestWeekday && <WeekdayBars weekdays={d.stats.weekdays} highest={d.stats.highestWeekday} />}
      </StatTile>
      <StatTile
        className="lg:col-span-4"
        icon={LineChartIcon}
        label={`Total for ${monthName(month)}`}
        loading={!d && !detail.error}
        error={detail.error && !d ? detail : null}
        value={d && <Money value={d.total} className="font-display" />}
        note={
          d &&
          (d.top[0] ? (
            <>
              Largest: {d.top[0].description}, <Money value={d.top[0].amount} />
            </>
          ) : (
            'No expenses yet'
          ))
        }
      />

      {/* Monthly totals */}
      <Card className="lg:col-span-7">
        <CardHeader title="Monthly totals" description={`The 6 months to ${monthLabel(month)}`} />
        <CardBody className="pt-2">
          {trend.error && !trend.data ? (
            <ErrorState error={trend.error} onRetry={trend.reload} className="py-6" />
          ) : !trend.data ? (
            <Skeleton className="h-[260px]" />
          ) : trend.data.months.every((m) => m.total === 0) ? (
            <EmptyState title="Nothing to compare yet">Monthly totals appear once you've recorded some expenses.</EmptyState>
          ) : (
            <div className="h-[260px]" role="img" aria-label="Bar chart of monthly spending totals for the last 6 months">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.data.months} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="month" {...axisProps} tickFormatter={monthShort} />
                  <YAxis {...axisProps} width={52} tickFormatter={formatINRAxis} />
                  <Tooltip content={<ChartTooltip labelFormatter={monthLabel} valueLabels={{ total: 'Spent' }} />} cursor={{ fill: 'rgb(16 24 43 / 0.05)' }} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                    {trend.data.months.map((m) => (
                      <Cell key={m.month} fill={m.month === month ? CHART.amber : CHART.ink} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Top 5 */}
      <Card className="lg:col-span-5">
        <CardHeader title="Largest expenses" description={`Top 5 in ${monthName(month)}`} />
        <div className="pt-2 pb-2">
          {detail.error && !d ? (
            <ErrorState error={detail.error} onRetry={detail.reload} className="py-6" />
          ) : !d ? (
            <RowsSkeleton rows={5} className="px-5 sm:px-6" />
          ) : d.top.length === 0 ? (
            <EmptyState title={`No expenses in ${monthName(month)}`}>Pick another month to see its largest expenses.</EmptyState>
          ) : (
            <ol className="divide-y divide-paper-dim">
              {d.top.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="figures w-4 text-xs text-paper-muted">{i + 1}</span>
                  <CategoryIcon icon={e.category.icon} color={e.category.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{e.description}</span>
                    <span className="figures block text-xs text-paper-muted">{formatDate(e.expenseDate)}</span>
                  </span>
                  <Money value={e.amount} className="text-right text-sm font-medium text-ink" />
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      {/* Category comparison */}
      <Card className="lg:col-span-12">
        <CardHeader title="Category comparison" description={`${monthName(month)} against ${prevName}`} />
        <CardBody className="pt-2">
          {detail.error && !d ? (
            <ErrorState error={detail.error} onRetry={detail.reload} className="py-6" />
          ) : !d ? (
            <Skeleton className="h-[300px]" />
          ) : d.categories.length === 0 ? (
            <EmptyState title="Nothing to compare">No expenses in either month yet.</EmptyState>
          ) : (
            <CategoryComparison rows={d.categories} month={month} prevName={prevName} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CategoryComparison({ rows, month, prevName }) {
  const height = Math.max(220, rows.length * 44 + 40);
  return (
    <>
      <div style={{ height }} role="img" aria-label={`Spending per category in ${monthName(month)} compared with ${prevName}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis type="number" {...axisProps} tickFormatter={formatINRAxis} />
            <YAxis
              type="category"
              dataKey="name"
              {...axisProps}
              tick={{ ...axisProps.tick, fill: CHART.ink, fontFamily: 'var(--font-sans)' }}
              width={104}
            />
            <Tooltip
              content={<ChartTooltip valueLabels={{ current: monthName(month), previous: prevName }} />}
              cursor={{ fill: 'rgb(16 24 43 / 0.05)' }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span className="text-xs text-paper-muted">{v === 'current' ? monthName(month) : prevName}</span>}
            />
            <Bar dataKey="current" fill={CHART.ink} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="previous" fill={CHART.muted} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-paper-dim pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const diff = r.current - r.previous;
          return (
            <li key={r.categoryId} className="flex items-center gap-2 text-sm">
              <CategoryIcon icon={r.icon} color={r.color} size="sm" className="size-6" />
              <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
              <Money
                value={diff}
                signed
                className={cn('text-xs', diff > 0 ? 'text-alert-coral-deep' : diff < 0 ? 'text-ledger-green-deep' : 'text-paper-muted')}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function StatTile({ icon: Icon, label, value, note, loading, error, className, children }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="flex items-center gap-2 text-sm text-paper-muted">
        <Icon className="size-4" /> {label}
      </div>
      {error ? (
        <ErrorState error={error.error} onRetry={error.reload} className="py-4" />
      ) : loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{value}</p>
          <p className="mt-1 text-sm text-paper-muted">{note}</p>
          {children}
        </>
      )}
    </Card>
  );
}

function WeekdayBars({ weekdays, highest }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...weekdays.map((w) => w.total), 1);
  return (
    <div className="mt-4 flex h-12 items-end gap-1.5" aria-hidden="true">
      {order.map((i) => {
        const w = weekdays[i];
        return (
          <div key={w.name} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn('w-full rounded-t-[3px]', w.name === highest ? 'bg-stamp-amber' : 'bg-ink/80')}
              style={{ height: `${Math.max(4, (w.total / max) * 32)}px` }}
            />
            <span className="text-xs leading-none text-paper-muted">{w.name.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}
