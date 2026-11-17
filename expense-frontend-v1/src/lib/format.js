// Indian rupees with Indian digit grouping: ₹1,23,456.50
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-IN');

export const formatINR = (value) => inr.format(Number(value) || 0);
export const formatINRWhole = (value) => inrWhole.format(Math.round(Number(value) || 0));
export const formatNumber = (value) => number.format(value);

// Chart axes: short Indian units (₹12k, ₹1.2L).
export function formatINRAxis(value) {
  const v = Math.abs(value);
  if (v >= 1e7) return `₹${trim(value / 1e7)}Cr`;
  if (v >= 1e5) return `₹${trim(value / 1e5)}L`;
  if (v >= 1e3) return `₹${trim(value / 1e3)}k`;
  return `₹${Math.round(value)}`;
}
const trim = (n) => (Math.abs(n) >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ''));

export function formatPct(value, { signed = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  const s = `${Math.abs(value) >= 10 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1).replace(/\.0$/, '')}%`;
  if (!signed) return s;
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

// ---- dates: always 'YYYY-MM-DD' strings, never JS Date timezones -----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
export const currentMonth = () => todayIso().slice(0, 7);

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, days: last };
}
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function monthShort(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}
export const monthName = (month) => MONTHS[Number(month.slice(5, 7)) - 1];

export function formatDate(iso, { year = 'auto' } = {}) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const showYear = year === true || (year === 'auto' && String(y) !== todayIso().slice(0, 4));
  return `${d} ${MONTHS[m - 1].slice(0, 3)}${showYear ? ` ${y}` : ''}`;
}
export function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export function relativeDay(iso) {
  const today = todayIso();
  if (iso === today) return 'Today';
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (iso === yesterday) return 'Yesterday';
  return formatDate(iso);
}
