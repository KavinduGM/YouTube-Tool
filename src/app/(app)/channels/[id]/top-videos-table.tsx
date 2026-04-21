import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { getTopVideosByRange } from "@/lib/analytics/queries";
import type { RangeKey } from "@/lib/analytics/ranges";
import { SortLink } from "./sort-link";

export async function TopVideosTable({
  channelId,
  range,
  defaultSort,
}: {
  channelId: string;
  range: RangeKey;
  defaultSort: "views" | "likes" | "comments" | "published";
}) {
  const videos = await getTopVideosByRange(channelId, range, defaultSort, 20);

  if (videos.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No videos in this range
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Video</TableHead>
          <TableHead className="text-right">
            <SortLink keyName="views" current={defaultSort}>Views</SortLink>
          </TableHead>
          <TableHead className="text-right">
            <SortLink keyName="likes" current={defaultSort}>Likes</SortLink>
          </TableHead>
          <TableHead className="text-right">
            <SortLink keyName="comments" current={defaultSort}>
              Comments
            </SortLink>
          </TableHead>
          <TableHead className="text-right">
            <SortLink keyName="published" current={defaultSort}>
              Published
            </SortLink>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {videos.map((v) => (
          <TableRow key={v.id}>
            <TableCell className="max-w-0">
              <div className="flex items-start gap-3">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded-sm border border-border/60 object-cover"
                  />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded-sm border border-border/60 bg-muted" />
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {v.isShort && (
                      <Badge variant="outline" className="shrink-0">
                        Short
                      </Badge>
                    )}
                    <a
                      href={`https://youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="line-clamp-2 text-sm hover:underline"
                    >
                      {v.title}
                    </a>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {formatNumber(v.viewCount)}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {formatNumber(v.likeCount)}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {formatNumber(v.commentCount)}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
              {format(v.publishedAt, "MMM d, yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
