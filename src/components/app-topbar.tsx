"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppTopbar() {
  const { data } = useSession();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Dashboard
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card">
            <User className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
          <span className="hidden text-muted-foreground sm:inline">
            {data?.user?.email ?? "Admin"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
