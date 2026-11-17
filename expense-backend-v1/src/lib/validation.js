'use strict';

const { z } = require('zod');

// The app's calendar is Indian Standard Time: "today" and "this month" are
// computed in IST regardless of the server's own timezone.
const APP_TIMEZONE = 'Asia/Kolkata';

function todayIso() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 'YYYY-MM' -> { month, start: 'YYYY-MM-01', end: first day of next month (exclusive) }
function monthRange(month) {
  return { month, start: `${month}-01`, end: `${shiftMonth(month, 1)}-01`, days: daysInMonth(month) };
}

function isRealDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isoDate = (label) =>
  z
    .string({ error: `${label} is required` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date in YYYY-MM-DD format`)
    .refine(isRealDate, `${label} is not a real calendar date`);

const monthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format')
  .optional()
  .transform((v) => v ?? currentMonth());

const amount = (label = 'Amount') =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .refine(Number.isFinite, `${label} must be a number`)
    .refine((v) => v > 0, `${label} must be greater than zero`)
    .refine((v) => v <= 99999999.99, `${label} must be at most 9,99,99,999.99`)
    .refine((v) => Math.round(v * 100) === Number((v * 100).toFixed(6)), `${label} can have at most 2 decimal places`);

const id = (label) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be a positive number`);

const ICON_NAME = /^[A-Z][A-Za-z0-9]{1,49}$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

module.exports = {
  z,
  APP_TIMEZONE,
  todayIso,
  currentMonth,
  shiftMonth,
  daysInMonth,
  monthRange,
  isoDate,
  monthParam,
  amount,
  id,
  ICON_NAME,
  HEX_COLOR,
};
