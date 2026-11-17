'use strict';

// Business metrics (naming-conventions §6.3: the expense_ namespace).
// Never labelled by category, user or anything else user-defined: those values
// are unbounded.

const { client, register } = require('./registry');
const { timedQuery } = require('../db');
const { currentMonth } = require('../lib/validation');

const expensesCreated = new client.Counter({
  name: 'expense_expenses_created_total',
  help: 'Expenses saved successfully (including sample data).',
  registers: [register],
});

const amountRupees = new client.Counter({
  name: 'expense_amount_rupees_total',
  help: 'Total rupees recorded in successfully saved expenses (including sample data).',
  registers: [register],
});

const userLogins = new client.Counter({
  name: 'expense_user_logins_total',
  help: 'Sign-in attempts, by result.',
  labelNames: ['result'],
  registers: [register],
});
// Initialise both series so rate() works before the first failure.
userLogins.inc({ result: 'success' }, 0);
userLogins.inc({ result: 'failure' }, 0);

const usersRegistered = new client.Counter({
  name: 'expense_users_registered_total',
  help: 'Users who signed up successfully.',
  registers: [register],
});

function recordExpensesCreated(amounts) {
  expensesCreated.inc(amounts.length);
  amountRupees.inc(amounts.reduce((sum, a) => sum + Number(a), 0));
}
const recordLogin = (success) => userLogins.inc({ result: success ? 'success' : 'failure' });
const recordRegistration = () => usersRegistered.inc();

// ---- expense_budgets_exceeded ------------------------------------------------
// Budgets for the current month whose spending is over the limit, across all
// users. One aggregate query, cached for 30 s, with a 2 s timeout. On failure
// the last value is kept (the DB wrapper counts the error) and the scrape
// always succeeds.

const CACHE_MS = 30_000;
const TIMEOUT_MS = 2_000;
const cache = { value: 0, at: 0, inFlight: null };

const BUDGETS_EXCEEDED_SQL = `
  SELECT COUNT(*) AS n
    FROM budgets b
   WHERE b.month = ?
     AND b.amount < (SELECT COALESCE(SUM(e.amount), 0)
                       FROM expenses e
                      WHERE e.user_id = b.user_id
                        AND e.category_id = b.category_id
                        AND e.expense_date >= b.month
                        AND e.expense_date < b.month + INTERVAL 1 MONTH)`;

function refreshBudgetsExceeded() {
  if (!cache.inFlight) {
    cache.inFlight = timedQuery({ operation: 'select', table: 'budgets' }, BUDGETS_EXCEEDED_SQL, [`${currentMonth()}-01`])
      .then((rows) => {
        cache.value = Number(rows[0].n);
        cache.at = Date.now();
      })
      .catch(() => {
        // keep the last value; expense_db_query_errors_total was incremented
        // by the wrapper. Retry on the next scrape, not before.
        cache.at = Date.now() - CACHE_MS + 5_000;
      })
      .finally(() => {
        cache.inFlight = null;
      });
  }
  return cache.inFlight;
}

new client.Gauge({
  name: 'expense_budgets_exceeded',
  help: 'Budgets in the current month whose spending is over the limit, across all users.',
  registers: [register],
  async collect() {
    try {
      if (Date.now() - cache.at >= CACHE_MS) {
        let timer;
        await Promise.race([
          refreshBudgetsExceeded(),
          new Promise((resolve) => {
            timer = setTimeout(resolve, TIMEOUT_MS);
          }),
        ]);
        clearTimeout(timer);
      }
    } catch {
      // never fail a scrape
    }
    this.set(cache.value);
  },
});

module.exports = { recordExpensesCreated, recordLogin, recordRegistration };
