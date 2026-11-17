'use strict';

const express = require('express');
const { timedQuery, withTransaction } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { conflict } = require('../middleware/errors');
const { todayIso, currentMonth, shiftMonth } = require('../lib/validation');
const { recordExpensesCreated } = require('../metrics/business');

const router = express.Router();
const MAX_EXISTING_EXPENSES = 20;

// ---- realistic Indian household spending -----------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (min, max, step = 1) => Math.round((min + Math.random() * (max - min)) / step) * step;
const chance = (p) => Math.random() < p;

// Monthly fixed costs: [category, description, day of month, [min, max], step]
const MONTHLY = [
  ['Housing', 'Rent', 1, [18000, 18000], 1],
  ['Housing', 'Society maintenance', 3, [2500, 2500], 1],
  ['Bills', 'Electricity bill (BESCOM)', 6, [1350, 2650], 10],
  ['Bills', 'Broadband (ACT Fibernet)', 8, [999, 999], 1],
  ['Bills', 'Mobile recharge (Jio)', 12, [349, 349], 1],
  ['Bills', 'Piped gas bill', 15, [420, 780], 10],
  ['Entertainment', 'Netflix subscription', 18, [649, 649], 1],
  ['Health', 'Gym membership', 2, [1500, 1500], 1],
  ['Education', 'Online course instalment', 20, [1499, 1499], 1],
];

// Day-to-day: [category, probability per day, [descriptions], [min, max], step]
const DAILY = [
  ['Food', 0.55, ['Swiggy order', 'Zomato dinner', 'Lunch at office canteen', 'Filter coffee and snacks', 'Biryani takeaway', 'Chai and samosa'], [60, 650], 5],
  ['Food', 0.22, ['BigBasket groceries', 'DMart groceries', 'Vegetables and fruits', 'Milk and bread', 'Zepto quick order'], [250, 2400], 10],
  ['Transport', 0.45, ['Uber to office', 'Ola auto', 'Namma Metro card top-up', 'Rapido bike taxi', 'Auto rickshaw'], [40, 420], 5],
  ['Transport', 0.07, ['Petrol', 'Bike service'], [500, 1800], 10],
  ['Shopping', 0.08, ['Amazon order', 'Myntra clothes', 'Decathlon sports gear', 'Household supplies', 'Flipkart electronics accessory'], [399, 4200], 10],
  ['Health', 0.05, ['Apollo Pharmacy', 'Doctor consultation', 'Lab tests'], [150, 1800], 10],
  ['Entertainment', 0.06, ['PVR movie tickets', 'BookMyShow event', 'Weekend cafe'], [300, 1600], 10],
  ['Other', 0.04, ['Gift for friend', 'Temple donation', 'Haircut', 'Laundry'], [100, 1500], 10],
];

// One trip per sample set: [category, description, [min, max]]
const TRIP = [
  ['Travel', 'IndiGo flight to Goa', [4800, 7600]],
  ['Travel', 'Hotel in Goa (2 nights)', [5200, 8400]],
  ['Food', 'Beach shack dinner', [900, 1800]],
  ['Transport', 'Scooter rental in Goa', [700, 1100]],
];

// Budgets set for each month, with a mix of under, near and over spending.
const BUDGETS = { Food: 9000, Transport: 4500, Housing: 21000, Bills: 4800, Shopping: 4000, Entertainment: 2500, Health: 3000 };

function isoAdd(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function buildSample(categoryIds) {
  const today = todayIso();
  const start = `${shiftMonth(currentMonth(), -2)}-01`;
  const rows = [];
  const add = (cat, description, date, amount) => rows.push([categoryIds[cat], amount, description, date]);

  for (let date = start; date <= today; date = isoAdd(date, 1)) {
    const day = Number(date.slice(8, 10));
    for (const [cat, description, dom, [min, max], step] of MONTHLY) {
      if (day === dom) add(cat, description, date, between(min, max, step));
    }
    for (const [cat, p, descriptions, [min, max], step] of DAILY) {
      if (chance(p)) add(cat, pick(descriptions), date, between(min, max, step));
    }
  }

  // A trip in the middle month.
  const tripStart = `${shiftMonth(currentMonth(), -1)}-14`;
  TRIP.forEach(([cat, description, [min, max]], i) => add(cat, description, isoAdd(tripStart, Math.min(i, 2)), between(min, max, 10)));
  return rows;
}

router.post('/api/sample-data', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const defaults = await timedQuery({ operation: 'select', table: 'categories' }, 'SELECT id, name FROM categories WHERE user_id IS NULL');
  const categoryIds = Object.fromEntries(defaults.map((c) => [c.name, c.id]));

  const result = await withTransaction(async (conn) => {
    // Lock the user row so two quick clicks can't both insert.
    await timedQuery({ operation: 'select', table: 'users' }, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [userId], conn);
    const [{ n }] = await timedQuery(
      { operation: 'select', table: 'expenses' },
      'SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?',
      [userId],
      conn,
    );
    if (n > MAX_EXISTING_EXPENSES) {
      throw conflict(
        `Sample data can only be loaded into an account with ${MAX_EXISTING_EXPENSES} expenses or fewer. You have ${n}.`,
        'sample_data_refused',
      );
    }

    const rows = buildSample(categoryIds).map((r) => [userId, ...r]);
    await timedQuery(
      { operation: 'insert', table: 'expenses' },
      'INSERT INTO expenses (user_id, category_id, amount, description, expense_date) VALUES ?',
      [rows],
      conn,
    );

    const budgetRows = [];
    for (let i = 0; i < 3; i += 1) {
      const month = `${shiftMonth(currentMonth(), -i)}-01`;
      for (const [name, amount] of Object.entries(BUDGETS)) budgetRows.push([userId, categoryIds[name], month, amount]);
    }
    await timedQuery(
      { operation: 'insert', table: 'budgets' },
      'INSERT INTO budgets (user_id, category_id, month, amount) VALUES ? ON DUPLICATE KEY UPDATE amount = amount',
      [budgetRows],
      conn,
    );
    return { expensesAdded: rows.length, budgetsSet: budgetRows.length, amounts: rows.map((r) => r[2]) };
  });

  // Only after the transaction committed: sample data moves the business counters.
  recordExpensesCreated(result.amounts);
  delete result.amounts;

  res.status(201).json(result);
});

module.exports = router;
