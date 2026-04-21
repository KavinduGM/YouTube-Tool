"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateAppSettings } from "@/lib/actions/settings";

export function SettingsForm({
  initial,
}: {
  initial: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [day, setDay] = useState(initial.report_day_of_month ?? "1");
  const [hour, setHour] = useState(initial.sync_daily_hour_utc ?? "3");
  const [tz, setTz] = useState(initial.report_timezone ?? "UTC");
  const [recipients, setRecipients] = useState(
    initial.report_recipients ?? ""
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateAppSettings({
        report_day_of_month: day,
        report_timezone: tz,
        report_recipients: recipients,
        sync_daily_hour_utc: hour,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Settings saved");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Day of month (1–28)</Label>
          <Input
            type="number"
            min={1}
            max={28}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Reports cover the prior 6 calendar months and are sent on this day.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone (IANA)</Label>
          <Input
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="UTC"
          />
          <p className="text-xs text-muted-foreground">
            e.g. <code className="rounded bg-muted px-1">UTC</code>,{" "}
            <code className="rounded bg-muted px-1">America/New_York</code>.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Recipients (comma-separated emails)</Label>
        <Textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="you@example.com, team@example.com"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          Reports are sent to every address here, for every client.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Daily sync hour (UTC, 0–23)</Label>
        <Input
          type="number"
          min={0}
          max={23}
          value={hour}
          onChange={(e) => setHour(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The background worker syncs every connected channel at this UTC hour
          each day.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
