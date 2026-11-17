import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Check, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { ErrorState } from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useAppState } from '@/lib/app-state';
import { todayIso } from '@/lib/format';
import { iconFor } from '@/lib/icons';
import { cn } from '@/lib/utils';

const LEDGER_PAGES = ['/dashboard', '/expenses'];

function emptyForm() {
  return { amount: '', categoryId: null, expenseDate: todayIso(), description: '' };
}

function validateForm(f) {
  const errors = {};
  const amount = Number(f.amount);
  if (f.amount === '' || f.amount === null) errors.amount = 'Enter an amount';
  else if (!Number.isFinite(amount)) errors.amount = 'Amount must be a number';
  else if (amount <= 0) errors.amount = 'Amount must be greater than zero';
  else if (amount > 99999999.99) errors.amount = 'Amount must be at most ₹9,99,99,999.99';
  else if (!/^\d+(\.\d{1,2})?$/.test(String(f.amount))) errors.amount = 'Amount can have at most 2 decimal places';
  if (!f.categoryId) errors.categoryId = 'Choose a category';
  if (!f.expenseDate) errors.expenseDate = 'Choose a date';
  if (!f.description.trim()) errors.description = 'Add a short description, such as "Groceries"';
  return errors;
}

export function ExpenseSheet() {
  const { sheet, closeSheet } = useAppState();
  return (
    <Sheet open={sheet.open} onOpenChange={(open) => !open && closeSheet()}>
      {sheet.open && (
        <SheetContent
          title={sheet.expense ? 'Edit expense' : 'Add expense'}
          description={sheet.expense ? 'Change any detail, then save.' : 'Record what you spent.'}
        >
          <ExpenseForm key={sheet.expense?.id ?? 'new'} expense={sheet.expense} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function ExpenseForm({ expense }) {
  const { closeSheet, invalidate, stamp, month } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = useApi(`/categories?month=${month}`);
  const [form, setForm] = useState(() =>
    expense
      ? {
          amount: String(expense.amount),
          categoryId: expense.category.id,
          expenseDate: expense.expenseDate,
          description: expense.description,
        }
      : emptyForm(),
  );
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const amountRef = useRef(null);
  const ids = { amount: useId(), date: useId(), desc: useId(), cat: useId() };

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const set = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setErrors(validateForm(next));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    const v = validateForm(form);
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(v.amount ? ids.amount : v.description ? ids.desc : v.expenseDate ? ids.date : ids.cat)?.focus();
      return;
    }
    setSaving(true);
    setServerError('');
    const body = {
      amount: Number(form.amount),
      categoryId: form.categoryId,
      expenseDate: form.expenseDate,
      description: form.description.trim(),
    };
    try {
      const result = expense
        ? await api(`/expenses/${expense.id}`, { method: 'PUT', body })
        : await api('/expenses', { method: 'POST', body });
      closeSheet();
      invalidate();
      stamp(result.expense.id);
      if (expense) {
        toast.success('Changes saved');
      } else if (LEDGER_PAGES.includes(location.pathname)) {
        toast.success('Expense added');
      } else {
        toast.success('Expense added', { action: { label: 'View', onClick: () => navigate('/expenses') } });
      }
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {/* Amount: the large, primary field */}
        <div className="space-y-2">
          <Label htmlFor={ids.amount}>Amount</Label>
          <div
            className={cn(
              'flex items-center rounded-control border bg-ink px-4 transition-colors focus-within:border-stamp-amber',
              errors.amount ? 'border-alert-coral' : 'border-ink-line hover:border-ink-muted/60',
            )}
          >
            <span className="font-display text-2xl text-ink-muted" aria-hidden="true">
              ₹
            </span>
            <input
              ref={amountRef}
              id={ids.amount}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? `${ids.amount}-err` : undefined}
              className="figures h-16 w-full min-w-0 bg-transparent pl-3 text-right text-2xl text-paper outline-none placeholder:text-ink-muted/50 focus-visible:outline-none"
            />
          </div>
          <FieldError id={`${ids.amount}-err`}>{errors.amount}</FieldError>
        </div>

        {/* Category icon grid */}
        <fieldset className="space-y-2">
          <legend id={ids.cat} tabIndex={-1} className="mb-2 text-sm font-medium">
            Category
          </legend>
          {categories.error && !categories.data ? (
            <ErrorState tone="ink" error={categories.error} onRetry={categories.reload} className="py-4" />
          ) : !categories.data ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} tone="ink" className="h-[72px]" />
              ))}
            </div>
          ) : (
            <div role="radiogroup" aria-labelledby={ids.cat} className="grid grid-cols-4 gap-2">
              {categories.data.items.map((c) => {
                const Icon = iconFor(c.icon);
                const selected = form.categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set('categoryId', c.id)}
                    className={cn(
                      'relative flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-control border px-1 text-xs transition-colors',
                      selected
                        ? 'border-stamp-amber bg-ink-hover text-paper'
                        : 'border-ink-line bg-ink text-ink-muted hover:border-ink-muted/60 hover:text-paper',
                    )}
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-[7px] text-white" style={{ backgroundColor: c.color }}>
                      <Icon className="size-4" />
                    </span>
                    <span className="w-full truncate text-center">{c.name}</span>
                    {selected && (
                      <span className="absolute top-1 right-1 inline-flex size-4 items-center justify-center rounded-pill bg-stamp-amber text-ink">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <FieldError>{errors.categoryId}</FieldError>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor={ids.date}>Date</Label>
          <Input
            id={ids.date}
            type="date"
            className="figures"
            value={form.expenseDate}
            max="2099-12-31"
            onChange={(e) => set('expenseDate', e.target.value)}
            aria-invalid={Boolean(errors.expenseDate)}
          />
          <FieldError>{errors.expenseDate}</FieldError>
        </div>

        <div className="space-y-2">
          <Label htmlFor={ids.desc}>Description</Label>
          <Input
            id={ids.desc}
            maxLength={255}
            placeholder="What was it for?"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? `${ids.desc}-err` : undefined}
          />
          <FieldError id={`${ids.desc}-err`}>{errors.description}</FieldError>
        </div>

        {serverError && (
          <p role="alert" className="rounded-control border border-alert-coral/40 bg-alert-coral/10 px-3 py-2 text-sm text-paper">
            {serverError}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-ink-line px-6 py-4">
        {expense ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 hover:text-alert-coral"
            onClick={() => setConfirming(true)}
            aria-label="Delete expense"
            title="Delete expense"
          >
            <Trash2 />
          </Button>
        ) : null}
        <Button type="button" variant="secondary" className="flex-1" onClick={closeSheet}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
      {expense && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Delete this expense?"
          description={`“${expense.description}” will be removed from your ledger. This can't be undone.`}
          confirmLabel="Delete expense"
          busy={deleting}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await api(`/expenses/${expense.id}`, { method: 'DELETE' });
              setConfirming(false);
              closeSheet();
              invalidate();
              toast.success('Expense deleted');
            } catch (err) {
              setDeleting(false);
              toast.error('Expense not deleted', { description: err.message });
            }
          }}
        />
      )}
    </form>
  );
}
