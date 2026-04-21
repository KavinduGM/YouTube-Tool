import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { getAppSettings } from "@/lib/actions/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const settings = await getAppSettings();

  const integrations = [
    {
      label: "Google OAuth (YouTube)",
      configured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.YOUTUBE_REDIRECT_URI,
      env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"],
    },
    {
      label: "Anthropic (AI insights & reports)",
      configured: !!process.env.ANTHROPIC_API_KEY,
      env: ["ANTHROPIC_API_KEY"],
    },
    {
      label: "Resend (email delivery)",
      configured: !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM,
      env: ["RESEND_API_KEY", "RESEND_FROM"],
    },
    {
      label: "Redis (job scheduling)",
      configured: !!process.env.REDIS_URL,
      env: ["REDIS_URL"],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account, integrations, and report scheduling.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your admin profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={session?.user?.email ?? "—"} />
          <Row label="Name" value={session?.user?.name ?? "—"} />
          <Row label="Role" value={session?.user?.role ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Configured via environment variables on the server. See{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {integrations.map((i) => (
            <div
              key={i.label}
              className="flex items-center justify-between border-b border-border/60 py-2 last:border-none"
            >
              <div className="space-y-0.5">
                <div className="font-medium">{i.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {i.env.join(", ")}
                </div>
              </div>
              {i.configured ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                  Configured
                </Badge>
              ) : (
                <Badge variant="muted">
                  <XCircle className="h-3 w-3" strokeWidth={2} />
                  Not configured
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly report schedule</CardTitle>
          <CardDescription>
            When automated 6-month analytics reports are generated and emailed
            to recipients for every client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
