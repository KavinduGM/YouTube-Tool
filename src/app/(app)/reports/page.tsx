import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listReports,
  listReportableClients,
} from "@/lib/actions/reports";
import { getAppSettings } from "@/lib/actions/settings";
import { GenerateReportButton } from "./generate-button";

export const dynamic = "force-dynamic";

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default async function ReportsPage() {
  const [clients, reports, settings] = await Promise.all([
    listReportableClients(),
    listReports(50),
    getAppSettings(),
  ]);

  const recipients = (settings.report_recipients ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const dayOfMonth = settings.report_day_of_month ?? "1";
  const timezone = settings.report_timezone ?? "UTC";
  const resendConfigured =
    !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Automated 6-month analytics PDFs, delivered by email. Generate on
          demand or let the scheduler send them on the{" "}
          <span className="font-medium text-foreground">
            {dayOfMonth}
            {ordinalSuffix(Number(dayOfMonth) || 1)}
          </span>{" "}
          of every month ({timezone}).
        </p>
      </div>

      {!resendConfigured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <Mail
              className="mt-0.5 h-4 w-4 text-amber-500"
              strokeWidth={1.75}
            />
            <div>
              <CardTitle className="text-sm">
                Email delivery not configured
              </CardTitle>
              <CardDescription>
                Set <code className="rounded bg-muted px-1 text-xs">RESEND_API_KEY</code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 text-xs">RESEND_FROM</code>{" "}
                in the environment. Report generation will fail until these are
                present.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Recipients"
          value={`${recipients.length}`}
          sub={recipients.length === 0 ? "None configured" : recipients[0] + (recipients.length > 1 ? ` +${recipients.length - 1}` : "")}
        />
        <StatCard
          label="Clients with channels"
          value={`${clients.filter((c) => c.youtubeChannelCount > 0).length}`}
          sub={`${clients.length} total`}
        />
        <StatCard
          label="Reports sent (all time)"
          value={`${reports.filter((r) => r.status === "SENT").length}`}
          sub={`${reports.filter((r) => r.status === "FAILED").length} failed`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" strokeWidth={1.75} />
            Generate a report now
          </CardTitle>
          <CardDescription>
            Builds a 6-month PDF for the previous calendar month and emails it
            to the configured recipients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add a client and connect at least one YouTube channel before generating reports."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/clients">Go to clients</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/60">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.youtubeChannelCount} YouTube channel
                      {c.youtubeChannelCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <GenerateReportButton
                    clientId={c.id}
                    disabled={
                      c.youtubeChannelCount === 0 ||
                      recipients.length === 0 ||
                      !resendConfigured
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Delivery history</CardTitle>
            <CardDescription>
              Last 50 runs across all clients, newest first.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
              Scheduler settings
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Generated and scheduled reports will appear here with their delivery status."
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Report month
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Channels
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Size</th>
                    <th className="px-3 py-2 text-left font-medium">Trigger</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-border/60 align-top"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/clients/${r.clientSlug}`}
                          className="font-medium hover:underline"
                        >
                          {r.clientName}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r.reportMonthLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.channelCount}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatBytes(r.pdfBytes)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            r.triggeredBy === "scheduled" ? "secondary" : "muted"
                          }
                        >
                          {r.triggeredBy}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                        {r.errorMessage && (
                          <div className="mt-1 max-w-sm truncate text-xs text-destructive">
                            {r.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {relativeTime(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {value}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {sub}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "SENT" | "FAILED" }) {
  if (status === "SENT")
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Sent
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3" strokeWidth={2} />
        Failed
      </Badge>
    );
  return (
    <Badge variant="muted">
      <Clock className="h-3 w-3" strokeWidth={2} />
      Pending
    </Badge>
  );
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
