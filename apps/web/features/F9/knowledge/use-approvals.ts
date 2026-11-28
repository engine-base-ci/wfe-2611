"use client";
// K-694「管理 › 承認待ち」の状態と口：読む（listKnowledgeApprovals）・承認する（approveKnowledgeRequest）・断る（declineKnowledgeRequest）。口は K-688。
//   読むのは管理が開いたとき 1 回（窓に戻っても読み直さない・G-16）。承認・断るで行が減っても読み直さず画面の中で外す。
//   読み直すのは「もう決まっている・無い」の断りのときだけ。更新は新しい値を作って入れ替える
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { AdminCtx } from "./admin-lists";
import {
  DECLINE_DONE,
  DECLINE_EMPTY,
  approvalItems,
  approveDoneText,
  declineProblem,
  type ApprovalAnswer,
} from "./approvals-shape";
import type { ApprovalItem } from "./types";

const SCREEN = "knowledge";
export const APPROVALS_KEY = ["k694", "knowledge", "approvals"] as const;
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** 承認待ちを読めなかった訳（noAccess＝権限が外れた） */
export class ApprovalsLoadError extends Error {
  constructor(
    readonly code: string,
    readonly noAccess: boolean,
  ) {
    super(code);
    this.name = "ApprovalsLoadError";
  }
}

async function readApprovals(): Promise<ApprovalAnswer[]> {
  let r;
  try {
    r = await call("listKnowledgeApprovals", { screenId: SCREEN });
  } catch {
    throw new ApprovalsLoadError(PAGE_ERROR.loadFailed, false); // 網が切れた
  }
  if (r.ok) return r.data as unknown as ApprovalAnswer[];
  if (r.status === 403) throw new ApprovalsLoadError(PAGE_ERROR.forbidden, true);
  throw new ApprovalsLoadError(r.status === 503 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed, false);
}

/** 決まった・無い頼み（一覧を読み直すと消える） */
const isSettled = (r: CallErr, code: string): boolean =>
  r.status === 404 || code === "E-KNW-110" || code === "E-KNW-103";

export interface Declining {
  reason: string;
  error?: string;
}

export interface Approvals {
  status: "loading" | "error" | "ready";
  error: ApprovalsLoadError | null;
  items: ApprovalItem[];
  /** 行の id → 本文（フォルダの共有は無い） */
  bodies: ReadonlyMap<string, unknown>;
  openIds: ReadonlySet<string>;
  busyIds: ReadonlySet<string>;
  approve: (id: string) => void;
  startDecline: (id: string) => void;
  cancelDecline: (id: string) => void;
  decline: (id: string) => void;
  setReason: (id: string, text: string) => void;
  toggleBody: (id: string) => void;
  retry: () => void;
}

const without = <T>(set: ReadonlySet<T>, v: T): Set<T> => new Set([...set].filter((x) => x !== v));
const omit = <V>(rec: Readonly<Record<string, V>>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));

export function useApprovals(ctx: AdminCtx, enabled: boolean): Approvals {
  const q = useQuery<ApprovalAnswer[], ApprovalsLoadError>({
    queryKey: APPROVALS_KEY,
    queryFn: readApprovals,
    enabled,
    ...ONCE,
  });
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [declining, setDeclining] = useState<Readonly<Record<string, Declining>>>({});
  // 答えを待つ間の二度押しを止める（描き直しより先に 2 回目が来ても 1 回）
  const sending = useRef<Set<string>>(new Set());

  const rows = (q.data ?? []).filter((r) => !removed.has(r.id));
  const items = approvalItems(rows).map((it) => (declining[it.id] ? { ...it, declining: declining[it.id]! } : it));
  const bodies = new Map(rows.filter((r) => r.body).map((r) => [r.id, r.body!.doc] as const));
  const titleOf = (id: string): string => rows.find((r) => r.id === id)?.title ?? "";

  const failText = (code: string): string => errorText(code).entry.message;
  const notifyFail = (code: string) => ctx.notify(failText(code), { type: "error" });
  const reread = () => void q.refetch();

  const done = (id: string, text: string) => {
    setRemoved((cur) => new Set([...cur, id]));
    setDeclining((cur) => omit(cur, id));
    setOpenIds((cur) => without(cur, id));
    ctx.reload({ tree: true });
    ctx.notify(text);
  };

  /** 1 行に 1 つだけ口を送る（送っている間はその行のボタンを押せない） */
  const guarded = async (id: string, job: () => Promise<void>) => {
    if (sending.current.has(id)) return;
    sending.current.add(id);
    setBusyIds((cur) => new Set([...cur, id]));
    try {
      await job();
    } catch {
      notifyFail(PAGE_ERROR.offline); // 網が切れた（口に届かない）：行は残り押し直せる
    } finally {
      sending.current.delete(id);
      setBusyIds((cur) => without(cur, id));
    }
  };

  const approve = (id: string) =>
    void guarded(id, async () => {
      const title = titleOf(id);
      const r = await call("approveKnowledgeRequest", { params: { id }, body: {}, screenId: SCREEN });
      if (r.ok) return done(id, approveDoneText(title));
      const code = errorCodeOf(r);
      notifyFail(code);
      if (isSettled(r, code)) reread();
    });

  const decline = (id: string) => {
    const cur = declining[id];
    if (!cur) return;
    const problem = declineProblem(cur.reason);
    if (problem) {
      setDeclining((d) => ({ ...d, [id]: { reason: cur.reason, error: problem } }));
      return;
    }
    void guarded(id, async () => {
      const r = await call("declineKnowledgeRequest", {
        params: { id },
        body: { reason: cur.reason },
        screenId: SCREEN,
      });
      if (r.ok) return done(id, DECLINE_DONE);
      if (r.status === 422) {
        setDeclining((d) => ({ ...d, [id]: { reason: cur.reason, error: DECLINE_EMPTY } }));
        return;
      }
      const code = errorCodeOf(r);
      notifyFail(code);
      if (code === "E-KNW-110") {
        setDeclining((d) => omit(d, id));
        reread();
      }
    });
  };

  return {
    status: q.isError ? "error" : q.data ? "ready" : "loading",
    error: q.error ?? null,
    items,
    bodies,
    openIds,
    busyIds,
    approve,
    startDecline: (id) => setDeclining((d) => ({ ...d, [id]: { reason: "" } })),
    cancelDecline: (id) => setDeclining((d) => omit(d, id)),
    decline,
    setReason: (id, text) => setDeclining((d) => ({ ...d, [id]: { reason: text } })),
    toggleBody: (id) => setOpenIds((cur) => (cur.has(id) ? without(cur, id) : new Set([...cur, id]))),
    retry: reread,
  };
}
