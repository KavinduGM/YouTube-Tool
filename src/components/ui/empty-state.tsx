import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="max-w-sm text-xs text-muted-foreground">{description}</div>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
