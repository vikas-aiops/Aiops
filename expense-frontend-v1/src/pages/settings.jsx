import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, LogOut, Sparkles, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoadSampleData } from '@/pages/dashboard';
import { formatDate } from '@/lib/format';

export function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const navigate = useNavigate();
  const sample = useLoadSampleData();
  const [name, setName] = useState(user.displayName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const dirty = name.trim() !== user.displayName;

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    setSaving(true);
    try {
      const r = await api('/auth/me', { method: 'PUT', body: { displayName: name.trim() } });
      setUser(r.user);
      setName(r.user.displayName);
      toast.success('Name updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5 desk:space-y-6">
      <Card>
        <CardHeader title="Profile" description={user.createdAt ? `Member since ${formatDate(user.createdAt.slice(0, 10), { year: true })}` : undefined} />
        <CardBody>
          <form onSubmit={saveName} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={nameId} className="text-ink">
                Display name
              </Label>
              <Input
                tone="paper"
                id={nameId}
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                aria-invalid={Boolean(error)}
              />
              <FieldError tone="paper">{error}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={emailId} className="text-ink">
                Email
              </Label>
              <Input tone="paper" id={emailId} value={user.email} readOnly aria-readonly="true" className="bg-paper-dim/60 text-paper-muted" />
              <p className="text-xs text-paper-muted">Your email is your sign-in and can't be changed.</p>
            </div>
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="desk:hidden">
        <Link to="/categories" className="flex items-center gap-3 px-5 py-4 text-ink">
          <Tags className="size-5 text-paper-muted" />
          <span className="flex-1 font-medium">Categories</span>
          <ChevronRight className="size-4 text-paper-muted" />
        </Link>
      </Card>

      <Card>
        <CardHeader title="Sample data" />
        <CardBody>
          <p className="text-sm text-paper-muted">
            Adds about 3 months of realistic expenses (rent, groceries, commutes, a weekend trip) and monthly budgets, so every
            chart has something to show. It only works on an account with 20 expenses or fewer.
          </p>
          <Button variant="secondary-paper" className="mt-4" onClick={sample.load} disabled={sample.busy}>
            <Sparkles /> {sample.busy ? 'Loading sample data…' : 'Load sample data'}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Session" />
        <CardBody>
          <p className="text-sm text-paper-muted">Sign out of this device. Your data stays safe in your account.</p>
          <Button
            variant="secondary-paper"
            className="mt-4"
            onClick={async () => {
              await signOut();
              navigate('/signin', { replace: true });
            }}
          >
            <LogOut /> Sign out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
