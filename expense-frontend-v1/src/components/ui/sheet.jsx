import { Dialog as SheetPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// shadcn/ui Sheet (Radix Dialog) as a right-hand slide-over on ink-raised.
// Radix provides focus trapping, Escape to close and focus return.
export const Sheet = SheetPrimitive.Root;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({ className, children, title, description, ...props }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-[#060a14]/70 backdrop-blur-[2px] data-[state=closed]:animate-[fade-out_180ms_ease-in] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
      <SheetPrimitive.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-ink-line bg-ink-raised text-paper shadow-float',
          'data-[state=closed]:animate-[sheet-out_200ms_ease-in] data-[state=open]:animate-[sheet-in_260ms_cubic-bezier(0.2,0.8,0.2,1)]',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-line px-6 py-5">
          <div>
            <SheetPrimitive.Title className="font-display text-lg font-semibold">{title}</SheetPrimitive.Title>
            <SheetPrimitive.Description className={cn('mt-0.5 text-sm text-ink-muted', !description && 'sr-only')}>
              {description || title}
            </SheetPrimitive.Description>
          </div>
          <SheetPrimitive.Close className="-mr-2 rounded-control p-2 text-ink-muted transition-colors hover:bg-ink-hover hover:text-paper">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </div>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
