"use client";
// 差し込み口の先の配り分け（K-400）。K-380 が詳細と承認待ちに置いた 4 つの名前（DetailScope・AssigneeSlot・HandoverBandSlot・QueueRowSlot）を、
//   区画のファイル（assignee-action・band-*・offer-action・queue-row-*）へ配る。後ろの画面の葉は自分の区画のファイルだけを触り、このファイルは触らない。
//   値は getTicket の答えの handover（今の渡し）と handover_kinds だけ（口を足さない・詳細の口は 6 のまま）。見ている人は外枠と同じ問い合わせの鍵 ["me"]。
//   入口・帯の種類の分け方は use-handovers.ts の 1 か所（役の名前では分けない）。区画が本物になる（READY に種類が入る）までは何も出さず、
//   「出したい」を知らせない（空の区画が保留の帯を譲らせない）
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { BandSlotProps, SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import type { QueueRow } from "@/features/F5/approve-complete/queue";
import type { RowActs } from "@/features/F5/approve-complete/queue-table";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { AssigneeAction } from "./assignee-action";
import { BandDistributed, READY as DISTRIBUTED_READY } from "./band-distributed";
import { BandOffer, READY as OFFER_BAND_READY } from "./band-offer";
import { BandRecipient, READY as RECIPIENT_READY } from "./band-recipient";
import { BandSender, READY as SENDER_READY } from "./band-sender";
import { READY as ACTIONS_READY, SenderFollowBand } from "./band-sender-actions";
import { OfferAction, READY as OFFER_ENTRY_READY } from "./offer-action";
import { QueueRowGroup } from "./queue-row-group";
import { QueueRowOffer } from "./queue-row-offer";
import { QueueRowPass } from "./queue-row-pass";
import {
  ONCE_KINDS,
  assigneeIdOf,
  bandKindOf,
  entryOf,
  handoverOf,
  markSeen,
  rowHandoverKindOf,
  wasClosed,
  wasSeen,
  waitingNoteOf,
  type BandSectionProps,
  type HandoverBandKey,
} from "./use-handovers";
import type { HandoverBandKind } from "./views";

interface Wrap {
  ticket: SlotTicket;
  children: ReactNode;
}

/** 外枠と同じ問い合わせ（同じ鍵・1 画面で 1 回・読み直さない）。口は増えない */
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** 見ている人の member_id（読めるまで null） */
function useMeId(): string | null {
  const signedIn = typeof window !== "undefined" && Boolean(getToken());
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: signedIn, ...ONCE });
  return who.isSuccess ? who.data.member_id : null;
}

/** 帯の種類ごとの区画のファイルと、そのファイルが本物にした種類 */
const BANDS: Record<
  HandoverBandKind,
  { Band: (props: BandSectionProps) => ReactNode; ready: readonly HandoverBandKey[] }
> = {
  sending: { Band: BandSender, ready: SENDER_READY },
  "read-failed": { Band: BandSender, ready: SENDER_READY },
  overdue: { Band: SenderFollowBand, ready: ACTIONS_READY },
  declined: { Band: SenderFollowBand, ready: ACTIONS_READY },
  receiving: { Band: BandRecipient, ready: RECIPIENT_READY },
  accepted: { Band: BandRecipient, ready: RECIPIENT_READY },
  taken: { Band: BandRecipient, ready: RECIPIENT_READY },
  gone: { Band: BandRecipient, ready: RECIPIENT_READY },
  offered: { Band: BandOffer, ready: OFFER_BAND_READY },
  offering: { Band: BandOffer, ready: OFFER_BAND_READY },
  "offer-accepted": { Band: BandOffer, ready: OFFER_BAND_READY },
  "offer-declined": { Band: BandOffer, ready: OFFER_BAND_READY },
  distributed: { Band: BandDistributed, ready: DISTRIBUTED_READY },
  group: { Band: BandDistributed, ready: DISTRIBUTED_READY },
};

/** 区画をまたぐ状態の入れ物（DOM を足さない）。小窓の開け閉めをまたぐ状態が要る葉が後で足す */
export function DetailScope({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 右のパネルの「担当」の「担当者」の値（children＝今の顔と名前）。入口が pass・distribute のときだけ区画へ */
export function AssigneeSlot({ ticket, children }: Wrap): ReactNode {
  const meId = useMeId();
  const { handover, kinds } = useMemo(() => handoverOf(ticket.detail), [ticket.detail]);
  const assignee = assigneeIdOf(ticket.detail);
  const entry = entryOf(kinds, assignee !== null && assignee === meId);
  if (entry !== "pass" && entry !== "distribute") return <>{children}</>;
  return (
    <AssigneeAction
      ticket={ticket}
      entry={entry}
      note={waitingNoteOf(handover, meId)}
      blocked={ticket.bands.has("approve")}
      fallback={children}
    />
  );
}

/** 題名の下の帯の入れ物の中・F5 の 2 つの帯の後（渡しの帯と、担当者でない人の申し出の入口） */
export function HandoverBandSlot({ ticket, yieldTo, onWant }: BandSlotProps): ReactNode {
  const meId = useMeId();
  const { handover, kinds, invalid } = useMemo(() => handoverOf(ticket.detail), [ticket.detail]);
  const assignee = assigneeIdOf(ticket.detail);
  // 出し方の覚え（この画面にいる間）：取り消された帯は「待っているのを見ていた人」だけ・1 回だけの帯は開いた時点の手元の覚えで決める
  const memo = useRef({ receiving: new Set<string>(), seen: new Map<string, boolean>() });
  let kind: HandoverBandKind | null = invalid ? "read-failed" : bandKindOf(handover, meId);
  if (handover && kind) {
    const m = memo.current;
    if (kind === "receiving") m.receiving.add(handover.id);
    if (!m.seen.has(handover.id)) m.seen.set(handover.id, wasSeen(handover.id));
    if (kind === "gone" && !m.receiving.has(handover.id)) kind = null;
    else if (ONCE_KINDS.has(kind) && m.seen.get(handover.id)) kind = null;
    else if (kind === "declined" && wasClosed(handover.id)) kind = null;
  }
  const offerEntry = kind === null && entryOf(kinds, assignee !== null && assignee === meId) === "offer";
  const ready =
    kind !== null ? BANDS[kind].ready.includes(kind) : offerEntry && OFFER_ENTRY_READY.includes("offer-entry");
  const shown = ready && yieldTo === null;
  const handoverId = handover?.id ?? null;
  const once = kind !== null && ONCE_KINDS.has(kind);
  useEffect(() => {
    onWant(ready);
    return () => onWant(false);
  }, [ready, onWant]);
  useEffect(() => {
    if (shown && once && handoverId) markSeen(handoverId);
  }, [shown, once, handoverId]);
  if (!shown) return null;
  if (kind === null) return <OfferAction ticket={ticket} />;
  const Band = BANDS[kind].Band;
  return <Band handover={handover} kind={kind} ticket={ticket} />;
}

/** 承認待ちの行の 1 つずつ（children＝今の行）。渡しの行（kind が handover）だけ、渡しの種類で区画へ */
export function QueueRowSlot({
  row,
  acts,
  children,
}: {
  row: QueueRow;
  acts: RowActs;
  children: ReactNode;
}): ReactNode {
  if (row.kind !== "handover") return <>{children}</>;
  switch (rowHandoverKindOf(row)) {
    case "pass":
      return <QueueRowPass row={row} acts={acts} fallback={children} />;
    case "offer":
      return <QueueRowOffer row={row} acts={acts} fallback={children} />;
    case "distribute":
      return <QueueRowGroup row={row} acts={acts} fallback={children} />;
    default:
      return <>{children}</>;
  }
}
