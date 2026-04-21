import { Youtube, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlatformBadge({
  platform,
  size = "sm",
  className,
}: {
  platform: "YOUTUBE" | "LINKEDIN";
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = platform === "YOUTUBE" ? Youtube : Linkedin;
  const label = platform === "YOUTUBE" ? "YouTube" : "LinkedIn";
  const sz = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <Icon className={sz} strokeWidth={1.75} />
      {label}
    </span>
  );
}
