"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "views" | "likes" | "comments" | "published";

export function SortLink({
  keyName,
  current,
  children,
}: {
  keyName: SortKey;
  current: SortKey;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const active = current === keyName;

  const onClick = () => {
    const next = new URLSearchParams(params.toString());
    next.set("sort", keyName);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {active && <ArrowDown className="h-3 w-3" strokeWidth={2} />}
    </button>
  );
}
