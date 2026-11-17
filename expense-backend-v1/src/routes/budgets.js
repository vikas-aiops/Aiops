'use strict';

const express = require('express');
const { timedQuery } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate, notFound } = require('../middleware/errors');
const { z, id, amount, monthParam, monthRange } = require('../lib/validation');

const router = express.Router();

// Every category the user can see, with its limit for the month (null if none
// is set) and what has been spent against it.
router.get('/api/budgets', requireAuth, async (req, res) => {
  const { month } = validate(z.object({ month: monthParam }), req.query);
  const range = monthRange(month);
  const rows = await timedQuery({ operation: 'select', table: 'budgets' }, `SELECT c.id, c.name, c.icon, c.color, c.is_default, b.amount AS limit_amount,
            COALESCE(s.spent, 0) AS spent
       FROM categories c
       LEFT JOIN budgets b
         ON b.category_id = c.id AND b.user_id = ? AND b.month = ?
       LEFT JOIN (
            SELECT category_id, SUM(amount) AS spent
              FROM expenses
             WHERE user_id = ? AND expense_date >= ? AND expense_date < ?
             GROUP BY category_id
       ) s ON s.category_id = c.id
      WHERE c.user_id IS NULL OR c.user_id = ?
      ORDER BY c.is_default DESC, c.name ASC`,
    [req.user.id, range.start, req.user.id, range.start, range.end, req.user.id],
  );

  const items = rows.map((r) => ({
    categoryId: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    isDefault: r.is_default === 1,
    limit: r.limit_amount,
    spent: Number(r.spent),
    usedPct: r.limit_amount ? (Number(r.spent) / r.limit_amount) * 100 : null,
  }));
  const budgeted = items.filter((i) => i.limit !== null);
  const totalLimit = budgeted.reduce((s, i) => s + i.limit, 0);
  const totalSpentBudgeted = budgeted.reduce((s, i) => s + i.spent, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);

  res.json({
    month,
    items,
    totals: {
      limit: totalLimit,
      spentInBudgeted: totalSpentBudgeted,
      spent: totalSpent,
      usedPct: totalLimit > 0 ? (totalSpentBudgeted / totalLimit) * 100 : null,
    },
  });
});

// Upsert the limit for one category in ?month= (default: this month).
router.put('/api/budgets/:categoryId', requireAuth, async (req, res) => {
  const { categoryId } = validate(z.object({ categoryId: id('categoryId') }), req.params);
  const { month } = validate(z.object({ month: monthParam }), req.query);
  const input = validate(z.object({ amount: amount('Budget') }), req.body ?? {});

  const cats = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [
    categoryId,
    req.user.id,
  ]);
  if (cats.length === 0) throw notFound('Category not found');

  const range = monthRange(month);
  await timedQuery({ operation: 'insert', table: 'budgets' }, `INSERT INTO budgets (user_id, category_id, month, amount) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
    [req.user.id, categoryId, range.start, input.amount],
  );
  res.json({ budget: { categoryId, month, limit: input.amount } });
});

module.exports = router;
