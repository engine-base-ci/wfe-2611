"use client";
// 運営の受信箱の口を読む・書く（K-976）。一覧は listOpsInquiries（鍵 ["k976","list",box,topic]）、1 件は getOpsInquiry（鍵 ["k976","one",id]）。
//   書くのは updateOpsInquiry・replyOpsInquiry・addOpsInquiryNote（K-974・K-975）。どれも retry しない・窓に戻っても読み直さない（StrictMode でも 1 回）。
//   外枠の答え（caps・箱の数）は入れ物（K-946）と同じ鍵で、ここからは読み直さない。書いた後は 1 件と一覧と外枠の鍵を古い印にする
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { OpsInquiryUpdateInput } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import { fetchOpsShell } from "@/lib/ops-shell-api";
import { OPS_SHELL_KEY } from "@/features/F12/ops/use-ops-shell";
import {
  isDetail,
  isMessage,
  isRow,
  isRows,
  type InboxQuery,
  type InqDetail,
  type InqMessage,
  type InqRow,
} from "./inbox-shape";

const SCREEN = "ops-support";
const NO_REFETCH = { retry: false, refetchOnWindowFocus: false } as const;

/** 読めなかった理由（status 0 は網の切れ・-1 は形が違う） */
export class InboxReadError extends Error {
  constructor(readonly status: number) {
    super(`ops inbox read failed: ${status}`);
  }
}
/** 書けなかった答え（call の CallErr そのまま） */
export class InboxWriteError extends Error {
  constructor(readonly err: CallErr) {
    super(`ops inbox write failed: ${err.status} ${err.code}`);
  }
}

export const inboxListKey = (box: string, topic: string | null) => ["k976", "list", box, topic] as const;
export const inboxOneKey = (id: string) => ["k976", "one", id] as const;
const LIST_ROOT = ["k976", "list"] as const;

type Answer = { ok: true; data: unknown } | { ok: false; status: number };
async function read<T>(run: () => Promise<Answer>, ok: (d: unknown) => d is T): Promise<T> {
  let r: Answer;
  try {
    r = await run();
  } catch {
    throw new InboxReadError(0);
  }
  if (!r.ok) throw new InboxReadError(r.status);
  if (!ok(r.data)) throw new InboxReadError(-1);
  return r.data;
}
async function write<T>(
  run: () => Promise<{ ok: true; data: unknown } | CallErr>,
  ok: (d: unknown) => d is T,
): Promise<T> {
  const r = await run();
  if (!r.ok) throw new InboxWriteError(r);
  if (!ok(r.data)) throw new Error("ops inbox write: 答えの形が違う");
  return r.data;
}

/** 外枠の答え（入れ物が読んだ物をそのまま使う＝外枠の口は 1 回） */
export function useInboxShell() {
  return useQuery({
    queryKey: OPS_SHELL_KEY,
    queryFn: fetchOpsShell,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** 一覧（既定でない box・topic だけを付ける）。enabled は問い合わせを持つ人だけ */
export function useInboxList(q: InboxQuery, enabled: boolean) {
  return useQuery({
    queryKey: inboxListKey(q.box, q.topic),
    queryFn: () =>
      read(
        () =>
          call("listOpsInquiries", {
            query: {
              ...(q.box !== "unassigned" ? { box: q.box } : {}),
              ...(q.topic ? { topic: q.topic } : {}),
            },
            screenId: SCREEN,
          }),
        isRows,
      ),
    enabled,
    ...NO_REFETCH,
  });
}

/** 1 件（id があるときだけ） */
export function useInboxOne(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: inboxOneKey(id ?? ""),
    queryFn: () => read(() => call("getOpsInquiry", { params: { id: id! }, screenId: SCREEN }), isDetail),
    enabled: enabled && id !== null,
    ...NO_REFETCH,
  });
}

/** 1 件の答えに行の値を重ねる（担当・状態・後で） */
function patchOne(qc: QueryClient, row: InqRow) {
  qc.setQueryData<InqDetail>(inboxOneKey(row.id), (d) => (d ? { ...d, ...row, messages: d.messages } : d));
  qc.setQueriesData<InqRow[]>({ queryKey: LIST_ROOT }, (rows) =>
    rows ? rows.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : rows,
  );
}
/** 書いた後：画面に出ている値はそのままにして、次に開いたときに読み直す印を付ける。外枠の数は読み直す */
function staleAfterWrite(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: inboxOneKey(id), refetchType: "none" });
  void qc.invalidateQueries({ queryKey: LIST_ROOT, refetchType: "none" });
  void qc.invalidateQueries({ queryKey: OPS_SHELL_KEY });
}

export function useInboxUpdate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpsInquiryUpdateInput) =>
      write(() => call("updateOpsInquiry", { params: { id }, body, screenId: SCREEN }), isRow),
    onSuccess: (row) => {
      patchOne(qc, row);
      staleAfterWrite(qc, id);
    },
  });
}

/** 返す・社内メモ：やり取りの最後に足す。返すと返事待ち（担当なしなら自分が担当） */
export function useInboxPost(id: string, kind: "reply" | "note", me: { member_id: string; name: string } | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string): Promise<InqMessage> =>
      write(
        () =>
          kind === "reply"
            ? call("replyOpsInquiry", { params: { id }, body: { body }, screenId: SCREEN })
            : call("addOpsInquiryNote", { params: { id }, body: { body }, screenId: SCREEN }),
        isMessage,
      ),
    onSuccess: (m) => {
      const old = qc.getQueryData<InqDetail>(inboxOneKey(id));
      if (old) {
        const { messages, context, workspace_status, ...base } = old;
        const row: InqRow =
          kind === "reply"
            ? { ...base, state: "waiting", last_message_at: m.created_at, owner: base.owner ?? me }
            : { ...base, last_message_at: m.created_at };
        qc.setQueryData<InqDetail>(inboxOneKey(id), { ...row, context, workspace_status, messages: [...messages, m] });
        patchOne(qc, row);
      }
      staleAfterWrite(qc, id);
    },
  });
}
