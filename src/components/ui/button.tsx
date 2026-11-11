import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-gradient text-primary-foreground shadow-sm hover:shadow-md hover:brightness-105",
        secondary:
          "bg-surface/70 text-primary ring-1 ring-line/15 hover:bg-primary/10",
        edit: "bg-edit-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        detail: "bg-detail-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        outline: "bg-surface/60 ring-1 ring-line/15 hover:bg-primary/5 hover:text-foreground",
        ghost: "hover:bg-primary/10 hover:text-primary",
        destructive: "bg-danger-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        gold: "bg-warning-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        success: "bg-confirm-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9",
        compact: "h-8 rounded-lg px-2.5 text-xs font-medium",
        "mobile-lg": "h-11 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };