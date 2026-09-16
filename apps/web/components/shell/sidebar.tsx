"use client";
import { ChevronDown, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useShell } from "./context";
import { SECTION_ICON } from "./icons";

const RELEASE_NOW = "v1"; // 先の段階の画面は今の段階のナビに出さない（時点の正直さ）

/** 主ナビ＝6 本の section。役割で本数が変わる。中の画面は by_role（section × 権限）から機械導出（screen-derivation §6） */
export function Sidebar({ who }: { who?: { initials: string; name: string; org: string } }) {
  const { role, screenId, counts } = useShell();
  const allowed = new Set(NAV.byRole[role] ?? []);
  const secOf = (id: string | null) =>
    NAV.sections.find((s) => (s.screens as readonly string[]).includes(id ?? ""))?.key;
  const active = secOf(screenId);
  const [open, setOpen] = useState<string | null>(active ?? null);
  return (
    <aside className="side" data-role={role} data-requires="app" aria-label="主ナビ">
      <div className="side-brand">
        <span className="side-logo" aria-hidden="true" />
        <span>Kaname</span>
      </div>
      <nav className="side-nav">
        {(NAV.sectionsByRole[role] ?? []).map((key) => {
          const sec = NAV.sections.find((s) => s.key === key)!;
          const hit = sec.screens.filter(
            (m) => allowed.has(m) && NAV.screens[m as keyof typeof NAV.screens]?.release <= RELEASE_NOW,
          );
          if (!hit.length) return null;
          const Icon = SECTION_ICON[sec.icon] ?? FileText;
          const isOn = active === key;
          const total = hit.reduce((n, m) => n + (counts[m] ?? 0), 0);
          if (hit.length === 1) {
            const m = hit[0]!;
            return (
              <Link
                key={key}
                href={NAV.screens[m as keyof typeof NAV.screens].route}
                className={cn("side-item", m === screenId && "on")}
                aria-current={m === screenId ? "page" : undefined}
              >
                <Icon /> <span>{sec.label}</span>
                {total ? (
                  <span className="badge" data-requires="data">
                    {total}
                  </span>
                ) : null}
              </Link>
            );
          }
          const expanded = open === key;
          return (
            <div key={key} className="side-group">
              <button
                type="button"
                className={cn("side-item side-grp", expanded && "open")}
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : key)}
              >
                <Icon /> <span>{sec.label}</span>
                {total && !isOn ? (
                  <span className="badge" data-requires="data">
                    {total}
                  </span>
                ) : null}
                <i className="chev">
                  <ChevronDown />
                </i>
              </button>
              <div className="side-sub" hidden={!expanded}>
                {hit.map((m) => {
                  const s = NAV.screens[m as keyof typeof NAV.screens];
                  return (
                    <Link
                      key={m}
                      href={s.route}
                      className={cn(m === screenId && "on")}
                      aria-current={m === screenId ? "page" : undefined}
                    >
                      <span>{s.name}</span>
                      {counts[m] ? (
                        <span className="badge" data-requires="data">
                          {counts[m]}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      {who ? (
        <div className="side-foot">
          <div className="av">{who.initials}</div>
          <div className="who">
            <div className="nm">{who.name}</div>
            <div className="co">{who.org}</div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
