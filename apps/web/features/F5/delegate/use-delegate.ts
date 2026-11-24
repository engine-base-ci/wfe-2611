"use client";
// AI に任せる流れ（K-62 の帯から移した・K-573 で確認項目 0 件の小窓を足した）。押すたびに：
//   1. 確認項目がちょうど 0 件（getTicket の spec_count === 0）なら、任せる口を呼ばずに小窓を開く。1 件以上・null・無い（前の口）は空の体 {} で口を呼ぶ（口が最後の砦・K-565）
//   2. 小窓の「理由を書いて任せる」→ 体 { no_spec_reason: <前後の空白を落とした理由> } で同じ口を呼ぶ
//   3. 口の答え：201 は閉じて実行へ。409 E-CONF-020（画面は 1 件と思っていたが口は 0 件）は小窓を開き詳細を読み直す。
//      409 E-CONF-013（もう走っている）・E-CONF-014（任せられない段）は小窓を閉じて帯に知らせ。それ以外は、小窓から送ったなら小窓の中に、
//      そうでなければ帯に知らせ（429 は待つ秒数の間押せない）。401 は入り直し（共通の扱い）
//   流れの状態は頁の中の store（チケット id ごと）に置き、題の行のボタン（delegate-act.tsx）と帯（delegate-band.tsx の小窓と知らせ）が同じ物を読む。
//   帯の props に無い値（確認項目を使わない理由・対象の行）は、題の行のボタンが詳細の答えから載せる（info）。更新は新しい値を作って入れ替える
import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { fetchRuns } from "./use-run";

/** 理由の字数の上限（口の契約と同じ・K-565） */
export const REASON_MAX = 500;
/** 429 で口が秒数を返さなかったときに待つ秒数 */
const DEFAULT_WAIT_SEC = 60;
const MS_PER_SEC = 1000;
/** 確認項目が 0 件で理由が無い（口が断る・K-565） */
const NO_SPEC = "E-CONF-020";
const RUNNING = "E-CONF-013";
const WRONG_STAGE = "E-CONF-014";
const NO_PC = "E-CONN-001";

export type DelegateNotice = { code: string; retryAfterSec?: number | null; link?: boolean };
/** 帯の props に無い値（題の行のボタンが詳細の答えから載せる） */
export interface DelegateInfo {
  noSpecReason: string | null;
  target: string | undefined;
}
export interface DelegateState {
  /** 任せる口の答えを待っている */
  busy: boolean;
  /** 429 の待ちの終わり（ミリ秒）。待っていなければ null */
  waitUntil: number | null;
  /** 確認項目 0 件の小窓を出しているか */
  dialog: boolean;
  /** 小窓の理由の欄 */
  reason: string;
  /** 帯に出す知らせ */
  notice: DelegateNotice | null;
  /** 小窓の中に出す知らせ */
  dialogNotice: DelegateNotice | null;
  info: DelegateInfo;
}
const NO_INFO: DelegateInfo = { noSpecReason: null, target: undefined };
const IDLE: DelegateState = {
  busy: false,
  waitUntil: null,
  dialog: false,
  reason: "",
  notice: null,
  dialogNotice: null,
  info: NO_INFO,
};

const states = new Map<string, DelegateState>();
const listeners = new Map<string, Set<() => void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const read = (id: string): DelegateState => states.get(id) ?? IDLE;
function write(id: string, patch: Partial<DelegateState>): void {
  states.set(id, { ...read(id), ...patch });
  listeners.get(id)?.forEach((l) => l());
}
function subscribe(id: string, l: () => void): () => void {
  const set = listeners.get(id) ?? new Set<() => void>();
  listeners.set(id, set);
  set.add(l);
  return () => {
    set.delete(l);
  };
}

/** 前後の空白（半角・全角・タブ・改行）を落とす */
export const trimReason = (s: string): string => s.trim(); // String.prototype.trim は全角の空白（U+3000）も落とす
/** 欄の字を上限で切る */
export const clipReason = (s: string): string => s.slice(0, REASON_MAX);

export interface DelegateDeps {
  ticketId: string;
  /** getTicket の spec_count（無い・null は前の口の答え） */
  specCount: number | null | undefined;
  qc: QueryClient;
  /** 任せた・別のタブで走っていた実行に替わる */
  onRun: (runId: string) => Promise<void>;
  /** 段が変わっていた・確認項目の数が違っていた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
}

/** 小窓を開く（理由の欄は前に残した理由か空） */
function openDialog(id: string, dialogNotice: DelegateNotice | null = null): void {
  write(id, { dialog: true, reason: clipReason(read(id).info.noSpecReason ?? ""), notice: null, dialogNotice });
}

/** 429：待つ秒数の間は押せない。過ぎたら知らせを消す */
function waitFor(id: string, sec: number, inDialog: boolean): void {
  const n: DelegateNotice = { code: "RATE", retryAfterSec: sec };
  write(id, { waitUntil: Date.now() + sec * MS_PER_SEC, ...(inDialog ? { dialogNotice: n } : { notice: n }) });
  const old = timers.get(id);
  if (old) clearTimeout(old);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      write(id, { waitUntil: null, ...(inDialog ? { dialogNotice: null } : { notice: null }) });
    }, sec * MS_PER_SEC),
  );
}

/** 別のタブで先に任せていた（409・E-CONF-013）：答えの run_id が無くても、今の実行を一覧から引く（詳細と同じ問い合わせ・K-235） */
async function runIdOf(qc: QueryClient, ticketId: string): Promise<string | null> {
  const runs = await fetchRuns(qc, ticketId);
  return runs?.[0]?.id ?? null;
}

/** 任せる口を呼ぶ。reason があれば小窓から（体 { no_spec_reason }）、無ければ空の体 {} */
async function send(d: DelegateDeps, reason?: string): Promise<void> {
  const id = d.ticketId;
  const fromDialog = reason !== undefined;
  write(id, { busy: true, ...(fromDialog ? { dialogNotice: null } : { notice: null }) });
  try {
    const body = fromDialog ? { no_spec_reason: reason } : {};
    const r = await call("delegateTicket", { params: { id }, body, screenId: "tickets" });
    if (r.ok) {
      write(id, { dialog: false, reason: "", dialogNotice: null, notice: null });
      await d.onRun(String((r.data as { run_id?: string }).run_id ?? ""));
      return;
    }
    if (r.status === 401) return; // 入り直しへ（共通の扱い・戻る先にこのチケット）
    if (r.status === 429) return waitFor(id, r.retryAfterSec ?? DEFAULT_WAIT_SEC, fromDialog);
    const code = errorCodeOf(r);
    if (code === NO_SPEC) {
      openDialog(id);
      await d.onChanged();
      return;
    }
    const notice: DelegateNotice = { code, link: code === NO_PC };
    if (code === RUNNING || code === WRONG_STAGE) {
      write(id, { dialog: false, reason: "", dialogNotice: null, notice });
      if (code === RUNNING) {
        const runId = typeof r.body["run_id"] === "string" ? r.body["run_id"] : await runIdOf(d.qc, id);
        if (runId) await d.onRun(runId);
      } else await d.onChanged();
      return;
    }
    write(id, fromDialog ? { dialogNotice: notice } : { notice });
  } finally {
    write(id, { busy: false });
  }
}

/** 「AI に任せる」：確認項目がちょうど 0 件なら小窓、そうでなければ空の体で任せる */
async function start(d: DelegateDeps): Promise<void> {
  const s = read(d.ticketId);
  if (s.busy || s.waitUntil || s.dialog) return;
  if (d.specCount === 0) return openDialog(d.ticketId);
  await send(d);
}

/** 小窓の「理由を書いて任せる」（空・空白だけ・送っている間・待つ間は送らない） */
async function go(d: DelegateDeps): Promise<void> {
  const s = read(d.ticketId);
  const reason = trimReason(s.reason);
  if (!s.dialog || s.busy || s.waitUntil || !reason) return;
  await send(d, clipReason(reason));
}

/** 小窓を閉じる（やめる・Esc・×・確認項目を足す）。書きかけの理由は捨てる。送っている間は閉じない */
function close(ticketId: string): void {
  if (read(ticketId).busy) return;
  write(ticketId, { dialog: false, reason: "", dialogNotice: null });
}

/** 題の行のボタンが詳細の答えから載せる値（変わったときだけ書く） */
function publish(ticketId: string, info: DelegateInfo): void {
  const cur = read(ticketId).info;
  if (cur.noSpecReason === info.noSpecReason && cur.target === info.target) return;
  write(ticketId, { info });
}

/** 流れの状態。題の行のボタンと帯が同じ store を読む */
export function useDelegateState(ticketId: string): DelegateState {
  const sub = useCallback((l: () => void) => subscribe(ticketId, l), [ticketId]);
  return useSyncExternalStore(
    sub,
    () => read(ticketId),
    () => IDLE,
  );
}

/** 流れの操作 */
export const delegateFlow = {
  start,
  go,
  close,
  publish,
  setReason: (ticketId: string, reason: string): void => write(ticketId, { reason: clipReason(reason) }),
};
