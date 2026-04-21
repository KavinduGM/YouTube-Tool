import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Line,
  renderToBuffer,
  Font,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ChannelReportData } from "./monthly-data";

// -------------------------------------------------------------------------
// Style tokens — minimalist, professional, Grayscale + a single accent
// -------------------------------------------------------------------------

const COLORS = {
  ink: "#0f172a", // slate-900
  muted: "#64748b", // slate-500
  line: "#e2e8f0", // slate-200
  bg: "#f8fafc", // slate-50
  accent: "#4f46e5", // indigo-600
  green: "#10b981",
  red: "#ef4444",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: COLORS.ink,
    fontSize: 10,
    fontFamily: "Helvetica",
    padding: 36,
    lineHeight: 1.4,
  },
  h1: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.ink,
    marginBottom: 4,
  },
  h2: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    color: COLORS.ink,
  },
  h3: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 4,
    color: COLORS.ink,
  },
  small: {
    fontSize: 9,
    color: COLORS.muted,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: `1pt solid ${COLORS.line}`,
    paddingBottom: 8,
    marginBottom: 16,
  },
  brandLeft: { flexDirection: "column" },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginTop: 8,
  },
  kpiCard: {
    width: "25%",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  kpiCardInner: {
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    padding: 10,
    border: `1pt solid ${COLORS.line}`,
  },
  kpiLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 3,
  },
  table: {
    marginTop: 6,
    border: `1pt solid ${COLORS.line}`,
    borderRadius: 4,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: COLORS.bg,
    borderBottom: `1pt solid ${COLORS.line}`,
    padding: 6,
  },
  tr: {
    flexDirection: "row",
    padding: 6,
    borderBottom: `1pt solid ${COLORS.line}`,
  },
  th: { fontWeight: "bold", fontSize: 9 },
  td: { fontSize: 9 },
  narrative: {
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.bg,
    border: `1pt solid ${COLORS.line}`,
    borderRadius: 4,
  },
  narrativePara: { marginBottom: 4 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, textAlign: "center" },
  bulletText: { flex: 1 },
  projection: {
    marginTop: 8,
    padding: 12,
    border: `1pt solid ${COLORS.accent}`,
    borderRadius: 4,
    backgroundColor: "#eef2ff",
  },
  projectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.accent,
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    color: COLORS.muted,
    fontSize: 8,
  },
});

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtMinutes(n: number): string {
  if (n >= 60) {
    const h = Math.floor(n / 60);
    return `${fmt(h)}h`;
  }
  return `${fmt(n)}m`;
}

// -------------------------------------------------------------------------
// SVG bar chart (6 months)
// -------------------------------------------------------------------------

function BarChart({
  data,
  width = 500,
  height = 140,
  color = COLORS.accent,
  label,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}) {
  const paddingLeft = 36;
  const paddingRight = 8;
  const paddingTop = 16;
  const paddingBottom = 28;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = chartW / data.length;

  return (
    <Svg width={width} height={height}>
      {/* Baseline */}
      <Line
        x1={paddingLeft}
        y1={paddingTop + chartH}
        x2={paddingLeft + chartW}
        y2={paddingTop + chartH}
        stroke={COLORS.line}
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = (d.value / max) * chartH;
        const x = paddingLeft + i * barW + barW * 0.2;
        const y = paddingTop + chartH - h;
        const w = barW * 0.6;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={w} height={Math.max(1, h)} fill={color} />
            <Text
              x={x + w / 2}
              y={paddingTop + chartH + 14}
              style={{ fontSize: 8, textAnchor: "middle", fill: COLORS.muted }}
            >
              {d.label}
            </Text>
            <Text
              x={x + w / 2}
              y={y - 3}
              style={{
                fontSize: 7,
                textAnchor: "middle",
                fill: COLORS.ink,
              }}
            >
              {fmt(d.value)}
            </Text>
          </React.Fragment>
        );
      })}
      {label && (
        <Text
          x={paddingLeft}
          y={paddingTop - 4}
          style={{ fontSize: 9, fill: COLORS.muted }}
        >
          {label}
        </Text>
      )}
    </Svg>
  );
}

// -------------------------------------------------------------------------
// Narrative rendering (very small markdown subset)
// -------------------------------------------------------------------------

function Narrative({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];

  const flushPara = () => {
    if (paragraph.length) {
      nodes.push(
        <Text key={nodes.length} style={styles.narrativePara}>
          {paragraph.join(" ")}
        </Text>
      );
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushPara();
      nodes.push(
        <Text key={nodes.length} style={styles.h3}>
          {h2[1]}
        </Text>
      );
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      nodes.push(
        <View key={nodes.length} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{bullet[1]}</Text>
        </View>
      );
      continue;
    }
    paragraph.push(line);
  }
  flushPara();
  return <View>{nodes}</View>;
}

// -------------------------------------------------------------------------
// Full PDF document
// -------------------------------------------------------------------------

export function MonthlyReportDocument({
  clientName,
  reportMonthLabel,
  channels,
  generatedAt,
}: {
  clientName: string;
  reportMonthLabel: string;
  channels: ChannelReportData[];
  generatedAt: Date;
}) {
  return (
    <Document title={`${clientName} — ${reportMonthLabel} report`}>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <View style={{ marginTop: 180 }}>
          <Text style={{ fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase" }}>
            6-Month Analytics Report
          </Text>
          <Text style={{ fontSize: 28, fontWeight: "bold", marginTop: 6 }}>
            {clientName}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.muted, marginTop: 2 }}>
            {reportMonthLabel}
          </Text>

          <View style={{ marginTop: 32, paddingTop: 16, borderTop: `1pt solid ${COLORS.line}` }}>
            <Text style={styles.small}>
              Covers {channels[0]?.monthsCovered?.[0]?.label} through{" "}
              {channels[0]?.monthsCovered?.[5]?.label}.
            </Text>
            <Text style={styles.small}>
              {channels.length} YouTube channel{channels.length === 1 ? "" : "s"}.
            </Text>
            <Text style={styles.small}>
              Generated {generatedAt.toISOString().slice(0, 10)}.
            </Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text>{clientName} · Monthly report</Text>
          <Text>Social Analytics</Text>
        </View>
      </Page>

      {/* One section per channel */}
      {channels.map((ch, i) => (
        <Page key={ch.channel.id} size="A4" style={styles.page} wrap>
          <View style={styles.metaRow}>
            <View style={styles.brandLeft}>
              <Text style={styles.h1}>{ch.channel.displayName}</Text>
              <Text style={styles.small}>
                {ch.channel.handle ?? ""}{" "}
                {ch.channel.externalId && `· ${ch.channel.externalId}`}
              </Text>
            </View>
            <Text style={styles.small}>
              {ch.monthsCovered[0].label} – {ch.monthsCovered[5].label}
            </Text>
          </View>

          <Text style={styles.h2}>Lifetime standing</Text>
          <View style={styles.kpiGrid}>
            <KPI
              label="Subscribers"
              value={
                ch.latestSnapshot.subscribers != null
                  ? fmt(ch.latestSnapshot.subscribers)
                  : "—"
              }
            />
            <KPI
              label="Total views"
              value={
                ch.latestSnapshot.viewCount != null
                  ? fmt(ch.latestSnapshot.viewCount)
                  : "—"
              }
            />
            <KPI
              label="Videos"
              value={
                ch.latestSnapshot.videoCount != null
                  ? fmt(ch.latestSnapshot.videoCount)
                  : "—"
              }
            />
            <KPI
              label="6-mo net subs"
              value={fmt(ch.sixMonthTotals.netSubscribers)}
            />
          </View>

          <Text style={styles.h2}>6-month totals</Text>
          <View style={styles.kpiGrid}>
            <KPI label="Views" value={fmt(ch.sixMonthTotals.views)} />
            <KPI
              label="Watch time"
              value={fmtMinutes(ch.sixMonthTotals.watchTimeMinutes)}
            />
            <KPI
              label="Engagement"
              value={fmt(
                ch.sixMonthTotals.likes + ch.sixMonthTotals.comments
              )}
            />
            <KPI
              label="Revenue"
              value={fmtCurrency(ch.sixMonthTotals.estimatedRevenue)}
            />
          </View>

          <Text style={styles.h2}>Monthly views</Text>
          <BarChart
            data={ch.monthly.map((m) => ({ label: m.label, value: m.views }))}
            color={COLORS.accent}
          />

          <Text style={styles.h2}>Monthly net subscribers</Text>
          <BarChart
            data={ch.monthly.map((m) => ({
              label: m.label,
              value: m.netSubscribers,
            }))}
            color={COLORS.green}
          />

          <Text style={styles.h2}>By month</Text>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 2 }]}>Month</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Views</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Watch (m)</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Net subs</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Revenue</Text>
            </View>
            {ch.monthly.map((m) => (
              <View key={m.label} style={styles.tr}>
                <Text style={[styles.td, { flex: 2 }]}>{m.label}</Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                  {fmt(m.views)}
                </Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                  {fmt(m.watchTimeMinutes)}
                </Text>
                <Text
                  style={[
                    styles.td,
                    {
                      flex: 1,
                      textAlign: "right",
                      color: m.netSubscribers >= 0 ? COLORS.green : COLORS.red,
                    },
                  ]}
                >
                  {m.netSubscribers >= 0 ? "+" : ""}
                  {fmt(m.netSubscribers)}
                </Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                  {fmtCurrency(m.estimatedRevenue)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.projection} wrap={false}>
            <Text style={styles.projectionTitle}>
              Next-month projection ({nextMonthLabel(ch.monthsCovered[5].label)})
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>Views</Text>
                <Text style={styles.kpiValue}>
                  {fmt(ch.predictionNextMonth.views)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>Net subscribers</Text>
                <Text style={styles.kpiValue}>
                  {fmt(ch.predictionNextMonth.netSubscribers)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>Revenue</Text>
                <Text style={styles.kpiValue}>
                  {fmtCurrency(ch.predictionNextMonth.revenue)}
                </Text>
              </View>
            </View>
            {ch.predictionNextMonth.trendPct !== null && (
              <Text style={[styles.small, { marginTop: 4 }]}>
                Recent trend:{" "}
                {ch.predictionNextMonth.trendPct >= 0 ? "+" : ""}
                {ch.predictionNextMonth.trendPct.toFixed(1)}% half-over-half.
                Linear projection — assumes trend continues.
              </Text>
            )}
          </View>

          {ch.narrative && (
            <>
              <Text style={styles.h2}>Executive summary</Text>
              <View style={styles.narrative}>
                <Narrative markdown={ch.narrative} />
              </View>
            </>
          )}

          {/* Top videos */}
          {ch.topVideos.length > 0 && (
            <>
              <Text style={styles.h2}>Top videos</Text>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.th, { flex: 4 }]}>Title</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                    Views
                  </Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                    Likes
                  </Text>
                  <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>
                    Published
                  </Text>
                </View>
                {ch.topVideos.map((v, j) => (
                  <View key={j} style={styles.tr}>
                    <Text style={[styles.td, { flex: 4 }]} wrap>
                      {v.title}
                    </Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                      {fmt(v.views)}
                    </Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                      {fmt(v.likes)}
                    </Text>
                    <Text
                      style={[styles.td, { flex: 1.2, textAlign: "right" }]}
                    >
                      {v.publishedAt}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.footer} fixed>
            <Text>
              {clientName} · {ch.channel.displayName}
            </Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiCardInner}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue}>{value}</Text>
      </View>
    </View>
  );
}

function nextMonthLabel(lastLabel: string) {
  // lastLabel is like "Dec 2024"
  const [monStr, yearStr] = lastLabel.split(" ");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const idx = months.indexOf(monStr);
  if (idx < 0) return lastLabel;
  const nextIdx = (idx + 1) % 12;
  const nextYear = nextIdx === 0 ? Number(yearStr) + 1 : Number(yearStr);
  return `${months[nextIdx]} ${nextYear}`;
}

/** Silence "declared but not read" on Font import — we rely on the default. */
export const __fontReserved = Font;

/** Render the React-PDF tree to a Buffer. */
export async function renderReportPdf(
  doc: React.ReactElement
): Promise<Buffer> {
  // The underlying renderer only consumes a <Document>; the concrete prop
  // shape on our component wrapper differs from DocumentProps, so we cast.
  return renderToBuffer(doc as React.ReactElement<DocumentProps>);
}
