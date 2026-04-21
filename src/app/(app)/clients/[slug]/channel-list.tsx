"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  Loader2,
  RefreshCw,
  Unplug,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformBadge } from "@/components/platform-badge";
import { ChannelFormDialog } from "./channel-form-dialog";
import { deleteChannel } from "@/lib/actions/channels";
import {
  syncYouTubeChannelAction,
  disconnectYouTubeChannelAction,
} from "@/lib/actions/youtube";

type Channel = {
  id: string;
  platform: "YOUTUBE" | "LINKEDIN";
  displayName: string;
  handle: string | null;
  externalId: string | null;
  url: string | null;
  connected: boolean;
  lastSyncedAt: Date | null;
  syncStatus?: "IDLE" | "SYNCING" | "SUCCESS" | "ERROR" | null;
  syncError?: string | null;
};

export function ChannelList({
  clientId,
  channels,
}: {
  clientId: string;
  channels: Channel[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState<Channel | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  // Surface OAuth callback results
  useEffect(() => {
    const err = params.get("yt_error");
    const ok = params.get("yt_connected");
    if (err) {
      toast.error(`YouTube connection failed: ${err}`);
      const next = new URLSearchParams(params.toString());
      next.delete("yt_error");
      router.replace(`?${next.toString()}`, { scroll: false });
    } else if (ok) {
      toast.success("YouTube channel connected");
      const next = new URLSearchParams(params.toString());
      next.delete("yt_connected");
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }, [params, router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild size="sm">
          <a href={`/api/youtube/oauth/start?clientId=${clientId}`}>
            <Youtube className="h-4 w-4" strokeWidth={1.75} />
            Connect YouTube
          </a>
        </Button>
        <Button variant="outline" onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add manually
        </Button>
      </div>

      {channels.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {channels.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onEdit={() => setEditing(ch)}
              onDelete={() => setDeleting(ch)}
            />
          ))}
        </div>
      )}

      <ChannelFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
      />

      <ChannelFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        clientId={clientId}
        channel={editing ?? undefined}
      />

      <DeleteDialog channel={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function ChannelCard({
  channel,
  onEdit,
  onDelete,
}: {
  channel: Channel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnecting, startDisconnect] = useTransition();

  const connectHref =
    channel.platform === "YOUTUBE"
      ? `/api/youtube/oauth/start?channelId=${channel.id}`
      : undefined;

  const onSync = () => {
    startSync(async () => {
      toast.info("Syncing YouTube data…", { id: `sync-${channel.id}` });
      const res = await syncYouTubeChannelAction(channel.id);
      if (!res.ok) {
        toast.error(res.error, { id: `sync-${channel.id}` });
        return;
      }
      toast.success(`Synced — wrote ${res.data?.rowsWritten ?? 0} rows`, {
        id: `sync-${channel.id}`,
      });
      router.refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectYouTubeChannelAction(channel.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Channel disconnected");
      setDisconnectOpen(false);
      router.refresh();
    });
  };

  const syncBadge = (() => {
    if (channel.syncStatus === "SYNCING")
      return <Badge variant="warning">Syncing</Badge>;
    if (channel.syncStatus === "ERROR")
      return <Badge variant="destructive">Sync error</Badge>;
    if (channel.connected) return <Badge variant="success">Connected</Badge>;
    return <Badge variant="muted">Not connected</Badge>;
  })();

  return (
    <>
      <Card className="transition-colors hover:bg-card/60">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <PlatformBadge platform={channel.platform} />
              {syncBadge}
            </div>
            <div className="space-y-0.5">
              <div className="truncate font-medium">{channel.displayName}</div>
              {channel.handle && (
                <div className="truncate text-xs text-muted-foreground">
                  {channel.handle}
                </div>
              )}
            </div>

            {channel.syncError && (
              <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
                <span className="line-clamp-2">{channel.syncError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {channel.lastSyncedAt ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
                  Synced{" "}
                  {formatDistanceToNow(channel.lastSyncedAt, {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span>Never synced</span>
              )}
              {channel.url && (
                <a
                  href={channel.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                  Visit
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {channel.platform === "YOUTUBE" && !channel.connected && (
                <Button asChild size="sm">
                  <a href={connectHref}>
                    <Link2 className="h-4 w-4" strokeWidth={1.75} />
                    Connect YouTube
                  </a>
                </Button>
              )}
              {channel.platform === "YOUTUBE" && channel.connected && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    {isSyncing ? "Syncing…" : "Sync now"}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/channels/${channel.id}`}>
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                      View data
                    </Link>
                  </Button>
                </>
              )}
              {channel.platform === "LINKEDIN" && (
                <Button variant="outline" size="sm" disabled>
                  <Link2 className="h-4 w-4" strokeWidth={1.75} />
                  Upload CSV (Milestone 4)
                </Button>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1">
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
                Edit details
              </DropdownMenuItem>
              {channel.platform === "YOUTUBE" && channel.connected && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setDisconnectOpen(true);
                  }}
                >
                  <Unplug className="h-4 w-4" strokeWidth={1.75} />
                  Disconnect
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect YouTube</DialogTitle>
            <DialogDescription>
              This revokes our stored tokens for <strong>{channel.displayName}</strong>.
              Previously synced analytics are kept. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteDialog({
  channel,
  onClose,
}: {
  channel: Channel | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    if (!channel) return;
    startTransition(async () => {
      const res = await deleteChannel(channel.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Channel removed");
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={!!channel} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove channel</DialogTitle>
          <DialogDescription>
            This removes <strong>{channel?.displayName}</strong> and all collected
            analytics for it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
