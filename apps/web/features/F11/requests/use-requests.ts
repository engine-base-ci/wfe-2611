"use client";
// 届いた依頼を読む（K-898）。一覧の口 listClientRequests と開いた依頼の口 getClientRequest を 1 回ずつ（同じ住所を 2 回呼ばない）。
//   答えの形は 11_tickets/K-898.md「読む答えの形」（口の葉 K-892 が同じ形で返す）。自分ではやり直さない（読めないときは画面の「もう一度」で）
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { call, type CallErr } from "@/lib/api/call";

export const SCREEN = "requests";
export type ReqState = "new" | "asking" | "done";

export interface ReqItem {
  id: string;
  title: string;
  from_name: string;
  group_name: string;
  /** 届け先の社内のグループ（消えると無い・K892-API-003） */
  route_name?: string | null;
  created_at: string;
  state: ReqState;
  tag?: string | null;
}
export interface ReqList {
  items: ReqItem[];
  /** まださばいていない依頼の数（見出しの数） */
  live: number;
}
/** 依頼のやり取りの 1 件（side：we＝社内／they＝先方のゲスト） */
export interface ReqMessage {
  id: string;
  side: "we" | "they";
  name: string;
  at: string;
  text: string;
}
const isMessage = (m: unknown): m is ReqMessage => {
  const v = m as Partial<ReqMessage> | null;
  return (
    !!v &&
    (v.side === "we" || v.side === "they") &&
    typeof v.name === "string" &&
    typeof v.at === "string" &&
    typeof v.text === "string"
  );
};
export interface ReqDetail {
  request: ReqItem & {
    body: string;
    ticket_id?: string | null;
    ticket_number?: string | null;
    declined_reason?: string | null;
  };
  /** 依頼のやり取り（2 つ目以降・古い順。最初の本文は request.body・K-892）。聞いている帯の中に出す */
  messages: ReqMessage[];
  routes: { id: string; name: string }[];
  can_act: boolean;
  pc_connected: boolean;
  ticket_draft: { title: string; kind: string; owner: string; due: string; cost: string; route_name?: string } | null;
  reply_draft: string | null;
  /** 分身が先方に聞きたいこと（無ければ空・K-899） */
  questions: string[];
  /** 届け先の案（理由の 1 行の元・無ければ null・K-899） */
  route_suggestion: { name: string; reason: string } | null;
}

/** 口が断った答え（画面は種類と番号で出し分ける） */
export class RequestCallError extends Error {
  constructor(public readonly result: CallErr) {
    super(result.code);
  }
}

export const requestKeys = {
  list: ["k898", "requests"] as const,
  one: (id: string) => ["k898", "request", id] as const,
};

async function readList(): Promise<ReqList> {
  const r = await call("listClientRequests", { screenId: SCREEN });
  if (!r.ok) throw new RequestCallError(r);
  const d = (r.data ?? {}) as unknown as { items?: ReqItem[]; counts?: { live?: number } };
  const items = Array.isArray(d.items) ? d.items : [];
  return { items, live: Number(d.counts?.live ?? items.filter((i) => i.state !== "done").length) };
}

async function readOne(id: string): Promise<ReqDetail> {
  const r = await call("getClientRequest", { params: { id }, screenId: SCREEN });
  if (!r.ok) throw new RequestCallError(r);
  const d = r.data as unknown as Partial<ReqDetail>;
  if (!d.request) throw new Error("依頼の答えに request が無い");
  return {
    request: d.request,
    messages: Array.isArray(d.messages) ? d.messages.filter(isMessage) : [],
    routes: Array.isArray(d.routes) ? d.routes : [],
    can_act: d.can_act === true,
    pc_connected: d.pc_connected === true,
    ticket_draft: d.ticket_draft ?? null,
    reply_draft: d.reply_draft ?? null,
    questions: Array.isArray(d.questions) ? d.questions.filter((q): q is string => typeof q === "string") : [],
    route_suggestion: d.route_suggestion ?? null,
  };
}

const ONCE = { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
const signedIn = () => typeof window !== "undefined" && Boolean(getToken());

export function useRequestList() {
  return useQuery({ queryKey: requestKeys.list, queryFn: readList, enabled: signedIn(), ...ONCE });
}

export function useRequestOne(id: string | undefined) {
  return useQuery({
    queryKey: requestKeys.one(id ?? ""),
    queryFn: () => readOne(id!),
    enabled: signedIn() && Boolean(id),
    ...ONCE,
  });
}

/** 口が断ったときの答え（読めないとき以外は null） */
export const failureOf = (e: unknown): CallErr | null => (e instanceof RequestCallError ? e.result : null);
