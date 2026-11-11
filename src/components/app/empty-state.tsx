import { InboxIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/15 bg-surface/50 px-6 py-14 text-center backdrop-blur-xl">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-line/10">
        <InboxIcon className="h-6 w-6" />
      </div>
      <p className="font-headline-sm text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}