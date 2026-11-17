'use strict';

const express = require('express');
const { timedQuery } = require('../db');
const { recordExpensesCreated } = require('../metrics/business');
const { requireAuth } = require('../middleware/auth');
const { validate, notFound, badRequest } = require('../middleware/errors');
const { z, isoDate, amount, id, monthParam, monthRange, shiftMonth } = require('../lib/validation');

const router = express.Router();

const EXPENSE_COLUMNS = `
  e.id, e.amount, e.description, e.expense_date, e.created_at, e.updated_at,
  c.id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color`;

function toExpense(row) {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    expenseDate: row.expense_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: { id: row.category_id, name: row.category_name, icon: row.category_icon, color: row.category_color },
  };
}

const expenseSchema = z.object({
  amount: amount('Amount'),
  categoryId: id('categoryId'),
  expenseDate: isoDate('expenseDate'),
  description: z
    .string({ error: 'Description is required' })
    .trim()
    .min(1, 'Description is required')
    .max(255, 'Description must be at most 255 characters'),
});

const optionalNumber = (label) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a non-negative number` });
        return z.NEVER;
      }
      return n;
    });

const listSchema = z.object({
  page: z.coerce.number().int('page must be a whole number').min(1, 'page must be 1 or more').default(1),
  limit: z.coerce
    .number()
    .int('limit must be a whole number')
    .min(1, 'limit must be between 1 and 100')
    .max(100, 'limit must be between 1 and 100')
    .default(25),
  q: z.string().trim().max(100, 'q must be at most 100 characters').optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return [];
      const ids = v.split(',').map((s) => Number(s.trim()));
      if (ids.some((n) => !Number.isSafeInteger(n) || n <= 0)) {
        ctx.addIssue({ code: 'custom', message: 'categoryIds must be a comma-separated list of category ids' });
        return z.NEVER;
      }
      return ids;
    }),
  from: isoDate('from').optional(),
  to: isoDate('to').optional(),
  minAmount: optionalNumber('minAmount'),
  maxAmount: optionalNumber('maxAmount'),
  sort: z.enum(['date', 'amount'], { error: 'sort must be "date" or "amount"' }).default('date'),
  order: z.enum(['asc', 'desc'], { error: 'order must be "asc" or "desc"' }).default('desc'),
});

// A category is usable if it's a system default or the caller's own.
async function assertCategoryUsable(userId, categoryId) {
  const rows = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [
    categoryId,
    userId,
  ]);
  if (rows.length === 0) throw badRequest('Choose a valid category', 'invalid_category');
}

async function loadExpense(userId, expenseId) {
  const rows = await timedQuery({ operation: 'select', table: 'expenses' }, `SELECT ${EXPENSE_COLUMNS}
       FROM expenses e JOIN categories c ON c.id = e.category_id
      WHERE e.id = ? AND e.user_id = ?`,
    [expenseId, userId],
  );
  // Another user's expense is a 404 too: never confirm that an id exists.
  if (rows.length === 0) throw notFound('Expense not found');
  return toExpense(rows[0]);
}

router.get('/api/expenses', requireAuth, async (req, res) => {
  const f = validate(listSchema, req.query);
  if (f.from && f.to && f.from > f.to) throw badRequest('from must be on or before to');
  if (f.minAmount !== undefined && f.maxAmount !== undefined && f.minAmount > f.maxAmount) {
    throw badRequest('minAmount must be less than or equal to maxAmount');
  }

  const where = ['e.user_id = ?'];
  const params = [req.user.id];
  if (f.q) {
    where.push('e.description LIKE ?');
    params.push(`%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  if (f.categoryIds.length > 0) {
    where.push(`e.category_id IN (${f.categoryIds.map(() => '?').join(',')})`);
    params.push(...f.categoryIds);
  }
  if (f.from) {
    where.push('e.expense_date >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('e.expense_date <= ?');
    params.push(f.to);
  }
  if (f.minAmount !== undefined) {
    where.push('e.amount >= ?');
    params.push(f.minAmount);
  }
  if (f.maxAmount !== undefined) {
    where.push('e.amount <= ?');
    params.push(f.maxAmount);
  }
  const whereSql = where.join(' AND ');
  const dir = f.order === 'asc' ? 'ASC' : 'DESC';
  const orderSql = f.sort === 'amount' ? `e.amount ${dir}, e.id ${dir}` : `e.expense_date ${dir}, e.id ${dir}`;

  const [items, totals] = await Promise.all([
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT ${EXPENSE_COLUMNS}
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?`,
      [...params, f.limit, (f.page - 1) * f.limit],
    ),
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT COUNT(*) AS total, COALESCE(SUM(e.amount), 0) AS sum FROM expenses e WHERE ${whereSql}`, params),
  ]);

  res.json({
    items: items.map(toExpense),
    page: f.page,
    limit: f.limit,
    total: Number(totals[0].total),
    sum: Number(totals[0].sum),
  });
});

// Dashboard summary for one month. Deliberately the heaviest endpoint: several
// aggregate queries over the user's expenses and budgets.
router.get('/api/expenses/summary', requireAuth, async (req, res) => {
  const { month } = validate(z.object({ month: monthParam }), req.query);
  const cur = monthRange(month);
  const prev = monthRange(shiftMonth(month, -1));
  const userId = req.user.id;

  const [totals, byCategory, budgetRows, recent] = await Promise.all([
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT
         COALESCE(SUM(CASE WHEN expense_date >= ? AND expense_date < ? THEN amount END), 0) AS current_total,
         COUNT(CASE WHEN expense_date >= ? AND expense_date < ? THEN 1 END)                  AS current_count,
         COALESCE(SUM(CASE WHEN expense_date >= ? AND expense_date < ? THEN amount END), 0) AS previous_total
       FROM expenses
       WHERE user_id = ? AND expense_date >= ? AND expense_date < ?`,
      [cur.start, cur.end, cur.start, cur.end, prev.start, prev.end, userId, prev.start, cur.end],
    ),
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT c.id, c.name, c.icon, c.color, SUM(e.amount) AS total, COUNT(*) AS count
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
        GROUP BY c.id, c.name, c.icon, c.color
        ORDER BY total DESC`,
      [userId, cur.start, cur.end],
    ),
    timedQuery({ operation: 'select', table: 'budgets' }, `SELECT b.category_id, b.amount AS limit_amount, c.name, c.icon, c.color,
              COALESCE((SELECT SUM(e.amount) FROM expenses e
                         WHERE e.user_id = b.user_id AND e.category_id = b.category_id
                           AND e.expense_date >= ? AND e.expense_date < ?), 0) AS spent
         FROM budgets b JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ? AND b.month = ?`,
      [cur.start, cur.end, userId, cur.start],
    ),
    timedQuery({ operation: 'select', table: 'expenses' }, `SELECT ${EXPENSE_COLUMNS}
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = ?
        ORDER BY e.expense_date DESC, e.id DESC
        LIMIT 8`,
      [userId],
    ),
  ]);

  const total = Number(totals[0].current_total);
  const previousTotal = Number(totals[0].previous_total);
  const budgets = budgetRows
    .map((b) => ({
      categoryId: b.category_id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      limit: b.limit_amount,
      spent: Number(b.spent),
      usedPct: b.limit_amount > 0 ? (Number(b.spent) / b.limit_amount) * 100 : 0,
    }))
    .sort((a, b) => b.usedPct - a.usedPct);
  const budgetLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const budgetSpent = budgets.reduce((s, b) => s + b.spent, 0);

  res.json({
    month,
    total,
    count: Number(totals[0].current_count),
    previousTotal,
    delta: total - previousTotal,
    deltaPct: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    byCategory: byCategory.map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      total: Number(c.total),
      count: Number(c.count),
      pct: total > 0 ? (Number(c.total) / total) * 100 : 0,
    })),
    budget: {
      limit: budgetLimit,
      spent: budgetSpent,
      usedPct: budgetLimit > 0 ? (budgetSpent / budgetLimit) * 100 : null,
      categories: budgets,
    },
    recent: recent.map(toExpense),
  });
});

router.post('/api/expenses', requireAuth, async (req, res) => {
  const input = validate(expenseSchema, req.body ?? {});
  await assertCategoryUsable(req.user.id, input.categoryId);
  const result = await timedQuery({ operation: 'insert', table: 'expenses' }, 'INSERT INTO expenses (user_id, category_id, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, input.categoryId, input.amount, input.description, input.expenseDate],
  );
  recordExpensesCreated([input.amount]);
  res.status(201).json({ expense: await loadExpense(req.user.id, result.insertId) });
});

router.put('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id: expenseId } = validate(z.object({ id: id('Expense id') }), req.params);
  const input = validate(expenseSchema, req.body ?? {});
  await loadExpense(req.user.id, expenseId); // 404 unless it's the caller's
  await assertCategoryUsable(req.user.id, input.categoryId);
  await timedQuery({ operation: 'update', table: 'expenses' }, 'UPDATE expenses SET category_id = ?, amount = ?, description = ?, expense_date = ? WHERE id = ? AND user_id = ?',
    [input.categoryId, input.amount, input.description, input.expenseDate, expenseId, req.user.id],
  );
  res.json({ expense: await loadExpense(req.user.id, expenseId) });
});

router.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id: expenseId } = validate(z.object({ id: id('Expense id') }), req.params);
  const result = await timedQuery({ operation: 'delete', table: 'expenses' }, 'DELETE FROM expenses WHERE id = ? AND user_id = ?', [expenseId, req.user.id]);
  if (result.affectedRows === 0) throw notFound('Expense not found');
  res.status(204).end();
});

module.exports = router;
