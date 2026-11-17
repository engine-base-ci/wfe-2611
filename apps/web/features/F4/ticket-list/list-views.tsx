// 見え方のタブ（K-251・キャンバス OnHome・Main の header nav）。自分に関わるもの・概要・一覧・カレンダー・ガントの 5 つ。
//   今いるものに aria-current="page"。概要・カレンダー・ガントはまだ無いので、出すが押せない（span・aria-disabled・title に準備中・グレー・D-145.1）
import type { Route } from "next";
import Link from "next/link";
import type { ListView } from "./use-ticket-list";

type Tab = { label: string; view?: ListView; href?: string };
const TABS: Tab[] = [
  { label: "自分に関わるもの", view: "mine", href: "/tickets" },
  { label: "概要" },
  { label: "一覧", view: "all", href: "/tickets?view=all" },
  { label: "カレンダー" },
  { label: "ガント" },
];

export function ListViews({ view }: { view: ListView }) {
  return (
    <nav className="k-list-views" aria-label="チケットの見え方">
      {TABS.map((t) =>
        t.href ? (
          <Link
            key={t.label}
            className="k-list-view"
            href={t.href as Route}
            aria-current={t.view === view ? "page" : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ) : (
          <span key={t.label} className="k-list-view" aria-disabled="true" title={`${t.label}（準備中）`}>
            {t.label}
          </span>
        ),
      )}
    </nav>
  );
}
