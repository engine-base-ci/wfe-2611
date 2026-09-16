"use client";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { useShell } from "./context";

/** 第2ナビ＝画面ごとに変える。既定は左の列（絞り込み）。入口画面は anchors（上の帯・押すと段へ送る・隠さない）。三画面と本文が痩せる幅は横チップ（D-070） */
export function SubNav({
  active,
  onSelect,
  actions,
}: {
  active?: number;
  onSelect?: (i: number) => void;
  actions?: React.ReactNode;
}) {
  const { screenId, subMode, counts, layout } = useShell();
  if (!screenId) return null;
  const items = NAV.subByScreen[screenId];
  const s = NAV.screens[screenId];
  if (!items?.length) return null;
  const crumb = NAV.sections.find((x) => (x.screens as readonly string[]).includes(screenId))?.label ?? "";
  let lastGroup: string | undefined;
  return (
    <aside className="subnav" data-mode={subMode} data-requires="app" aria-label="第2ナビ">
      {layout !== "threepane" ? (
        <div className="subnav-h">
          <div className="crumb">{crumb}</div>
          <div className="ttl">{s.name}</div>
          <div className="why">{s.purpose}</div>
        </div>
      ) : null}
      <div className="subnav-b">
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
