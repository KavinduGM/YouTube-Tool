import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercent, cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  kind = "number",
}: {
  label: string;
  value: number | null;
  delta: number | null; // percent, can be negative
  kind?: "number" | "currency" | "duration" | "percent";
}) {
  const valueStr =
    value === null
      ? "—"
      : kind === "currency"
        ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : kind === "duration"
          ? fmtDuration(value)
          : kind === "percent"
            ? `${value.toFixed(1)}%`
            : formatNumber(value);

  const tone =
    delta === null
      ? "neutral"
      : delta > 0
        ? "up"
        : delta < 0
          ? "down"
          : "flat";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="truncate text-2xl font-semibold tabular-nums">
            {valueStr}
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              tone === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              tone === "down" && "bg-red-500/10 text-red-600 dark:text-red-400",
              (tone === "flat" || tone === "neutral") &&
                "bg-muted text-muted-foreground"
            )}
            title={
              delta === null
                ? "No prior-period data"
                : `vs previous period`
            }
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
            {delta === null ? "—" : formatPercent(delta, 1)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0s";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
