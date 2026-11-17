'use strict';

const express = require('express');
const { timedQuery } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/errors');
const { z, monthParam, monthRange, shiftMonth, currentMonth, todayIso } = require('../lib/validation');

const router = express.Router();

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Monthly totals for the last N months, ending with ?month= (default: this month).
router.get('/api/insights/trend', requireAuth, async (req, res) => {
  const { months, month } = validate(
    z.object({
      months: z.coerce
        .number()
        .int('months must be a whole number')
        .min(1, 'months must be between 1 and 24')
        .max(24, 'months must be between 1 and 24')
        .default(6),
      month: monthParam,
    }),
    req.query,
  );
  const first = shiftMonth(month, -(months - 1));
  const rows = await timedQuery({ operation: 'select', table: 'expenses' }, `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses
      WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
      GROUP BY DATE_FORMAT(expense_date, '%Y-%m')`,
    [req.user.id, `${first}-01`, monthRange(month).end],
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const series = [];
  for (let i = 0; i < months; i += 1) {
    const m = shiftMonth(first, i);
    const r = byMonth.get(m);
    series.push({ month: m, total: r ? Number(r.total) : 0, count: r ? Number(r.count) : 0 });
  }
  res.json({ months: series });
});

// One month in detail: daily series vs the previous month, categories vs the
// previous month, top 5 expenses and weekday statistics.
router.get('/api/insights/month', requireAuth, async (req, res) => {
  const { month } = validate(z.object({ month: monthParam }), req.query);
  const cur = monthRange(month);
  const prev = monthRange(shiftMonth(month, -1));
  const userId = req.user.id;

  const [daily, categories, top] = await Promise.all([
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT expense_date AS date, SUM(amount) AS total
         FROM expenses
        WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
        GROUP BY expense_date`,
      [userId, prev.start, cur.end],
    ),
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT c.id, c.name, c.icon, c.color,
              COALESCE(SUM(CASE WHEN e.expense_date >= ? THEN e.amount END), 0) AS current_total,
              COALESCE(SUM(CASE WHEN e.expense_date <  ? THEN e.amount END), 0) AS previous_total
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        GROUP BY c.id, c.name, c.icon, c.color
        ORDER BY current_total DESC, previous_total DESC`,
      [cur.start, cur.start, userId, prev.start, cur.end],
    ),
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT e.id, e.amount, e.description, e.expense_date,
              c.id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        ORDER BY e.amount DESC, e.id DESC
        LIMIT 5`,
      [userId, cur.start, cur.end],
    ),
  ]);

  const totals = new Map(daily.map((d) => [d.date, Number(d.total)]));
  const days = [];
  for (let day = 1; day <= Math.max(cur.days, prev.days); day += 1) {
    const dd = String(day).padStart(2, '0');
    days.push({
      day,
      current: day <= cur.days ? (totals.get(`${month}-${dd}`) ?? 0) : null,
      previous: day <= prev.days ? (totals.get(`${prev.month}-${dd}`) ?? 0) : null,
    });
  }

  // Days that have actually happened in this month, for a fair daily average.
  const today = todayIso();
  let elapsedDays = cur.days;
  if (month === currentMonth()) elapsedDays = Number(today.slice(8, 10));
  else if (month > currentMonth()) elapsedDays = 0;

  const weekday = WEEKDAYS.map((name) => ({ name, total: 0, count: 0 }));
  for (const [date, total] of totals) {
    if (date < cur.start || date >= cur.end) continue;
    const [y, m, d] = date.split('-').map(Number);
    const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    weekday[w].total += total;
    weekday[w].count += 1;
  }
  const monthTotal = days.reduce((s, d) => s + (d.current ?? 0), 0);
  const highest = weekday.reduce((best, w) => (w.total > best.total ? w : best), weekday[0]);

  res.json({
    month,
    previousMonth: prev.month,
    total: monthTotal,
    daily: days,
    categories: categories.map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      current: Number(c.current_total),
      previous: Number(c.previous_total),
    })),
    top: top.map((t) => ({
      id: t.id,
      amount: t.amount,
      description: t.description,
      expenseDate: t.expense_date,
      category: { id: t.category_id, name: t.category_name, icon: t.category_icon, color: t.category_color },
    })),
    stats: {
      elapsedDays,
      averageDaily: elapsedDays > 0 ? monthTotal / elapsedDays : 0,
      highestWeekday: highest.total > 0 ? highest.name : null,
      weekdays: weekday,
    },
  });
});

module.exports = router;
