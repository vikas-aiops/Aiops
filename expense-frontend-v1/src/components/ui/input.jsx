import { forwardRef } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

// Two tones: "paper" for inputs on paper cards, "ink" for dark surfaces
// (slide-over, filters bar). Invalid inputs get a coral border.
const tones = {
  paper:
    'border-paper-line bg-white text-ink placeholder:text-paper-muted/80 hover:border-paper-muted/60 aria-[invalid=true]:border-alert-coral-deep',
  ink: 'border-ink-line bg-ink text-paper placeholder:text-ink-muted hover:border-ink-muted/60 aria-[invalid=true]:border-alert-coral',
};

const Input = forwardRef(({ className, tone = 'ink', type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-10 w-full min-w-0 rounded-control border px-3 text-sm transition-colors duration-150 focus-visible:border-stamp-amber disabled:cursor-not-allowed disabled:opacity-60',
      tones[tone],
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Label = forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium', className)} {...props} />
));
Label.displayName = 'Label';

function FieldError({ id, children, tone = 'ink' }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn('text-sm', tone === 'paper' ? 'text-alert-coral-deep' : 'text-alert-coral')}>
      {children}
    </p>
  );
}

export { Input, Label, FieldError };
