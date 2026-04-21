import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-background text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-500",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive",
        outline: "text-foreground border-border/60",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
