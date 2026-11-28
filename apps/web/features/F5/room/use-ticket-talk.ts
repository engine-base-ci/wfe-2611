"use client";
// チケットの右のパネル「〈名〉のAI」の読みと言う（K-764）：チケットの会話の口（K-763）を呼ぶだけ。DB・外・PC に直に触らない。
//   読む：getTicketAgentSession（鍵 ["k764", "session", <チケット>]・AI のタブを開くまで読まない）。答えは K-757 の ConversationView と同じ 6 つの鍵。
//   言う：sendTicketAgentMessage（体 { text }）。会話が無いときも同じ口（口が会話を作る）。答えを待つ間の二度押しは 1 回にする。
//   止めるは K-762 の useStop（会話の id）
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import type { ConversationView } from "./talk-words";
import { POLL_MS, TalkError } from "./use-talk";

const SCREEN = "tickets";

export const ticketSessionKey = (ticketId: string) => ["k764", "session", ticketId] as const;

const signedIn = (): boolean => typeof window !== "undefined" && Boolean(getToken());

/** チケットの会話。open が偽の間は読まない。poll は流れが使えない間だけ（作業中なら 5 秒ごとに見に行く） */
export function useTicketSession(ticketId: string, open: boolean, poll: boolean) {
  return useQuery({
    queryKey: ticketSessionKey(ticketId),
    enabled: open && signedIn(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (q) => {
      const v = q.state.data;
      return poll && v && (v.work !== null || v.running_job_id !== null) ? POLL_MS : false;
    },
    queryFn: async (): Promise<ConversationView> => {
      const r = await call("getTicketAgentSession", { screenId: SCREEN, params: { id: ticketId } });
      if (!r.ok) throw new TalkError(r.status, r.code);
      return r.data as unknown as ConversationView;
    },
  });
}

export type TicketSayResult = { ok: true } | { ok: false; err: CallErr };

/** 言う。答えを待つ間に押し直しても口は 1 回 */
export function useTicketSay(ticketId: string) {
  const busy = useRef(false);
  const m = useMutation({
    mutationFn: async (text: string): Promise<TicketSayResult> => {
      // 体は { text } だけ（K-763 の口の入力）
      const body = { text } as unknown as Ops["sendTicketAgentMessage"]["body"];
      const r = await call("sendTicketAgentMessage", { screenId: SCREEN, params: { id: ticketId }, body });
      return r.ok ? { ok: true } : { ok: false, err: r };
    },
  });
  const say = async (text: string): Promise<TicketSayResult | null> => {
    if (busy.current) return null;
    busy.current = true;
    try {
      return await m.mutateAsync(text);
    } finally {
      busy.current = false;
    }
  };
  return { say, pending: m.isPending };
}
