"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, cn } from "@/lib/utils";
import { RangeSelector } from "@/components/range-selector";
import {
  AXIS_STYLE,
  CHART_COLORS,
  CHART_PALETTE,
  TOOLTIP_STYLE,
} from "@/components/charts/chart-theme";
import { isRangeKey, type RangeKey } from "@/lib/analytics/ranges";
import {
  getCompareDataAction,
  type CompareMetric,
} from "@/lib/actions/compare";

type ChannelOption = {
  id: string;
  displayName: string;
  clientName: string;
  connected: boolean;
};

const METRIC_OPTIONS: {
  value: CompareMetric;
  label: string;
  formatter?: (v: number) => string;
}[] = [
  { value: "views", label: "Views" },
  {
    value: "watchTimeMinutes",
    label: "Watch time (min)",
  },
  {
    value: "subscribersGained",
    label: "Subscribers gained",
  },
  {
    value: "estimatedRevenue",
    label: "Revenue ($)",
    formatter: (v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  },
];

export function CompareClient({ channels }: { channels: ChannelOption[] }) {
  const params = useSearchParams();
  const rawRange = params.get("range");
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : "28d";
  const [metric, setMetric] = useState<CompareMetric>("views");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(channels.slice(0, Math.min(3, channels.length)).map((c) => c.id))
  );
  const [data, setData] = useState<{
    series: Array<Record<string, string | number>>;
    totals: Record<string, number>;
  }>({ series: [], totals: {} });
  const [isPending, startTransition] = useTransition();

  const selectedList = useMemo(
    () => channels.filter((c) => selected.has(c.id)),
    [channels, selected]
  );

  useEffect(() => {
    if (selectedList.length === 0) {
      setData({ series: [], totals: {} });
      return;
    }
    startTransition(async () => {
      const res = await getCompareDataAction(
        Array.from(selected),
        range,
        metric
      );
      if (res.ok) setData(res.data!);
    });
  }, [range, metric, selected, selectedList.length]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentMetric = METRIC_OPTIONS.find((m) => m.value === metric)!;
  const fmt = currentMetric.formatter ?? ((v: number) => formatNumber(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <RangeSelector
          current={range}
          basePath="/compare"
          queryKey="range"
        />
        <Select value={metric} onValueChange={(v) => setMetric(v as CompareMetric)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Channels ({selected.size})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            <div className="flex justify-end gap-1 pb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set(channels.map((c) => c.id)))}
                disabled={selected.size === channels.length}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                None
              </Button>
            </div>
            <div className="max-h-[420px] space-y-0.5 overflow-y-auto">
              {channels.map((c, idx) => {
                const isSelected = selected.has(c.id);
                const color =
                  CHART_PALETTE[
                    Array.from(selected).indexOf(c.id) % CHART_PALETTE.length
                  ];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full border border-border/60"
                      style={{
                        backgroundColor: isSelected ? color : "transparent",
                      }}
                    />
                    <span className="flex-1 truncate">
                      <span className="block truncate font-medium text-foreground">
                        {c.displayName}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {c.clientName}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="h-3 w-3" strokeWidth={2} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {currentMetric.label} over time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedList.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
                Select at least one channel to compare
              </div>
            ) : data.series.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
                No analytics data for the selected channels in this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart
                  data={data.series}
                  margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => format(parseISO(String(v)), "MMM d")}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => fmt(Number(v))}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(v) =>
                      format(parseISO(String(v)), "MMM d, yyyy")
                    }
                    formatter={(value, name) => {
                      const ch = channels.find((c) => c.id === name);
                      return [fmt(Number(value)), ch?.displayName ?? name];
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => {
                      const ch = channels.find((c) => c.id === v);
                      return (
                        <span className="text-xs text-muted-foreground">
                          {ch?.displayName ?? String(v)}
                        </span>
                      );
                    }}
                  />
                  {selectedList.map((c, i) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Totals · {currentMetric.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {selectedList
                .map((c, i) => ({
                  ...c,
                  color: CHART_PALETTE[i % CHART_PALETTE.length],
                  total: data.totals[c.id] ?? 0,
                }))
                .sort((a, b) => b.total - a.total)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="truncate">{c.displayName}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {c.clientName}
                      </span>
                    </div>
                    <span className="tabular-nums">{fmt(c.total)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
