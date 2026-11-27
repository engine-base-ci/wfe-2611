// お知らせの 1 行（丸い印・文・番号と時刻・札）。行き先があれば Link（全画面の読み直しをしない）、無ければ button（押すと既読になるだけ）。
//   未読は淡い橙の面と少し太い字（色だけで伝えない・読み上げにも「未読」を伝える）。
import type { Route } from "next";
import Link from "next/link";
import { NoticeTag } from "./notice-tag";
import type { NoticeItem } from "./notice-types";

export function NoticeRow({ item, onOpen }: { item: NoticeItem; onOpen?: ((item: NoticeItem) => void) | undefined }) {
  const body = (
    <>
      <span className="k-f7-notice-av" data-tone={item.avatar.tone} aria-hidden="true">
        {item.avatar.initial}
      </span>
      <span className="k-f7-notice-main">
        <span className="k-f7-notice-text">
          {item.unread ? <span className="sr-only">未読、</span> : null}
          {item.text}
        </span>
        <span className="k-f7-notice-meta">{item.label ? `${item.label} ・ ${item.when}` : item.when}</span>
      </span>
      <span className="k-f7-notice-tag">
        <NoticeTag kind={item.kind} />
      </span>
    </>
  );
  const open = onOpen ? () => onOpen(item) : undefined;
  return item.href ? (
    <Link className="k-f7-notice-row" data-unread={item.unread || undefined} href={item.href as Route} onClick={open}>
      {body}
    </Link>
  ) : (
    <button type="button" className="k-f7-notice-row" data-unread={item.unread || undefined} onClick={open}>
      {body}
    </button>
  );
}
