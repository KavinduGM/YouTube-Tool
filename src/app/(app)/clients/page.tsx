import Link from "next/link";
import { Users, Plus, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformBadge } from "@/components/platform-badge";
import { NewClientButton } from "./new-client-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients · Social Analytics" };

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      channels: {
        select: { id: true, platform: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage client profiles and attach their social channels.
          </p>
        </div>
        <NewClientButton />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Create your first client to start tracking channels and analytics."
          action={<NewClientButton label="Create your first client" />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const yt = c.channels.filter((ch) => ch.platform === "YOUTUBE").length;
                  const li = c.channels.filter((ch) => ch.platform === "LINKEDIN").length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/clients/${c.slug}`}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.slug}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.industry ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {yt > 0 && (
                            <PlatformBadge platform="YOUTUBE" />
                          )}
                          {li > 0 && <PlatformBadge platform="LINKEDIN" />}
                          {yt === 0 && li === 0 && (
                            <span className="text-xs text-muted-foreground">
                              None attached
                            </span>
                          )}
                          {yt + li > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {yt + li} total
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/clients/${c.slug}`}>
                            Open
                            <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
