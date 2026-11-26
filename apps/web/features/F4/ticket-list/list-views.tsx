// 見え方のタブ（K-251・キャンバス OnHome・Main の header nav）。自分に関わるもの・概要・一覧・カレンダー・ガントの 5 つ。
//   今いるものに aria-current="page"。概要・カレンダー・ガントは区画が本物になるまで（F7 の viewReady が false）出すが押せない
//   （span・aria-disabled・title に準備中・グレー・D-145.1）。本物になったらリンク（グループを選んでいれば scope を足す・K-600）
import type { Route } from "next";
import Link from "next/link";
import { viewReady, type F7View } from "@/features/F7/list-slots";
import type { ListView } from "./use-ticket-list";

type Tab = { label: string; view: ListView };
const TABS: Tab[] = [
  { label: "自分に関わるもの", view: "mine" },
  { label: "概要", view: "overview" },
  { label: "一覧", view: "all" },
  { label: "カレンダー", view: "calendar" },
  { label: "ガント", view: "gantt" },
];

const isF7 = (v: ListView): v is F7View => v === "overview" || v === "calendar" || v === "gantt";

/** タブのリンク。押せない見え方は null。概要・カレンダー・ガントは、グループを選んでいれば scope を足す（自分に関わるもの・一覧は今のまま） */
function hrefOf(view: ListView, scope: string | null): string | null {
  if (view === "mine") return "/tickets";
  if (view === "all") return "/tickets?view=all";
  if (isF7(view) && !viewReady(view)) return null;
  const q = new URLSearchParams({ view });
  if (scope) q.set("scope", scope);
  return `/tickets?${q.toString()}`;
}

export function ListViews({ view, scope = null }: { view: ListView; scope?: string | null }) {
  return (
    <nav className="k-list-views" aria-label="チケットの見え方">
      {TABS.map((t) => {
        const href = hrefOf(t.view, scope);
        return href ? (
          <Link
            key={t.label}
            className="k-list-view"
            href={href as Route}
            aria-current={t.view === view ? "page" : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ) : (
          <span key={t.label} className="k-list-view" aria-disabled="true" title={`${t.label}（準備中）`}>
            {t.label}
          </span>
        );
      })}
    </nav>
  );
}
