// ベルを押して重なって開くお知らせの箱（キャンバス StOverlay のお知らせ側・D-128.22）。画面は移らない。
//   頭：題・未読の数・絞り込み／中：お知らせの一覧／足：すべて既読にする・過去のお知らせ。幅 767 以下は NoticeSheet に替わる（この箱は隠れる）。
//   一覧の長さ（P3）：新しい順に 20 件ずつ・未読は全部・読んだものは 30 日分まで。多いぶんは「過去のお知らせ」で足す（口の側の決め）。
//   置き場：overlay＝右上に重ねる／inline＝その場に置く（モックで 2 つ並べるとき）。
import { NoticeBody } from "./notice-body";
import { NoticeFilter, type NoticeFilterProps } from "./notice-filter";
import type { NoticeItem, NoticeStatus } from "./notice-types";
import "./notice.css";

export interface NoticePanelProps extends Pick<NoticeFilterProps, "people" | "personId" | "onPerson" | "peopleOpen"> {
  items: readonly NoticeItem[];
  /** 「過去のお知らせ」を開いたあとの、さらに古いお知らせ */
  past?: readonly NoticeItem[] | undefined;
  unread: number;
  onlyUnread: boolean;
  onOnlyUnread?: ((v: boolean) => void) | undefined;
  status?: NoticeStatus | undefined;
  placement?: "overlay" | "inline" | undefined;
  onMarkAll?: (() => void) | undefined;
  onOpenPast?: (() => void) | undefined;
  /** 続きがあるか（false なら「過去のお知らせ」を押せない・既定は押せる） */
  canOpenPast?: boolean | undefined;
  onOpen?: ((item: NoticeItem) => void) | undefined;
  onRetry?: (() => void) | undefined;
  loadingDelayMs?: number | undefined;
}

export function NoticePanel({
  items,
  past,
  unread,
  onlyUnread,
  onOnlyUnread,
  people,
  personId,
  onPerson,
  peopleOpen,
  status = "ready",
  placement = "overlay",
  onMarkAll,
  onOpenPast,
  canOpenPast = true,
  onOpen,
  onRetry,
  loadingDelayMs,
}: NoticePanelProps) {
  return (
    <section className="k-f7-notice" data-placement={placement} aria-label="お知らせ">
      <header className="k-f7-notice-head">
        <h2>お知らせ</h2>
        {unread ? <span className="k-f7-notice-count">未読 {unread}</span> : null}
        <NoticeFilter
          onlyUnread={onlyUnread}
          onOnlyUnread={onOnlyUnread}
          people={people}
          personId={personId}
          onPerson={onPerson}
          peopleOpen={peopleOpen}
        />
      </header>
      <div className="k-f7-notice-scroll">
        <NoticeBody
          status={status}
          items={items}
          past={past}
          onlyUnread={onlyUnread}
          onOpen={onOpen}
          onRetry={onRetry}
          loadingDelayMs={loadingDelayMs}
        />
      </div>
      <footer className="k-f7-notice-foot">
        <button type="button" className="k-f7-notice-link" disabled={unread === 0} onClick={onMarkAll}>
          すべて既読にする
        </button>
        <button
          type="button"
          className="k-f7-notice-link"
          aria-expanded={past !== undefined}
          disabled={past !== undefined || !canOpenPast}
          onClick={onOpenPast}
        >
          過去のお知らせ
        </button>
      </footer>
    </section>
  );
}
