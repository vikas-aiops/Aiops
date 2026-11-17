import { forwardRef } from 'react';
import { Slot } from 'radix-ui';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui Button, restyled with Ledger tokens. Radius 8px (controls),
// amber for the primary action, deep coral for destructive.
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[background-color,color,box-shadow,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-stamp-amber text-ink shadow-press hover:bg-stamp-amber-hover',
        secondary: 'border border-ink-line bg-ink-raised text-paper hover:bg-ink-hover',
        'secondary-paper': 'border border-paper-line bg-paper text-ink hover:bg-paper-dim',
        ghost: 'text-ink-muted hover:bg-ink-hover hover:text-paper',
        'ghost-paper': 'text-paper-muted hover:bg-paper-dim hover:text-ink',
        destructive: 'bg-alert-coral-deep text-white shadow-press hover:bg-alert-coral',
        link: 'h-auto px-0 text-stamp-amber underline-offset-4 hover:underline',
        'link-paper': 'h-auto px-0 text-stamp-amber-deep underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
