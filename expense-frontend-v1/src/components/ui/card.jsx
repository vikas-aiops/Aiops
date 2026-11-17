import { cn } from '@/lib/utils';

// Paper card resting on ink: 12px radius, deep soft shadow, no gradients.
export function Card({ className, as: Comp = 'section', ...props }) {
  return <Comp className={cn('paper-card', className)} {...props} />;
}

export function CardHeader({ className, title, description, action, titleAs: Title = 'h2' }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6', className)}>
      <div className="min-w-0">
        <Title className="text-base font-semibold text-ink">{title}</Title>
        {description && <p className="mt-0.5 text-sm text-paper-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }) {
  return <div className={cn('px-5 pt-4 pb-5 sm:px-6', className)} {...props} />;
}
