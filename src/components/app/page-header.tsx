"use client";

import { cn } from "@/lib/utils";
import { ModuleChip } from "@/components/app/module-chip";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <ModuleChip />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
