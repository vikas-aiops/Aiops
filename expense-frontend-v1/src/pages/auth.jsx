import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Wordmark } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Wordmark className="mb-8" />
      <div className="paper-card w-full max-w-[420px] p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-paper-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-sm text-ink-muted">{footer}</p>
    </main>
  );
}

function Field({ label, error, id, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-ink">
        {label}
      </Label>
      {children}
      <FieldError id={`${id}-err`} tone="paper">
        {error}
      </FieldError>
    </div>
  );
}

function PasswordInput({ id, value, onChange, error, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        tone="paper"
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-paper-muted hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-control border border-alert-coral/40 bg-alert-coral/10 px-3 py-2 text-sm text-alert-coral-deep">
      {children}
    </p>
  );
}

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { email: useId(), password: useId() };

  const validate = (f) => {
    const e = {};
    if (!f.email.trim()) e.email = 'Enter your email address';
    else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address, like name@example.com';
    if (!f.password) e.password = 'Enter your password';
    return e;
  };

  async function onSubmit(e) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setFormError('');
    try {
      await signIn(form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err.status === 401 ? 'Email or password is incorrect. Check both and try again.' : err.message);
      setBusy(false);
    }
  }

  const update = (key) => (e) => {
    const next = { ...form, [key]: e.target.value };
    setForm(next);
    if (errors[key]) setErrors(validate(next));
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where your ledger left off."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-stamp-amber hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError>{formError}</FormError>
        <Field label="Email" id={ids.email} error={errors.email}>
          <Input
            tone="paper"
            id={ids.email}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${ids.email}-err` : undefined}
          />
        </Field>
        <Field label="Password" id={ids.password} error={errors.password}>
          <PasswordInput id={ids.password} autoComplete="current-password" value={form.password} onChange={update('password')} error={errors.password} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { name: useId(), email: useId(), password: useId() };

  const validate = (f) => {
    const e = {};
    if (!f.displayName.trim()) e.displayName = 'Enter your name';
    if (!f.email.trim()) e.email = 'Enter your email address';
    else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address, like name@example.com';
    if (f.password.length < 8) e.password = 'Use at least 8 characters';
    else if (f.password.length > 72) e.password = 'Use at most 72 characters';
    return e;
  };

  async function onSubmit(e) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setFormError('');
    try {
      await signUp(form.displayName.trim(), form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.status === 409) setErrors({ email: 'An account with this email already exists. Sign in instead.' });
      else setFormError(err.message);
      setBusy(false);
    }
  }

  const update = (key) => (e) => {
    const next = { ...form, [key]: e.target.value };
    setForm(next);
    if (errors[key]) setErrors(validate(next));
  };

  const strength = form.password.length === 0 ? 0 : form.password.length < 8 ? 1 : form.password.length < 12 ? 2 : 3;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track spending in rupees, set budgets, see where the money goes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-stamp-amber hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError>{formError}</FormError>
        <Field label="Name" id={ids.name} error={errors.displayName}>
          <Input
            tone="paper"
            id={ids.name}
            autoComplete="name"
            value={form.displayName}
            onChange={update('displayName')}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? `${ids.name}-err` : undefined}
          />
        </Field>
        <Field label="Email" id={ids.email} error={errors.email}>
          <Input
            tone="paper"
            id={ids.email}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${ids.email}-err` : undefined}
          />
        </Field>
        <Field label="Password" id={ids.password} error={errors.password}>
          <PasswordInput id={ids.password} autoComplete="new-password" value={form.password} onChange={update('password')} error={errors.password} />
          {!errors.password && (
            <div className="flex items-center gap-2 pt-1" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn(
                    'h-1 flex-1 rounded-pill transition-colors',
                    strength >= n ? (strength === 1 ? 'bg-alert-coral' : strength === 2 ? 'bg-stamp-amber' : 'bg-ledger-green') : 'bg-paper-dim',
                  )}
                />
              ))}
              <span className="w-28 text-right text-xs text-paper-muted">
                {strength === 0 ? 'At least 8 characters' : strength === 1 ? 'Too short' : strength === 2 ? 'Good' : 'Strong'}
              </span>
            </div>
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
