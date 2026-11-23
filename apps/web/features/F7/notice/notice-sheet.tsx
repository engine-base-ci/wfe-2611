// スマホのお知らせ（キャンバス MbNotify・幅 767 以下）。上の帯と下のタブは残し、その間を全面で使う。
//   「‹ お知らせ」「すべて既読」・札 3 つ（未読 N・すべて・@ N）・「未読だけ」「人で絞る ▾」・箱に入れたお知らせの並び。広い幅では出ない（NoticePanel が出る）。
import { ChevronLeft } from "lucide-react";
import { NoticeBody } from "./notice-body";
import { NoticeFilter, type NoticeFilterProps } from "./notice-filter";
import type { NoticeItem, NoticeStatus } from "./notice-types";
import "./notice.css";

export type NoticeSheetFilter = "unread" | "all" | "mention";

export interface NoticeSheetProps extends Pick<NoticeFilterProps, "people" | "personId" | "onPerson" | "peopleOpen"> {
  /** 札で絞った後の並び（絞るのは呼ぶ側） */
  items: readonly NoticeItem[];
  filter: NoticeSheetFilter;
  unread: number;
  mentions: number;
  /** 「未読だけ」のチェック（広い幅の箱と同じ絞り。札の「未読」と同じ向きで効く） */
  onlyUnread?: boolean | undefined;
  onOnlyUnread?: ((v: boolean) => void) | undefined;
  status?: NoticeStatus | undefined;
  onFilter?: ((f: NoticeSheetFilter) => void) | undefined;
  onBack?: (() => void) | undefined;
  onMarkAll?: (() => void) | undefined;
  onOpen?: ((item: NoticeItem) => void) | undefined;
  onRetry?: (() => void) | undefined;
  loadingDelayMs?: number | undefined;
}

export function NoticeSheet({
  items,
  filter,
  unread,
  mentions,
  onlyUnread,
  onOnlyUnread,
  people,
  personId,
  onPerson,
  peopleOpen,
  status = "ready",
  onFilter,
  onBack,
  onMarkAll,
  onOpen,
  onRetry,
  loadingDelayMs,
}: NoticeSheetProps) {
  const chips: { key: NoticeSheetFilter; label: string }[] = [
    { key: "unread", label: unread ? `未読 ${unread}` : "未読" },
    { key: "all", label: "すべて" },
    { key: "mention", label: mentions ? `@ ${mentions}` : "@" },
  ];
  return (
    <section className="k-f7-notice-sheet" aria-label="お知らせ">
      <header className="k-f7-notice-sheet-head">
        <button type="button" className="k-f7-notice-sheet-back" aria-label="戻る" onClick={onBack}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2>お知らせ</h2>
        <button type="button" className="k-f7-notice-link" disabled={unread === 0} onClick={onMarkAll}>
          すべて既読
        </button>
      </header>
      <div className="k-f7-notice-sheet-body">
        <div className="k-f7-notice-chips" role="group" aria-label="お知らせの絞り込み">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="k-f7-notice-chip"
              aria-pressed={filter === c.key}
              onClick={() => onFilter?.(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <NoticeFilter
          onlyUnread={onlyUnread ?? filter === "unread"}
          onOnlyUnread={onOnlyUnread}
          people={people}
          personId={personId}
          onPerson={onPerson}
          peopleOpen={peopleOpen}
        />
        <div className="k-f7-notice-card">
          <NoticeBody
            status={status}
            items={items}
            onlyUnread={filter === "unread"}
            onOpen={onOpen}
            onRetry={onRetry}
            loadingDelayMs={loadingDelayMs}
          />
        </div>
      </div>
    </section>
  );
}
