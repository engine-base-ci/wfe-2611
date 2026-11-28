"use client";
// 分身の部屋「話す」の読みと書き（K-762）：会話の口（K-757・K-758・K-73）を呼ぶだけ。DB・外・PC に直に触らない。
//   一覧は listConversations（30 件・続きは読まない）・会話は getConversation。古い行は人が上の端まで巻いたときだけ listConversationMessages。
//   言う：今の会話が無ければ createConversation（体 {}）で作ってから sendConversationMessage（体 { text }）。答えを待つ間の二度押しは 1 回にする。
//   止める：stopConversation（体なし）1 回。答えの形は 11_tickets/K-757.md の「画面が使う答えの形」
import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { olderCursor, type ConversationRow, type ConversationView, type MessageView } from "./talk-words";

const SCREEN = "clone-chat";
const LIST_LIMIT = 30;
/** 流れが使えない間、作業中なら見に行く間隔 */
export const POLL_MS = 5_000;

export const CONVS_KEY = ["k762", "convs"] as const;
export const convKey = (id: string) => ["k762", "conv", id] as const;

/** 口が断った（code と状態）。読みの失敗を画面で出し分けるために持つ */
export class TalkError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
const fail = (r: CallErr): never => {
  throw new TalkError(r.status, r.code);
};
const signedIn = (): boolean => typeof window !== "undefined" && Boolean(getToken());

export function useConvs() {
  return useQuery({
    queryKey: CONVS_KEY,
    enabled: signedIn(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<ConversationRow[]> => {
      const r = await call("listConversations", { screenId: SCREEN, query: { limit: LIST_LIMIT } });
      return r.ok ? (r.data as unknown as ConversationRow[]) : fail(r);
    },
  });
}

export function useConv(id: string | null, poll: boolean) {
  return useQuery({
    queryKey: convKey(id ?? ""),
    enabled: signedIn() && id !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
    // 流れが使えない間だけ、作業中（work か running_job_id が在る）なら 5 秒ごとに見に行く（G-16）
    refetchInterval: (q) => {
      const v = q.state.data;
      return poll && v && (v.work !== null || v.running_job_id !== null) ? POLL_MS : false;
    },
    queryFn: async (): Promise<ConversationView> => {
      const r = await call("getConversation", { screenId: SCREEN, params: { id: id ?? "" } });
      return r.ok ? (r.data as unknown as ConversationView) : fail(r);
    },
  });
}

/** 古い行（上に足す分）。会話を替えたら空に戻す */
export function useOlder(id: string | null) {
  const [state, setState] = useState<{ id: string | null; rows: MessageView[]; more: boolean | null }>({
    id,
    rows: [],
    more: null,
  });
  const busy = useRef(false);
  const cur = state.id === id ? state : { id, rows: [], more: null };
  const load = useCallback(
    async (oldest: MessageView | undefined) => {
      if (!id || !oldest || busy.current) return;
      busy.current = true;
      try {
        const r = await call("listConversationMessages", {
          screenId: SCREEN,
          params: { id },
          query: { cursor: olderCursor(oldest) },
        });
        if (!r.ok) return;
        const rows = r.data as unknown as MessageView[];
        setState((s) => {
          const base = s.id === id ? s.rows : [];
          return { id, rows: [...rows, ...base], more: Boolean(r.meta.cursor) };
        });
      } finally {
        busy.current = false;
      }
    },
    [id],
  );
  return { rows: cur.rows, more: cur.more, load };
}

export type SayResult = { ok: true; id: string; created: boolean } | { ok: false; err: CallErr };

/** 言う。current が null なら会話を作ってから言う。待つ間の二度押しは無視する（言う口は 1 回） */
export function useSay() {
  const m = useMutation({
    mutationFn: async ({ current, text }: { current: string | null; text: string }): Promise<SayResult> => {
      let id = current;
      if (id === null) {
        const c = await call("createConversation", { screenId: SCREEN, body: {} });
        if (!c.ok) return { ok: false, err: c };
        id = (c.data as unknown as { id: string }).id;
      }
      // 体は { text } だけ（K-758 の口の入力。契約の生成型が置き場の列の形のままなので、ここで形を合わせる）
      const body = { text } as unknown as Ops["sendConversationMessage"]["body"];
      const r = await call("sendConversationMessage", { screenId: SCREEN, params: { id }, body });
      return r.ok ? { ok: true, id, created: current === null } : { ok: false, err: r };
    },
  });
  return m;
}

export function useStop() {
  return useMutation({
    mutationFn: async (id: string) => call("stopConversation", { body: {}, screenId: SCREEN, params: { id } }),
  });
}

export async function refreshConv(qc: QueryClient, id: string): Promise<void> {
  await qc.refetchQueries({ queryKey: convKey(id), exact: true });
}
