"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, TrendingUp, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/utils";
import { generateChannelInsightsAction } from "@/lib/actions/ai";
import type { RangeKey } from "@/lib/analytics/ranges";

type Result = {
  markdown: string;
  projection: {
    viewsNextPeriod: number;
    subscribersNextPeriod: number;
    revenueNextPeriod: number;
    confidenceTrend: number | null;
  };
};

export function InsightsCard({
  channelId,
  range,
}: {
  channelId: string;
  range: RangeKey;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  const onGenerate = () => {
    startTransition(async () => {
      const res = await generateChannelInsightsAction(channelId, range);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data!);
      toast.success("AI insights ready");
    });
  };

  return (
    <Card className="border-indigo-500/30 bg-indigo-500/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles
              className="h-4 w-4 text-indigo-500"
              strokeWidth={1.75}
            />
            AI insights &amp; growth forecast
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Summary, recommendations, and a next-period projection — generated
            by Claude from the analytics in the current window.
          </p>
        </div>
        <Button size="sm" onClick={onGenerate} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          )}
          {isPending ? "Analyzing…" : result ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>

      {result && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Projection
              icon={TrendingUp}
              label="Projected views (next period)"
              value={formatNumber(result.projection.viewsNextPeriod)}
              trend={result.projection.confidenceTrend}
            />
            <Projection
              icon={Users}
              label="Projected net subscribers"
              value={formatNumber(result.projection.subscribersNextPeriod)}
            />
            <Projection
              icon={DollarSign}
              label="Projected revenue"
              value={`$${result.projection.revenueNextPeriod.toLocaleString(
                undefined,
                { maximumFractionDigits: 2 }
              )}`}
            />
          </div>
          <div className="prose prose-sm prose-invert max-w-none dark:prose-invert">
            <MarkdownBlock markdown={result.markdown} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Projection({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={1.75} />
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2 pt-0.5">
        <div className="text-base font-semibold tabular-nums">{value}</div>
        {trend !== null && trend !== undefined && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            trend {formatPercent(trend, 0)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Intentionally tiny: only handles what Claude is told to emit —
 * ## headings, bulleted lists, and paragraphs. Keeps bundle small
 * and avoids XSS risk from a real markdown parser.
 */
function MarkdownBlock({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      nodes.push(
        <ul
          key={nodes.length}
          className="list-disc space-y-1 pl-5 text-sm text-foreground"
        >
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };
  const flushPara = () => {
    if (paragraphBuffer.length) {
      const text = paragraphBuffer.join(" ").trim();
      if (text)
        nodes.push(
          <p key={nodes.length} className="text-sm leading-relaxed">
            {renderInline(text)}
          </p>
        );
      paragraphBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushList();
      flushPara();
      nodes.push(
        <h3
          key={nodes.length}
          className="pt-2 text-sm font-semibold tracking-tight"
        >
          {h2[1]}
        </h3>
      );
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      listBuffer.push(bullet[1]);
      continue;
    }
    flushList();
    paragraphBuffer.push(line);
  }
  flushList();
  flushPara();

  return <div className="space-y-2">{nodes}</div>;
}

// Extremely small inline formatter: **bold** only (Claude rarely uses italics).
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold">
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
