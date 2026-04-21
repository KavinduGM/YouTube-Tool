"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGE_LABEL, RANGE_ORDER, type RangeKey } from "@/lib/analytics/ranges";
import { cn } from "@/lib/utils";

export function RangeSelector({
  current,
  basePath,
  queryKey = "range",
}: {
  current: RangeKey;
  basePath?: string; // if set, router.push to this path with ?range=
  queryKey?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const onPick = (r: RangeKey) => {
    const next = new URLSearchParams(params.toString());
    next.set(queryKey, r);
    startTransition(() => {
      const url = `${basePath ?? ""}?${next.toString()}`;
      router.push(url, { scroll: false });
    });
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border/60 bg-background p-0.5 text-xs",
        isPending && "opacity-70"
      )}
    >
      {RANGE_ORDER.map((r) => {
        const active = r === current;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            className={cn(
              "rounded px-2.5 py-1 transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {shortLabel(r)}
          </button>
        );
      })}
    </div>
  );
}

function shortLabel(r: RangeKey): string {
  switch (r) {
    case "7d":
      return "7d";
    case "28d":
      return "28d";
    case "90d":
      return "90d";
    case "180d":
      return "6mo";
    case "365d":
      return "12mo";
    case "all":
      return "All";
  }
}

export { RANGE_LABEL };
