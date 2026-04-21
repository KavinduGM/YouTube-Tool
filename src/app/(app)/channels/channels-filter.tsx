"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlatformFilter = "YOUTUBE" | "LINKEDIN" | undefined;

export function ChannelsFilter({
  initialPlatform,
  initialQuery,
}: {
  initialPlatform: PlatformFilter;
  initialQuery: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);

  const apply = (next: { platform?: PlatformFilter; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const platform = next.platform !== undefined ? next.platform : initialPlatform;
    const q = next.q !== undefined ? next.q : query;

    if (platform) params.set("platform", platform);
    else params.delete("platform");

    if (q) params.set("q", q);
    else params.delete("q");

    startTransition(() => {
      router.push(`/channels${params.toString() ? `?${params}` : ""}`);
    });
  };

  const pill = (label: string, value: PlatformFilter) => {
    const active = initialPlatform === value;
    return (
      <button
        key={label}
        type="button"
        onClick={() => apply({ platform: active ? undefined : value })}
        className={cn(
          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          active
            ? "border-foreground/40 bg-foreground text-background"
            : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {pill("All", undefined)}
        {pill("YouTube", "YOUTUBE")}
        {pill("LinkedIn", "LINKEDIN")}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: query });
        }}
        className="relative w-full sm:w-80"
      >
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channel, handle, or client"
          className="pl-8 pr-8"
        />
        {query && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1 h-7 w-7"
            onClick={() => {
              setQuery("");
              apply({ q: "" });
            }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        )}
      </form>
    </div>
  );
}
