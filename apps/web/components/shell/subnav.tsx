"use client";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { useShell } from "./context";

/** 第2ナビ＝画面ごとに変える。既定は左の列（絞り込み）。入口画面は anchors（上の帯・押すと段へ送る・隠さない）。三画面と本文が痩せる幅は横チップ（D-070） */
export function SubNav({
  active,
  onSelect,
  actions,
  body,
}: {
  active?: number;
  onSelect?: (i: number) => void;
  actions?: React.ReactNode;
  /** 項目の代わりに出す中身（会話モードの会話の一覧・D-104.1） */
  body?: React.ReactNode;
}) {
  // 見出し（くくり・画面名・説明）は本文の上の帯に 1 つだけ（app-shell の .shead）。ここでは出さない（2026-09-30 user「同じ文章が 2 回」）
  const { screenId, subMode, counts } = useShell();
  if (!screenId) return null;
  const items = NAV.subByScreen[screenId];
  if (!items?.length) return null;
  let lastGroup: string | undefined;
  return (
    <aside className="subnav" data-mode={subMode} data-requires="app" aria-label="第2ナビ">
      {body ? <div className="subnav-b" data-sub-body>{body}</div> : null}
      <div className="subnav-b" hidden={!!body}>
        {items.map((it, i) => {
          const g = it.group && it.group !== lastGroup ? it.group : null;
          if (g) lastGroup = it.group;
          const n = counts[`${screenId}:${it.label}`];
          return (
            <span key={i} className="contents">
              {g ? <div className="subnav-sec">{g}</div> : null}
              <a
                href={subMode === "anchors" ? `#sec-${i}` : undefined}
                role={subMode === "anchors" ? undefined : "tab"}
                aria-selected={subMode === "anchors" ? undefined : i === (active ?? 0)}
                tabIndex={0}
                className={cn("sn", i === (active ?? 0) && "on")}
                title={it.desc}
                onClick={(e) => {
                  if (subMode !== "anchors") e.preventDefault();
                  onSelect?.(i);
                }}
              >
                <span className="sn-l">
                  {it.label}
                  {n ? (
                    <span className="n" data-requires="data">
                      {n}
                    </span>
                  ) : null}
                </span>
                {it.desc ? <span className="sn-d">{it.desc}</span> : null}
              </a>
            </span>
          );
        })}
        {actions ? <span className="sn-acts">{actions}</span> : null}
      </div>
    </aside>
  );
}
