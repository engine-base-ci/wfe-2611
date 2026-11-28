"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav.legacy";
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
  const { screenId, subMode, counts, subOpen, setSubOpen } = useShell();
  // 動きは、中身（一覧）が付いて閉じた状態を 1 度描いてから（付いた瞬間に横帯から引き出しへ変わるので、そのまま動かすと一瞬滑って消える）
  const hasBody = !!body;
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (!hasBody) {
      setAnim(false);
      return;
    }
    let id2 = 0;
    const id = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setAnim(true));
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(id2);
    };
  }, [hasBody]);
  // 1179 以下では、中身（会話の一覧）は左からの引き出し（D-064.7）。見出しの行の「会話の一覧」で開き、選ぶ・外を押す・Esc で閉じる
  useEffect(() => {
    if (!body || !subOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSubOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [body, subOpen, setSubOpen]);
  if (!screenId) return null;
  const items = NAV.subByScreen[screenId];
  if (!items?.length) return null;
  let lastGroup: string | undefined;
  return (
    <>
      {body ? <div className="sub-scrim" hidden={!subOpen} onClick={() => setSubOpen(false)} data-sub-scrim /> : null}
      <aside
        className={cn("subnav", body && "has-body", body && subOpen && "open")}
        data-mode={subMode}
        data-requires="app"
        aria-label="第2ナビ"
        id="subnav"
        data-anim={anim ? "" : undefined}
      >
        {body ? (
          <div
            className="subnav-b"
            data-sub-body
            onClick={(e) => {
              // 一覧で会話を選んだ・新しく話す → 引き出しを閉じて会話へ
              if ((e.target as Element).closest(".tl-open, .tl-new")) setSubOpen(false);
            }}
          >
            {body}
          </div>
        ) : null}
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
    </>
  );
}
