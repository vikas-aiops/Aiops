import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { Button } from './button';

// shadcn/ui AlertDialog for destructive confirmations.
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy }) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[#060a14]/70 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-ink-line bg-ink-raised p-6 text-paper shadow-float data-[state=open]:animate-[dialog-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]">
          <AlertDialogPrimitive.Title className="font-display text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-ink-muted">{description}</AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {busy ? 'Deleting…' : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
