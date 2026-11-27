"use client";
// 届いた依頼を押す（K-898）：届け先を変える（updateClientRequest）・返事を送る（replyToClientRequest）・断る（declineClientRequest）。
//   押している間は同じ操作をもう一度送らない（二度押しは 1 回）。どの答えでも一覧と開いた依頼を読み直す（別の GET で反映を見る・G-03）。
//   チケットにする（acceptClientRequest・K-930）は acceptRun：成功でチケットの id と番号・断られたら小窓に出す文（欄ごとの文を含む）
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type {
  ClientRequestAcceptInput,
  ClientRequestDeclineInput,
  ClientRequestsInput,
  MessagesInput,
} from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { errorText } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { RequestCallError, SCREEN, requestKeys } from "./use-requests";

export type ActKind = "route" | "reply" | "decline";

/** 小窓や本文に出す知らせ（見出しと本文。片方だけでもよい） */
export interface Failure {
  title?: string;
  body?: string;
}

const DECIDED = "この依頼はもう決まっています";
const AGAIN: Record<ActKind, Failure> = {
  route: { title: "届け先を変えられませんでした" },
  reply: { title: "送れませんでした", body: "もう一度押してください。書いた返事は、この小窓に残っています。" },
  decline: { title: "断れませんでした", body: "もう一度押してください。書いた理由は、この小窓に残っています。" },
};

/** 開いた後に権限を外された（403）：見出しだけを出し、後ろの文は付けない（代表の答え answer=d028c18907ee） */
const NO_RIGHT: Failure = { title: "この操作をする権限がありません" };

/** 断られた答え → 出す文。もう決まっていた（409・E-GST-110／E-GST-130）・選べない届け先（404・E-GST-111）は番号の文、
 *  返事・断るの 403（権限を外された直後）は見出しだけ、ほかは押し直しの文 */
export function failureText(kind: ActKind, e: CallErr): Failure {
  if (e.status === 409) return { body: DECIDED };
  if (kind !== "route" && e.status === 403) return NO_RIGHT;
  if (kind === "route" && e.status === 404) return { body: "この届け先のグループは選べません" };
  return AGAIN[kind];
}

/** チケットを作る小窓に出す知らせ。field があれば欄の下に出す（担当・期限・グループ） */
export interface CreateFailure extends Failure {
  field?: "assignee" | "due" | "scope";
}
/** チケットを作る体（K-894）。題・本文・担当・期限・グループ。見せる相手と種別は送らない（口が入れる） */
export interface CreateInput {
  title?: string;
  body?: string;
  assignee_member_id: string;
  due_on: string;
  scope_id: string;
}
export interface Created {
  ticket_id: string;
  number: string | null;
}

const CREATE_AGAIN: CreateFailure = {
  title: "チケットを作れませんでした",
  body: "もう一度押してください。書いた内容は、この小窓に残っています。",
};
/** 正本（errors.json）の文。正本に無い番号は押し直しの文にする */
const catalogText = (code: string): CreateFailure | null =>
  code in CATALOG ? { body: errorText(code).entry.message } : null;

/** チケットを作るのを口が断った答え → 出す文（K-930）。決まっていた・見せる相手・見えない依頼は番号の文、
 *  担当の誤り（422・欄 assignee_member_id）・期限の誤り（422・欄 due_on）・グループに書けない（403）は欄の下の文 */
export function createFailureText(e: CallErr): CreateFailure {
  if (e.status === 422) {
    if ("assignee_member_id" in e.fields) return { field: "assignee", body: "担当の人を選んでください" };
    if ("due_on" in e.fields) return { field: "due", body: "期限を入れてください" };
    if ("scope_id" in e.fields) return { field: "scope", body: "グループを選んでください" };
    return CREATE_AGAIN;
  }
  if (e.status === 403) return { field: "scope", body: "グループを選んでください" };
  if (e.status === 409 && e.code === "E-GST-120") return catalogText(e.code) ?? { body: DECIDED };
  if (["E-GST-040", "E-GST-041", "E-GST-100"].includes(e.code)) return catalogText(e.code) ?? CREATE_AGAIN;
  return CREATE_AGAIN;
}

const errOf = (e: unknown): CallErr | null => (e instanceof RequestCallError ? e.result : null);

export function useRequestActs(id: string | undefined) {
  const qc = useQueryClient();
  const inFlight = useRef(false);
  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: requestKeys.list }),
      ...(id ? [qc.invalidateQueries({ queryKey: requestKeys.one(id) })] : []),
    ]);
  const settle = {
    onSettled: async () => {
      inFlight.current = false;
      await reload();
    },
  };
  const route = useMutation({
    mutationFn: async (routeId: string) => {
      const r = await call("updateClientRequest", {
        params: { id: id! },
        body: { route_id: routeId } as unknown as ClientRequestsInput,
        screenId: SCREEN,
      });
      if (!r.ok) throw new RequestCallError(r);
    },
    ...settle,
  });
  const reply = useMutation({
    mutationFn: async (body: string) => {
      const r = await call("replyToClientRequest", {
        params: { id: id! },
        body: { body } as unknown as MessagesInput,
        screenId: SCREEN,
      });
      if (!r.ok) throw new RequestCallError(r);
    },
    ...settle,
  });
  const decline = useMutation({
    mutationFn: async (reason: string) => {
      const r = await call("declineClientRequest", {
        params: { id: id! },
        body: { reason } satisfies ClientRequestDeclineInput,
        screenId: SCREEN,
      });
      if (!r.ok) throw new RequestCallError(r);
    },
    ...settle,
  });
  const accept = useMutation({
    mutationFn: async (input: CreateInput): Promise<Created> => {
      const r = await call("acceptClientRequest", {
        params: { id: id! },
        body: input satisfies ClientRequestAcceptInput,
        screenId: SCREEN,
      });
      if (!r.ok) throw new RequestCallError(r);
      const d = (r.data ?? {}) as unknown as { ticket_id?: string; number?: string | null };
      return { ticket_id: String(d.ticket_id ?? ""), number: d.number ?? null };
    },
    ...settle,
  });
  /** チケットを作る（二度押しは 1 回）。成功したらチケット、断られたら出す文、何もしないなら null */
  const acceptRun = async (input: CreateInput): Promise<Created | CreateFailure | null> => {
    if (!id || inFlight.current) return null;
    inFlight.current = true;
    try {
      return await accept.mutateAsync(input);
    } catch (e) {
      const r = errOf(e);
      if (r?.status === 401) return null;
      return r ? createFailureText(r) : CREATE_AGAIN;
    }
  };
  /** 押している間はどの操作も送らない。成功したら true、断られたら出す文 */
  const run = async (kind: ActKind, value: string): Promise<true | Failure | null> => {
    if (!id || inFlight.current) return null;
    inFlight.current = true;
    const m = kind === "route" ? route : kind === "reply" ? reply : decline;
    try {
      await m.mutateAsync(value);
      return true;
    } catch (e) {
      const r = errOf(e);
      // 401 は入り直しへ移る（call が移す）ので文を出さない
      if (r?.status === 401) return null;
      return r ? failureText(kind, r) : AGAIN[kind];
    }
  };
  return {
    run,
    acceptRun,
    busy: { route: route.isPending, reply: reply.isPending, decline: decline.isPending, accept: accept.isPending },
  };
}
