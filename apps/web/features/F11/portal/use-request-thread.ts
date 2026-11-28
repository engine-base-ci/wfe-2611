"use client";
// 依頼のやり取りの読みと書き（K-912）。getPortalRequest を 1 回・postPortalRequestMessage で返事を書く。
//   空の返事は送らない・押している間は押し直せない・失敗しても書いた返事は欄に残す。
//   もう書けない依頼（409・E-GST-170）は欄に文を出して読み直す。403 は E-PAGE-002 の文・404 は読み直す。401 は期限切れの形（自動で移さない）
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorText, PAGE_ERROR } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { FormError } from "./request";

const SCREEN = "portal";
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
const SEND_FAILED: FormError = {
  title: "送れませんでした",
  body: "もう一度押してください。書いた返事は、この欄に残っています。",
};

/** 画面が読む答えの形（11_tickets/K-912.md「読む答えの形」・口は K-907） */
export interface PortalRequestData {
  request: {
    id: string;
    title: string;
    from_name: string;
    created_at: string;
    state: "open" | "accepted" | "declined";
    declined_reason?: string;
  };
  messages: { id: string; side: "they" | "we"; name: string; at: string; text: string }[];
  can_write: boolean;
}
export type RequestRead = { ok: true; data: PortalRequestData } | { ok: false; err: CallErr };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** 口の答えを画面の形に直す（知らない値は空にする） */
export function toRequest(raw: unknown): PortalRequestData {
  const d = obj(raw);
  const r = obj(d["request"]);
  const st = str(r["state"]);
  const reason = str(r["declined_reason"]);
  const msgs = Array.isArray(d["messages"]) ? d["messages"] : [];
  return {
    request: {
      id: str(r["id"]),
      title: str(r["title"]),
      from_name: str(r["from_name"]),
      created_at: str(r["created_at"]),
      state: st === "accepted" || st === "declined" ? st : "open",
      ...(reason ? { declined_reason: reason } : {}),
    },
    messages: msgs.map(obj).map((m) => ({
      id: str(m["id"]),
      side: m["side"] === "we" ? "we" : "they",
      name: str(m["name"]),
      at: str(m["at"]),
      text: str(m["text"]),
    })),
    can_write: d["can_write"] === true,
  };
}

export const portalRequestKey = (id: string) => ["portal", "request", id] as const;

export interface RequestThreadState {
  read: UseQueryResult<RequestRead>;
  reply: string;
  setReply: (v: string) => void;
  send: () => void;
  sending: boolean;
  replyError: string | null;
  sendError: FormError | null;
  expired: boolean;
}

export function useRequestThread(id: string): RequestThreadState {
  const read = useQuery<RequestRead>({
    queryKey: portalRequestKey(id),
    queryFn: async () => {
      const r = await call("getPortalRequest", { params: { id }, keepOn401: true, screenId: SCREEN });
      return r.ok ? { ok: true, data: toRequest(r.data) } : { ok: false, err: r };
    },
    ...ONCE,
  });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<FormError | null>(null);
  const [expired, setExpired] = useState(false);

  const fail = (r: CallErr) => {
    if (r.kind === "unauthenticated") return setExpired(true);
    if (r.code === "E-GST-170") {
      setReplyError(errorText("E-GST-170").title);
      void read.refetch();
      return;
    }
    if (r.kind === "invalid" && "body" in r.fields) return setReplyError(r.fields["body"] || SEND_FAILED.title);
    if (r.kind === "forbidden") {
      // ゲストでなくなった・抜けた直後：出すときと同じ E-PAGE-002 の文（押し直しても通らない）
      const t = errorText(PAGE_ERROR.forbidden);
      return setSendError({ title: t.title, body: t.body });
    }
    if (r.kind === "not_found") {
      // 見えなくなった：依頼を読み直す（読みが 404 になり「この依頼は見られません」の形になる）
      void read.refetch();
      return;
    }
    setSendError(SEND_FAILED);
  };

  const send = () => {
    if (sendingRef.current || reply.trim() === "") return;
    sendingRef.current = true;
    setSending(true);
    setReplyError(null);
    setSendError(null);
    void call("postPortalRequestMessage", {
      params: { id },
      body: { body: reply },
      keepOn401: true,
      screenId: SCREEN,
    })
      .then((r) => {
        if (r.ok) {
          setReply("");
          void read.refetch();
          return;
        }
        fail(r);
      })
      .catch(() => setSendError(SEND_FAILED))
      .finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
  };

  return { read, reply, setReply, send, sending, replyError, sendError, expired };
}
