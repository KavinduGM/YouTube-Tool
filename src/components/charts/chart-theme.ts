/**
 * Chart color + style tokens. Keep deliberately muted — minimalist,
 * professional look with good contrast on dark/light backgrounds.
 */
export const CHART_COLORS = {
  primary: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  accent1: "#6366f1", // indigo 500
  accent2: "#06b6d4", // cyan 500
  accent3: "#10b981", // emerald 500
  accent4: "#f59e0b", // amber 500
  accent5: "#ef4444", // red 500
  accent6: "#a855f7", // purple 500
  grid: "hsl(var(--border))",
};

export const CHART_PALETTE = [
  CHART_COLORS.accent1,
  CHART_COLORS.accent2,
  CHART_COLORS.accent3,
  CHART_COLORS.accent4,
  CHART_COLORS.accent5,
  CHART_COLORS.accent6,
];

export const AXIS_STYLE = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};

export const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 12px",
  color: "hsl(var(--popover-foreground))",
};
