"use client";
// 書き込みから決定にする入口（K-392 が受ける物を広げ、中身は K-398）。
//   書き込みの行の下に「決定にする」（書ける人・人の書き込み・決定の元でない）か「✓ 決定にした」（やり取りの口の答え message.decided のとおり）を置き、
//   押すと決定の小窓（元の書き込みの箱つき）を開く。小窓の送り方・決めた人の候補・確かめは「決定を足す」と同じ（decisions/use-decisions.ts）で、体に source_message_id を足す。
//   決定の元の書き込みへ動く openMessage（区画の「元：やり取り … →」から呼ぶ）もここに置く。
import { useCallback, useRef, type ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { mmddTime } from "@/features/F4/create-ticket/detail-head";
import { useAddDecision, useDecisions, useReloadAll } from "../decisions/use-decisions";
import { DecisionDialog } from "../decisions/views";
import { usePanelTab, type PanelTab } from "../scope";
import type { TimelineItem } from "./to-items";
import { DecideAct, type PostView } from "./views";

export function FromMessageAction(props: { ticket: SlotTicket; item: TimelineItem; post: PostView }): ReactNode {
  const { ticket, item, post } = props;
  const read = useDecisions(ticket.id);
  if (post.decided) return <DecideAct decided />;
  // 決定にできるのは書ける人の、人の書き込み（変更・仕組み・消した跡・AI の実行の 1 枚には無い）
  if (!read.canWrite || item.kind !== "post" || !item.message) return null;
  return <DecideFromMessage ticket={ticket} item={item} body={item.message.body} />;
}

function DecideFromMessage({
  ticket,
  item,
  body,
}: {
  ticket: SlotTicket;
  item: TimelineItem;
  body: string;
}): ReactNode {
  const reload = useReloadAll(ticket.id, ticket.reload);
  // 閉じたら押したボタンへ焦点を戻す（決定になった後はボタンが無いので何もしない）
  const opener = useRef<HTMLElement | null>(null);
  const back = useCallback(
    () =>
      void requestAnimationFrame(() => {
        const el = opener.current;
        if (el?.isConnected) el.focus();
      }),
    [],
  );
  const add = useAddDecision(ticket.id, ticket.me, reload, back, item.id);
  return (
    <>
      <DecideAct
        onDecide={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          add.start();
        }}
      />
      <DecisionDialog
        open={add.open}
        from={{ who: item.actor?.display_name ?? "", time: mmddTime(item.at), text: body }}
        text={body}
        by={add.by}
        people={add.people}
        {...(add.peopleFailed ? { peopleFailed: add.peopleFailed } : {})}
        {...(add.notice ? { notice: add.notice } : {})}
        {...(add.errors ? { errors: add.errors } : {})}
        busy={add.busy}
        onCancel={add.cancel}
        onSubmit={(v) => void add.submit(v)}
      />
    </>
  );
}

// ---------------------------------------------------------------- 元の書き込みへ
/** 探す間の上限（描画の 1 コマごとに見る。前の書き込みを足す読み込みを待つ長さ） */
const FIND_FRAMES = 600;
const MORE_OLDER = "#ticket-talk .k-talk-more:not(:disabled):not([aria-disabled=true])";

/** やり取りのタブを開き、その書き込み（msg-<id>）が見える所まで動いて焦点を置く。前の書き込みに隠れていれば「前の書き込みを見る」を押して探す */
export function openMessage(setTab: ((tab: PanelTab) => void) | undefined, id: string): void {
  setTab?.("talk");
  let frames = 0;
  const step = () => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
      return;
    }
    if (++frames > FIND_FRAMES) return;
    document.querySelector<HTMLElement>(MORE_OLDER)?.click();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** 区画の「元：やり取り … →」から呼ぶ関数（メッセージの id を受ける） */
export function useOpenMessage(): (id: string) => void {
  const scope = usePanelTab();
  const setTab = scope?.setTab;
  return useCallback((id: string) => openMessage(setTab, id), [setTab]);
}
