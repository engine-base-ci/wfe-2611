"use client";
// 届いた依頼の分身の案（K-899）：「案を作る」を押す（requestClientRequestDraft・K-896）・作っている間・案を待つ読み直し・案の値の直し方。
//   押すと口を 1 回だけ呼ぶ（二度押しは 1 回）。作っている間は 5 秒おきに開いた依頼を読み直し（最大 24 回・2 分）、案が入れば止める。
//   2 分たっても入らなければ止めて押し直せる形に戻す。後から PC がつながっても自動では積まない（D-155.11）。
//   口の断りは番号で文を出す（409・E-GST-142＝作っている／141＝PC がつながっていない／140＝もう決まっている・404・503）
//   読み直しを伴う断り（141・140）の文は head＝本文の頭の知らせに出す（読み直しで案の区画が消えても読める）。
//   二度押しの守りは依頼ごと（開く依頼が替わったら、前の依頼の待ちは次の依頼の「案を作る」を止めない）
import { useEffect, useRef, useState } from "react";
import type { OpName } from "@kaname/contracts";
import { call, type CallResult } from "@/lib/api/call";
import { SCREEN } from "./use-requests";

export const POLL_MS = 5_000;
export const POLL_MAX = 24;

export const DRAFT_TEXT = {
  failed: "案を作れませんでした",
  needPc: "PC がつながると分身が案を出します",
  decided: "この依頼はもう決まっています",
  notFound: "この依頼は見つかりません",
  late: "案がまだ届いていません。もう一度「案を作る」を押してください。",
} as const;

/** 口の答えの期限（YYYY-MM-DD）を画面の「M/D」に。形が違えばそのまま */
export function dueLabel(due: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due.trim());
  return m ? `${Number(m[2])}/${Number(m[3])}` : due;
}

/** 届け先の理由の 1 行（口の reason は頭の「分身の案：」を持たない） */
export const whyOf = (reason: string | null | undefined): string => (reason ? `分身の案：${reason}` : "");

/** 聞きたいことを下絵のとおり「 ・ 」でつないで 1 行に */
export const askOf = (questions: readonly string[]): string => questions.filter((q) => q.trim() !== "").join(" ・ ");

const norm = (s: string): string => s.normalize("NFKC").trim();
/** 「EG 営業」のような番号の頭を除いた名前 */
const bare = (s: string): string => norm(s).replace(/^[A-Z0-9]+\s+/, "");

/** 案の担当の名前 → 選び肢の人（表示名の頭の語が同じ人が 1 人だけのとき）。0 人・2 人以上は null（人が選ぶ） */
export function ownerIdOf(owner: string, members: readonly { id: string; display_name: string }[]): string | null {
  const want = norm(owner);
  if (want === "") return null;
  const hit = members.filter((m) => norm(m.display_name).split(/\s+/)[0] === want);
  return hit.length === 1 ? hit[0]!.id : null;
}

/** 届け先の案の名前 → 書けるグループ（番号の頭を除いて比べる）。無ければ null（小窓の既定） */
export function scopeIdOf(name: string, scopes: readonly { id: string; name: string }[]): string | null {
  const want = bare(name);
  if (want === "") return null;
  return scopes.find((s) => bare(s.name) === want)?.id ?? null;
}

/** チケットを作る小窓の初期値（題・期限は字・担当とグループは名前。選び肢の id へは ownerIdOf・scopeIdOf で引き当てる） */
export interface CreateInitial {
  title: string;
  due: string;
  ownerName: string;
  routeName: string;
}
export function createInitialOf(
  draft: { title: string; owner: string; due: string; route_name?: string } | null,
  suggestion: { name: string } | null,
  manual: { title: string; due: string } | null,
): CreateInitial | null {
  if (draft)
    return {
      title: draft.title,
      due: dueLabel(draft.due),
      ownerName: draft.owner,
      routeName: suggestion?.name ?? draft.route_name ?? "",
    };
  if (manual && (manual.title.trim() !== "" || manual.due.trim() !== ""))
    return { title: manual.title, due: manual.due, ownerName: "", routeName: "" };
  return null;
}

type DraftErr = Extract<CallResult<OpName>, { ok: false }>;

/** 断りの答え → 出す文と、読み直すか・待つか */
export function draftFailure(e: DraftErr): { message: string | null; wait: boolean; reload: boolean } {
  if (e.status === 401) return { message: null, wait: false, reload: false };
  if (e.status === 409 && e.code === "E-GST-142") return { message: null, wait: true, reload: false };
  if (e.status === 409 && e.code === "E-GST-141") return { message: DRAFT_TEXT.needPc, wait: false, reload: true };
  if (e.status === 409) return { message: DRAFT_TEXT.decided, wait: false, reload: true };
  if (e.status === 404) return { message: DRAFT_TEXT.notFound, wait: false, reload: false };
  return { message: DRAFT_TEXT.failed, wait: false, reload: false };
}

type Phase = "idle" | "posting" | "waiting";

/** 二度押しの守りを外す（その依頼の守りのときだけ。別の依頼の守りは外さない） */
const release = (ref: { current: string | null }, rid: string): void => {
  if (ref.current === rid) ref.current = null;
};

/** 契約の口（K-896 が足す requestClientRequestDraft）を呼ぶ。口が契約に無い間は call が投げるので失敗として扱う */
async function postDraft(id: string): Promise<CallResult<OpName> | null> {
  try {
    return await call("requestClientRequestDraft" as OpName, { params: { id }, screenId: SCREEN } as never);
  } catch {
    return null;
  }
}

/**
 * 「案を作る」の動き。hasDraft は今読んでいる依頼に案があるか、reload は開いた依頼を読み直して案が入ったかを返す
 */
export function useRequestDraft(id: string | undefined, hasDraft: boolean, reload: () => Promise<boolean>) {
  const [state, setState] = useState<{
    id: string | undefined;
    phase: Phase;
    message: string | null;
    head: boolean;
  }>({ id, phase: "idle", message: null, head: false });
  /** いま「案を作る」を押して待っている依頼の id（無ければ null）。依頼ごとの二度押しの守り */
  const inFlight = useRef<string | null>(null);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  const cur = state.id === id ? state : { id, phase: "idle" as Phase, message: null, head: false };
  const phase = hasDraft ? "idle" : cur.phase;

  // 作っている間：5 秒おきに読み直す（最大 24 回）。案が入れば止める・画面を離れたら止める
  useEffect(() => {
    if (phase !== "waiting" || !id) return;
    let stop = false;
    let n = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      n += 1;
      let got: boolean;
      try {
        got = await reloadRef.current();
      } catch {
        got = false;
      }
      if (stop) return;
      if (got) {
        release(inFlight, id);
        setState({ id, phase: "idle", message: null, head: false });
        return;
      }
      if (n >= POLL_MAX) {
        release(inFlight, id);
        setState({ id, phase: "idle", message: DRAFT_TEXT.late, head: false });
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };
    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, id]);

  const make = async () => {
    if (!id || inFlight.current === id || phase !== "idle") return;
    inFlight.current = id;
    setState({ id, phase: "posting", message: null, head: false });
    const r = await postDraft(id);
    // 待つ間に別の依頼の「案を作る」が押されていたら、その依頼の状態を上書きしない
    if (inFlight.current !== id) return;
    if (r?.ok) {
      setState({ id, phase: "waiting", message: null, head: false });
      return;
    }
    const f = r ? draftFailure(r) : { message: DRAFT_TEXT.failed, wait: false, reload: false };
    if (f.wait) {
      setState({ id, phase: "waiting", message: null, head: false });
      return;
    }
    release(inFlight, id);
    setState({ id, phase: "idle", message: f.message, head: f.reload });
    if (f.reload) void reloadRef.current().catch(() => false);
  };

  const message = hasDraft ? null : cur.message;
  return {
    make,
    making: phase !== "idle",
    /** 案の区画に出す文（押し直せる失敗・案が来ない） */
    message: cur.head ? null : message,
    /** 本文の頭の知らせに出す文（読み直しを伴う断り） */
    headMessage: cur.head ? message : null,
  };
}
