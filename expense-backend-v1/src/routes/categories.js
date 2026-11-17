'use strict';

const express = require('express');
const { timedQuery } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate, notFound, conflict, forbidden } = require('../middleware/errors');
const { z, id, monthParam, monthRange, ICON_NAME, HEX_COLOR } = require('../lib/validation');

const router = express.Router();

const categorySchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters'),
  icon: z.string({ error: 'Choose an icon' }).regex(ICON_NAME, 'Choose an icon from the list'),
  color: z
    .string({ error: 'Choose a colour' })
    .regex(HEX_COLOR, 'Colour must be a hex value like #3D7EA6')
    .transform((v) => v.toUpperCase()),
});

function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default === 1,
    spent: row.spent === undefined ? undefined : Number(row.spent),
    count: row.count === undefined ? undefined : Number(row.count),
  };
}

async function assertNameFree(userId, name, exceptId = 0) {
  // Custom names must not clash with the user's other categories or a default.
  const rows = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id FROM categories WHERE name = ? AND (user_id IS NULL OR user_id = ?) AND id <> ?',
    [name, userId, exceptId],
  );
  if (rows.length > 0) throw conflict(`You already have a category called "${name}"`, 'duplicate_category');
}

// Defaults + the caller's custom categories, each with its spend for ?month= (default: this month).
router.get('/api/categories', requireAuth, async (req, res) => {
  const { month } = validate(z.object({ month: monthParam }), req.query);
  const range = monthRange(month);
  const rows = await timedQuery({ operation: 'select', table: 'categories' }, `SELECT c.id, c.name, c.icon, c.color, c.is_default,
            COALESCE(SUM(e.amount), 0) AS spent, COUNT(e.id) AS count
       FROM categories c
       LEFT JOIN expenses e
         ON e.category_id = c.id AND e.user_id = ? AND e.expense_date >= ? AND e.expense_date < ?
      WHERE c.user_id IS NULL OR c.user_id = ?
      GROUP BY c.id, c.name, c.icon, c.color, c.is_default
      ORDER BY c.is_default DESC, c.name ASC`,
    [req.user.id, range.start, range.end, req.user.id],
  );
  res.json({ month, items: rows.map(toCategory) });
});

router.post('/api/categories', requireAuth, async (req, res) => {
  const input = validate(categorySchema, req.body ?? {});
  await assertNameFree(req.user.id, input.name);
  let result;
  try {
    result = await timedQuery({ operation: 'insert', table: 'categories' }, 'INSERT INTO categories (user_id, name, icon, color, is_default) VALUES (?, ?, ?, ?, 0)', [
      req.user.id,
      input.name,
      input.icon,
      input.color,
    ]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw conflict(`You already have a category called "${input.name}"`, 'duplicate_category');
    throw err;
  }
  const rows = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id, name, icon, color, is_default FROM categories WHERE id = ?', [result.insertId]);
  res.status(201).json({ category: toCategory(rows[0]) });
});

router.put('/api/categories/:id', requireAuth, async (req, res) => {
  const { id: categoryId } = validate(z.object({ id: id('Category id') }), req.params);
  const input = validate(categorySchema, req.body ?? {});

  const existing = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id, user_id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)', [
    categoryId,
    req.user.id,
  ]);
  if (existing.length === 0) throw notFound('Category not found');
  // The request is valid and the category exists, but nobody may edit a default: 403.
  if (existing[0].user_id === null) throw forbidden('Default categories cannot be changed', 'default_category');

  await assertNameFree(req.user.id, input.name, categoryId);
  try {
    await timedQuery({ operation: 'update', table: 'categories' }, 'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?', [
      input.name,
      input.icon,
      input.color,
      categoryId,
      req.user.id,
    ]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw conflict(`You already have a category called "${input.name}"`, 'duplicate_category');
    throw err;
  }
  const rows = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id, name, icon, color, is_default FROM categories WHERE id = ?', [categoryId]);
  res.json({ category: toCategory(rows[0]) });
});

module.exports = router;
