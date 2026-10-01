"use client";
import { navRoute } from "@/lib/pending-route";
import { KanameMark } from "@/components/brand/kaname-mark";
import { ChevronDown, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useShell } from "./context";
import { SECTION_ICON } from "./icons";
import { isBuilt } from "@/lib/built-routes";

const RELEASE_NOW = "v1";
/** 開いている分類（この端末の中だけ） */
const OPEN_KEY = "kaname-side-open"; // 先の段階の画面は今の段階のナビに出さない（時点の正直さ）

/** 主ナビ＝6 本の section。役割で本数が変わる。中の画面は by_role（section × 権限）から機械導出（screen-derivation §6） */
export function Sidebar({ who }: { who?: { initials: string; name: string; org: string } }) {
  const { role, screenId, counts } = useShell();
  const allowed = new Set(NAV.byRole[role] ?? []);
  const secOf = (id: string | null) =>
    NAV.sections.find((s) => (s.screens as readonly string[]).includes(id ?? ""))?.key;
  const active = secOf(screenId);
  // 分類は押したものだけ開け閉めする。ほかの分類は開いていればそのまま（2026-09-30 user「トグルで開閉・他を開いても開いたまま」）。
  // 画面を移っても開いたままにする（この端末の中だけ覚える）。いまの画面の分類は必ず開く
  const [opened, setOpened] = useState<Set<string>>(() => new Set(active ? [active] : []));
  // アイコンだけの細いサイドバー（三画面・タブレット）は横に飛び出すので、最後に押した 1 つだけ出す
  const [last, setLast] = useState<string | null>(active ?? null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as string[];
      setOpened((cur) => new Set([...saved, ...cur]));
    } catch {
      /* 覚えていなくても動く */
    }
  }, []);
  const toggle = (key: string) => {
    setOpened((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        /* 覚えられなくても開け閉めはできる */
      }
      return next;
    });
    setLast(key);
  };
  return (
    <aside className="side" data-role={role} data-requires="app" aria-label="主ナビ">
      <div className="side-brand">
        <KanameMark className="side-mark" />
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
            const r = NAV.screens[m as keyof typeof NAV.screens].route;
            // まだ作っていない画面は押させない（押すと 404 の行き止まりになる）。設計にはあるので隠さず「準備中」と出す
            if (!isBuilt(r))
              return (
                <span key={key} className="side-item soon" aria-disabled="true" data-soon={m}>
                  <Icon /> <span>{sec.label}</span>
                  <span className="soon-tag">準備中</span>
                </span>
              );
            return (
              <Link
                key={key}
                href={navRoute(r)}
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
          const expanded = opened.has(key);
          return (
            <div key={key} className="side-group">
              <button
                type="button"
                className={cn("side-item side-grp", expanded && "open")}
                aria-expanded={expanded}
                onClick={() => toggle(key)}
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
              <div className="side-sub" hidden={!expanded} data-last={last === key ? "" : undefined}>
                {hit.map((m) => {
                  const s = NAV.screens[m as keyof typeof NAV.screens];
                  if (!isBuilt(s.route))
                    return (
                      <span key={m} className="soon" aria-disabled="true" data-soon={m}>
                        <span>{s.name}</span>
                        <span className="soon-tag">準備中</span>
                      </span>
                    );
                  return (
                    <Link
                      key={m}
                      href={navRoute(s.route)}
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
