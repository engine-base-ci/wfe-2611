"use client";
import { navRoute } from "@/lib/pending-route";
import { Menu } from "lucide-react";
import Link from "next/link";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useShell } from "./context";

/** スマホの下タブ：役割の主ナビの先頭 4 ＋ メニュー（D-064） */
export function TabBar({ menuHref = "/today" }: { menuHref?: string }) {
  const { role, screenId, counts } = useShell();
  const items = (NAV.byRole[role] ?? []).slice(0, 4);
  return (
    <nav className="tabbar" data-role={role} data-requires="app" aria-label="下タブ">
      {items.map((m) => {
        const s = NAV.screens[m as keyof typeof NAV.screens];
        return (
          <Link
            key={m}
            href={navRoute(s.route)}
            className={cn(m === screenId && "on")}
            aria-current={m === screenId ? "page" : undefined}
          >
            {counts[m] ? (
              <span className="bdg" data-requires="data">
                {counts[m]}
              </span>
            ) : null}
            <span>{s.name}</span>
          </Link>
        );
      })}
      <Link href={navRoute(menuHref)}>
        <Menu />
        <span>メニュー</span>
      </Link>
    </nav>
  );
}
