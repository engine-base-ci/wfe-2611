// お知らせの一覧の中身（箱とスマホの全面で同じ）：読み込み中・読めない・空・行の並び。過去のお知らせは区切りの下に足す。
//   読めないは正本の E-PAGE-007（文は正本の 1 件・errorText）。空の文は案（下絵の一覧 B2）。
import { Empty, ErrorState, Loading, PAGE_ERROR } from "@/components/k";
import { NoticeRow } from "./notice-row";
import type { NoticeItem, NoticeStatus } from "./notice-types";

export interface NoticeBodyProps {
  status: NoticeStatus;
  items: readonly NoticeItem[];
  /** 「過去のお知らせ」を開いたあとだけ。新しい順の続き */
  past?: readonly NoticeItem[] | undefined;
  /** 「未読だけ」で絞っている（空の文を変える） */
  onlyUnread: boolean;
  onOpen?: ((item: NoticeItem) => void) | undefined;
  onRetry?: (() => void) | undefined;
  /** 読み込み中を出すまでの待ち（既定は 3 秒より長いときだけ・モックは 0） */
  loadingDelayMs?: number | undefined;
}

function Rows({ items, onOpen }: { items: readonly NoticeItem[]; onOpen?: ((item: NoticeItem) => void) | undefined }) {
  return (
    <ul className="k-f7-notice-list" role="list">
      {items.map((it) => (
        <li key={it.id}>
          <NoticeRow item={it} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

export function NoticeBody({ status, items, past, onlyUnread, onOpen, onRetry, loadingDelayMs }: NoticeBodyProps) {
  if (status === "loading")
    return (
      <div className="k-f7-notice-state">
        <Loading {...(loadingDelayMs === undefined ? {} : { delayMs: loadingDelayMs })} />
      </div>
    );
  if (status === "failed")
    return (
      <div className="k-f7-notice-state">
        <ErrorState code={PAGE_ERROR.loadFailed} acts={onRetry ? [onRetry] : []} />
      </div>
    );
  if (items.length === 0 && !past?.length)
    return (
      <div className="k-f7-notice-state">
        {onlyUnread ? (
          <Empty title="未読のお知らせはありません">「未読だけ」を外すと、読んだお知らせも見られます</Empty>
        ) : (
          <Empty title="お知らせはまだありません">
            承認を待つもの・@ されたもの・止まったものがあると、ここに出ます
          </Empty>
        )}
      </div>
    );
  return (
    <>
      <Rows items={items} onOpen={onOpen} />
      {past?.length ? (
        <>
          <h3 className="k-f7-notice-past-head">過去のお知らせ</h3>
          <Rows items={past} onOpen={onOpen} />
        </>
      ) : null}
    </>
  );
}
