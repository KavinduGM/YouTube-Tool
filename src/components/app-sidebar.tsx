"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Settings,
  LineChart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/channels", label: "Channels", icon: BarChart3 },
  { href: "/compare", label: "Compare", icon: TrendingUp },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/30 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border/60 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background">
          <LineChart className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Social Analytics
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        Phase 1 · Analytics
      </div>
    </aside>
  );
}
