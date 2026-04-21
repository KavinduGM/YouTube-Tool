"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Youtube,
  Users,
  Video as VideoIcon,
  Eye,
  Loader2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import {
  linkYouTubeChannelsFromPending,
  cancelPendingYouTubeConnection,
  type DiscoveredChannel,
} from "@/lib/actions/youtube-connect";

export function ChannelPicker({
  pendingId,
  clientSlug,
  channels,
}: {
  pendingId: string;
  clientSlug: string;
  channels: DiscoveredChannel[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(channels.length === 1 ? [channels[0].id] : [])
  );
  const [isLinking, startLink] = useTransition();
  const [isCancelling, startCancel] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(channels.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const onConfirm = () => {
    if (selected.size === 0) {
      toast.error("Pick at least one channel");
      return;
    }
    startLink(async () => {
      const res = await linkYouTubeChannelsFromPending(
        pendingId,
        Array.from(selected)
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const n = res.data?.channelIds.length ?? 0;
      toast.success(
        n === 1
          ? "Connected 1 YouTube channel"
          : `Connected ${n} YouTube channels`
      );
      router.push(`/clients/${clientSlug}`);
      router.refresh();
    });
  };

  const onCancel = () => {
    startCancel(async () => {
      await cancelPendingYouTubeConnection(pendingId);
      toast.info("Connection cancelled");
      router.push(`/clients/${clientSlug}`);
      router.refresh();
    });
  };

  const busy = isLinking || isCancelling;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {selected.size} of {channels.length} selected
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={busy || selected.size === channels.length}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectNone}
            disabled={busy || selected.size === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {channels.map((ch) => {
          const isSelected = selected.has(ch.id);
          const subs = ch.subscriberCount ? Number(ch.subscriberCount) : null;
          const videos = ch.videoCount ? Number(ch.videoCount) : null;
          const views = ch.viewCount ? Number(ch.viewCount) : null;
          return (
            <label
              key={ch.id}
              htmlFor={`ch-${ch.id}`}
              className="cursor-pointer"
            >
              <Card
                className={`relative flex items-start gap-3 p-4 transition-colors ${
                  isSelected
                    ? "border-foreground/40 bg-card"
                    : "hover:bg-card/60"
                }`}
              >
                <input
                  id={`ch-${ch.id}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(ch.id)}
                  disabled={busy}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-foreground"
                />
                {ch.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ch.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-border/60 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted">
                    <Youtube
                      className="h-5 w-5 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{ch.title}</div>
                    {ch.customUrl && (
                      <div className="truncate text-xs text-muted-foreground">
                        {ch.customUrl}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {subs != null && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" strokeWidth={1.75} />
                        {formatNumber(subs)}
                      </span>
                    )}
                    {videos != null && (
                      <span className="inline-flex items-center gap-1">
                        <VideoIcon className="h-3 w-3" strokeWidth={1.75} />
                        {formatNumber(videos)}
                      </span>
                    )}
                    {views != null && (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" strokeWidth={1.75} />
                        {formatNumber(views)}
                      </span>
                    )}
                    {ch.country && (
                      <span className="font-mono">{ch.country}</span>
                    )}
                  </div>
                  {ch.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {ch.description}
                    </p>
                  )}
                </div>
              </Card>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={busy || selected.size === 0}
        >
          {isLinking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" strokeWidth={1.75} />
          )}
          Connect {selected.size > 0 ? `${selected.size} ` : ""}
          channel{selected.size === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
