"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createChannel, updateChannel } from "@/lib/actions/channels";

type Platform = "YOUTUBE" | "LINKEDIN";

type ChannelRecord = {
  id: string;
  platform: Platform;
  displayName: string;
  externalId: string | null;
  handle: string | null;
  url: string | null;
};

export function ChannelFormDialog({
  open,
  onOpenChange,
  clientId,
  channel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  channel?: ChannelRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [platform, setPlatform] = useState<Platform>(channel?.platform ?? "YOUTUBE");

  useEffect(() => {
    if (open) {
      setPlatform(channel?.platform ?? "YOUTUBE");
      setErrors({});
    }
  }, [open, channel]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const data = {
      clientId,
      platform,
      displayName: String(fd.get("displayName") ?? ""),
      externalId: String(fd.get("externalId") ?? ""),
      handle: String(fd.get("handle") ?? ""),
      url: String(fd.get("url") ?? ""),
    };

    startTransition(async () => {
      const res = channel
        ? await updateChannel(channel.id, data)
        : await createChannel(data);

      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }

      toast.success(channel ? "Channel updated" : "Channel added");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {channel ? "Edit channel" : "Add channel"}
          </DialogTitle>
          <DialogDescription>
            {channel
              ? "Update the stored channel metadata."
              : "Attach a social channel to this client. Connect it to a data source later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Platform">
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as Platform)}
              disabled={!!channel}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YOUTUBE">YouTube</SelectItem>
                <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Display name" error={errors.displayName}>
            <Input
              name="displayName"
              defaultValue={channel?.displayName ?? ""}
              required
              maxLength={200}
              placeholder={
                platform === "YOUTUBE"
                  ? "e.g. Acme Official"
                  : "e.g. Acme Corp Company Page"
              }
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Handle"
              hint={platform === "YOUTUBE" ? "@handle" : "vanity"}
              error={errors.handle}
            >
              <Input
                name="handle"
                defaultValue={channel?.handle ?? ""}
                maxLength={200}
                placeholder={platform === "YOUTUBE" ? "@acme" : "acme-corp"}
              />
            </Field>
            <Field
              label="External ID"
              hint="Optional"
              error={errors.externalId}
            >
              <Input
                name="externalId"
                defaultValue={channel?.externalId ?? ""}
                maxLength={200}
                placeholder={
                  platform === "YOUTUBE" ? "UC..." : "company-urn"
                }
              />
            </Field>
          </div>

          <Field label="URL" error={errors.url}>
            <Input
              name="url"
              type="url"
              defaultValue={channel?.url ?? ""}
              placeholder={
                platform === "YOUTUBE"
                  ? "https://youtube.com/@acme"
                  : "https://linkedin.com/company/acme-corp"
              }
            />
          </Field>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {channel ? "Save changes" : "Add channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint && !error?.length && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
      {error?.length ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : null}
    </div>
  );
}
