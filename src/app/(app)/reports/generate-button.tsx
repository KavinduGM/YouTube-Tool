"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAndSendMonthlyReportAction } from "@/lib/actions/reports";

export function GenerateReportButton({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const busy = isPending || isLoading;

  const onClick = () => {
    setIsLoading(true);
    startTransition(async () => {
      try {
        const res = await generateAndSendMonthlyReportAction(clientId);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(
          `Report delivered to ${res.data?.recipients.length ?? 0} recipient${
            (res.data?.recipients.length ?? 0) === 1 ? "" : "s"
          }`
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate report"
        );
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <Button
      onClick={onClick}
      size="sm"
      variant="outline"
      disabled={disabled || busy}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Send className="h-4 w-4" strokeWidth={1.75} />
      )}
      {busy ? "Generating…" : "Generate & email"}
    </Button>
  );
}
