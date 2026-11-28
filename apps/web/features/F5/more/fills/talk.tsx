"use client";
// 差し込み口の先：AI と話す・右のパネルの「〈名〉のAI」（持ち主の葉 K-764。器 slots.tsx と帯・右のパネルのファイルは触らない）。
//   帯の［AI と話す］（止まった帯の［直し方を AI に伝える］は出さない・代表の決め answer=4d049789b537）：窓の合図 OPEN_AI_TAB_EVENT を出すだけ（口は呼ばない）。パネルを開いてタブを替えるのは詳細の側
//   （ticket-detail.tsx）。合図を受ける詳細が無い（横の詳細・右のパネルが無い）ときは、そのチケットの詳細を ?ai=1 で開く。
//   タブ「〈名〉のAI」：押すと onTab("ai")。タブの中身：題名の下の帯の写し（.k-room-mband・767 以下だけ出る・room.css）→ TicketTalkPanel
//   （AI のタブを開いて初めて会話を読む）。帯の写しは詳細の側が TicketBandCopy で渡す（スマホの AI の画面は本文の区画を出さないので）
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/k";
import { readTicket, ticketKey } from "@/features/F5/approve-complete/band";
import { TicketTalkPanel } from "@/features/F5/room/ticket-talk-panel";
import type { TalkActProps, TicketAiTabButtonProps, TicketAiTabProps } from "../slots";

/** 帯のボタンが出す窓の合図（detail は { ticketId }）。詳細が受けたら preventDefault する */
export const OPEN_AI_TAB_EVENT = "kaname:f5:open-ai-tab";
export interface OpenAiTabDetail {
  ticketId: string;
}

// ---- 書く欄への焦点：合図の後にタブの中身が描かれてから置く（中身が読み終わる前に合図が来るので、置きたいことを覚えておく）
let focusWanted = false;
/** 次に AI のタブの書く欄が描かれたら焦点を置く */
export function wantComposerFocus(): void {
  focusWanted = true;
}
/** 覚えていた焦点の願いを 1 回だけ取り出す */
export function takeComposerFocus(): boolean {
  const w = focusWanted;
  focusWanted = false;
  return w;
}

/** 合図を出す。受ける詳細が無ければ（横の詳細）、そのチケットの詳細を ?ai=1 で開く */
export function openAiTab(ticketId: string): void {
  const ev = new CustomEvent<OpenAiTabDetail>(OPEN_AI_TAB_EVENT, { detail: { ticketId }, cancelable: true });
  const unhandled = window.dispatchEvent(ev);
  if (unhandled) window.location.assign(`/tickets/${encodeURIComponent(ticketId)}?ai=1`);
}

export function TalkActFill({ ticketId, kind }: TalkActProps): ReactNode {
  // 止まった帯（kind="fix"）には何も出さない（やり取りで直す）
  if (kind !== "talk") return null;
  return (
    <Button variant="outlined" onClick={() => openAiTab(ticketId)}>
      AI と話す
    </Button>
  );
}

export function TicketAiTabButtonFill({ me, active, onTab }: TicketAiTabButtonProps): ReactNode {
  return (
    <button type="button" {...(active ? { "aria-current": "page" as const } : {})} onClick={() => onTab?.("ai")}>
      <Bot size={14} aria-hidden="true" />
      {`${me}のAI`}
    </button>
  );
}

/** 題名の下の帯の写し（詳細の側が組んだ同じ帯）。AI のタブの中身がタブの直後に .k-room-mband で出す。無ければ出さない */
const TicketBandCopy = createContext<ReactNode>(null);
export const TicketBandCopyProvider = TicketBandCopy.Provider;

interface TicketHead {
  ticket: { number: string; title: string };
}

export function TicketAiTabFill({ ticketId, me }: TicketAiTabProps): ReactNode {
  // 番号と題名は詳細の問い合わせ（同じ鍵）の答えを読む。ここからは口を呼ばない（enabled: false）
  const d = useQuery({
    queryKey: ticketKey(ticketId),
    queryFn: () => readTicket<TicketHead>(ticketId),
    enabled: false,
  });
  const t = d.data?.ticket;
  const band = useContext(TicketBandCopy);
  return (
    <>
      {band ? <div className="k-room-mband">{band}</div> : null}
      <TicketTalkPanel ticketId={ticketId} me={me} number={t?.number ?? ""} title={t?.title ?? ""} />
    </>
  );
}
