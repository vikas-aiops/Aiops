import { useId, useState } from 'react';
import { Check, Pencil, Plus, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/misc';
import { CategoryIcon, EmptyState, ErrorState, Money } from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useAppState } from '@/lib/app-state';
import { monthName } from '@/lib/format';
import { CATEGORY_PALETTE, ICON_PICKER, iconFor } from '@/lib/icons';
import { cn } from '@/lib/utils';

export function CategoriesPage() {
  const { month } = useAppState();
  const list = useApi(`/categories?month=${month}`);
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const items = list.data?.items ?? [];
  const defaults = items.filter((c) => c.isDefault);
  const custom = items.filter((c) => !c.isDefault);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Spending shown for {monthName(month)}.</p>
        <Button onClick={() => setEditing('new')}>
          <Plus /> New category
        </Button>
      </div>

      {list.error && !list.data ? (
        <Card>
          <ErrorState error={list.error} onRetry={list.reload} />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Your categories" description="Custom categories you created. Select one to edit it." />
            <div className="p-5 sm:p-6">
              {!list.data ? (
                <GridSkeleton count={3} />
              ) : custom.length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="No custom categories yet"
                  action={
                    <Button variant="secondary-paper" onClick={() => setEditing('new')}>
                      <Plus /> New category
                    </Button>
                  }
                  className="py-6"
                >
                  Create one for anything the defaults don't cover, such as pets or a side project.
                </EmptyState>
              ) : (
                <Grid items={custom} onEdit={setEditing} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Default categories" description="Available to everyone. These can't be edited." />
            <div className="p-5 sm:p-6">{!list.data ? <GridSkeleton count={10} /> : <Grid items={defaults} />}</div>
          </Card>
        </>
      )}

      <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <SheetContent
            title={editing === 'new' ? 'New category' : 'Edit category'}
            description="Pick a name, an icon and a colour."
          >
            <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function Grid({ items, onEdit }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => {
        const body = (
          <>
            <CategoryIcon icon={c.icon} color={c.color} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-ink">{c.name}</span>
                {c.isDefault && <span className="rounded-pill bg-paper-dim px-2 py-0.5 text-xs text-paper-muted">Default</span>}
              </span>
              <span className="mt-0.5 block text-xs text-paper-muted">
                {c.count === 0 ? 'No expenses this month' : `${c.count} ${c.count === 1 ? 'expense' : 'expenses'}`}
              </span>
            </span>
            <span className="text-right">
              <Money value={c.spent} className="block text-sm font-medium text-ink" />
              {onEdit && <Pencil className="ml-auto mt-1 size-3.5 text-paper-muted" aria-hidden="true" />}
            </span>
          </>
        );
        return (
          <li key={c.id}>
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label={`Edit ${c.name}`}
                className="flex w-full items-center gap-3 rounded-control border border-paper-line bg-white/50 p-3 text-left transition-colors hover:border-paper-muted/50 hover:bg-white"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-control border border-paper-dim p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GridSkeleton({ count }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading categories">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[70px]" />
      ))}
    </div>
  );
}

function CategoryForm({ category, onDone }) {
  const { invalidate } = useAppState();
  const [form, setForm] = useState({
    name: category?.name ?? '',
    icon: category?.icon ?? 'PawPrint',
    color: category?.color ?? CATEGORY_PALETTE[1].hex,
  });
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const Preview = iconFor(form.icon);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Enter a name for the category');
      document.getElementById(nameId)?.focus();
      return;
    }
    setSaving(true);
    setServerError('');
    try {
      const body = { name: form.name.trim(), icon: form.icon, color: form.color };
      if (category) await api(`/categories/${category.id}`, { method: 'PUT', body });
      else await api('/categories', { method: 'POST', body });
      invalidate();
      toast.success(category ? 'Category updated' : 'Category created');
      onDone();
    } catch (err) {
      if (err.status === 409) setError(err.message);
      else setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="flex items-center gap-3 rounded-control border border-ink-line bg-ink p-3">
          <span className="inline-flex size-11 items-center justify-center rounded-[10px] text-white" style={{ backgroundColor: form.color }}>
            <Preview className="size-5" />
          </span>
          <span className="truncate font-medium">{form.name.trim() || 'Category name'}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            maxLength={50}
            value={form.name}
            placeholder="For example, Pets"
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setError('');
            }}
            aria-invalid={Boolean(error)}
          />
          <FieldError>{error}</FieldError>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Icon</legend>
          <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {ICON_PICKER.map((name) => {
              const Icon = iconFor(name);
              const on = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={name.replace(/([a-z])([A-Z0-9])/g, '$1 $2')}
                  onClick={() => setForm({ ...form, icon: name })}
                  className={cn(
                    'inline-flex aspect-square items-center justify-center rounded-control border transition-colors',
                    on ? 'border-stamp-amber bg-ink-hover text-paper' : 'border-transparent text-ink-muted hover:bg-ink-hover hover:text-paper',
                  )}
                >
                  <Icon className="size-[18px]" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
            {CATEGORY_PALETTE.map((c) => {
              const on = form.color.toUpperCase() === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setForm({ ...form, color: c.hex })}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-pill text-white ring-offset-2 ring-offset-ink-raised transition-shadow',
                    on && 'ring-2 ring-paper',
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {on && <Check className="size-4" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {serverError && (
          <p role="alert" className="rounded-control border border-alert-coral/40 bg-alert-coral/10 px-3 py-2 text-sm">
            {serverError}
          </p>
        )}
      </div>
      <div className="flex gap-2 border-t border-ink-line px-6 py-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}
