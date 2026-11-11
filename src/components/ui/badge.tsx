import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ring-1 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary ring-primary/25",
        success: "bg-success/15 text-success-soft-foreground ring-success/25",
        warning: "bg-warning/15 text-warning-soft-foreground ring-warning/25",
        danger: "bg-danger/15 text-danger-soft-foreground ring-danger/25",
        info: "bg-info/15 text-info-soft-foreground ring-info/25",
        gold: "bg-gold/15 text-gold-soft-foreground ring-gold/25",
        neutral: "bg-muted text-muted-foreground ring-line/15",
        outline: "bg-transparent text-muted-foreground ring-line/15",
        primary: "bg-primary text-primary-foreground ring-primary",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };