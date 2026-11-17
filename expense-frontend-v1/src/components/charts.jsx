import { formatINR } from '@/lib/format';

// Recharts themed with the Ledger tokens: ink marks on paper, amber for the
// highlight, tabular numerals on every axis, INR in every tooltip.
export const CHART = {
  ink: '#10182B',
  inkSoft: '#3A4566',
  amber: '#E8873A',
  muted: '#8891A8',
  grid: '#E3DECF',
  axis: '#6B6355',
  green: '#1F9D6B',
  coral: '#E15251',
};

export const axisProps = {
  tick: { fill: CHART.axis, fontSize: 12, fontFamily: 'var(--font-mono)', style: { fontVariantNumeric: 'tabular-nums' } },
  tickLine: false,
  axisLine: false,
};

export function ChartTooltip({ active, payload, label, labelFormatter, valueLabels = {} }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-ink-line bg-ink-raised px-3 py-2 text-xs text-paper shadow-float">
      {label !== undefined && <p className="mb-1.5 font-medium text-ink-muted">{labelFormatter ? labelFormatter(label) : label}</p>}
      <ul className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <li key={p.dataKey ?? p.name} className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-pill" style={{ backgroundColor: p.payload?.fill || p.color || p.stroke }} />
                {valueLabels[p.dataKey] ?? p.name}
              </span>
              <span className="figures ml-auto">{formatINR(p.value)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
