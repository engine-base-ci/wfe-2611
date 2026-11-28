"use client";
// 見せてもらったチケット 1 件の読みと、やり取りに書く（K-913）。読むのは getPortalTicket（GET /api/v1/portal/tickets/:id・K-906）を 1 回、
//   書くのは postPortalTicketMessage（POST …/messages・体 { body }・K-882）。
//   画面に渡す値は題・段・本文・詳細・やり取りの 5 つだけに絞る（口が余分な欄を返しても渡さない・二次の守り G-02）。
//   401 は入り直しへ自動では移さない（期限切れの形を出す・keepOn401・K-911 と同じ）。同じ住所を 2 回呼ばない（retry: false・StrictMode でも鍵は 1 つ）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { call, type CallErr } from "@/lib/api/call";
import { momentOf } from "./when";
import type { WorkMessage, WorkTicket } from "./work";

export interface PortalTicketData {
  ticket: WorkTicket;
  messages: WorkMessage[];
}
export type PortalTicketRead = { ok: true; data: PortalTicketData } | { ok: false; err: CallErr };

const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
export const portalTicketKey = (id: string) => ["portal", "ticket", id] as const;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** 口の答えを画面の形に直す。拾うのは題・段・本文・詳細と、やり取りの行の 6 つの欄だけ（担当・期限・確認項目などは拾わない） */
export function toPortalTicket(raw: unknown): PortalTicketData {
  const d = obj(raw);
  const t = obj(d["ticket"]);
  const msgs = Array.isArray(d["messages"]) ? d["messages"] : [];
  return {
    ticket: { title: str(t["title"]), stage: str(t["stage"]), body: str(t["body"]), detail: str(t["detail"]) },
    messages: msgs.map((m, i) => {
      const r = obj(m);
      return {
        id: str(r["id"]) || `m${i}`,
        side: r["side"] === "we" ? "we" : "they",
        name: str(r["name"]),
        at: momentOf(str(r["at"])),
        text: str(r["text"]),
        ...(r["from_request"] === true ? { from_request: true } : {}),
      };
    }),
  };
}

async function readTicket(id: string): Promise<PortalTicketRead> {
  const r = await call("getPortalTicket", { params: { id }, keepOn401: true, screenId: "portal" });
  return r.ok ? { ok: true, data: toPortalTicket(r.data) } : { ok: false, err: r };
}

export const usePortalTicket = (id: string) =>
  useQuery({ queryKey: portalTicketKey(id), queryFn: () => readTicket(id), ...ONCE });

/** 書いた結果：sent（足した）・gone（見せるのをやめられた・外された）・expired（ログインが切れた）・failed（送れなかった） */
export type SendResult = "sent" | "gone" | "expired" | "failed";

/** やり取りに書く。送っている間は busy（二度押しは 1 回だけ）。成功したら答えを読み直さずに、やり取りの最後に自分の書き込みを足す */
export function usePortalTicketSend(id: string, myName: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const send = async (text: string): Promise<SendResult> => {
    if (busy) return "failed";
    setBusy(true);
    try {
      const r = await call("postPortalTicketMessage", {
        params: { id },
        body: { body: text },
        keepOn401: true,
        screenId: "portal",
      });
      if (!r.ok) {
        if (r.kind === "unauthenticated") return "expired";
        if (r.kind === "not_found" || r.kind === "forbidden") return "gone";
        return "failed";
      }
      const mine: WorkMessage = {
        id: str(obj(r.data)["id"]) || `local-${Date.now()}`,
        side: "they",
        name: myName,
        at: "今",
        text,
      };
      queryClient.setQueryData<PortalTicketRead>(portalTicketKey(id), (prev) =>
        prev && prev.ok ? { ok: true, data: { ...prev.data, messages: [...prev.data.messages, mine] } } : prev,
      );
      return "sent";
    } finally {
      setBusy(false);
    }
  };
  return { send, busy };
}
