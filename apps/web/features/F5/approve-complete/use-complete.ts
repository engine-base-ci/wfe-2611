"use client";
// 完了にする流れ（K-572・口は K-434 の listTestSpecs と K-566 の completeTicket）。押すたびに最初から：
//   1. 「完了にする」→ 確認項目を 1 回読む（読んでいる間は押せない形）。読めなければ小窓も完了もなく、赤い知らせ（正本の文）。404 は詳細も読み直す
//   2. 本文（getTicket の body.doc）と確認項目の未チェックを数える
//   3. どちらも 0 → 小窓なしで完了の口。1 つでもあれば小窓（戻って付ける／このまま完了にする）
//   完了の口は { conditions_confirmed: true } だけを送る（押したこと自体が確かめ）。201 は閉じて読み直す。
//   422 E-VAL-024（終わっていない子）は小窓の中に出す（小窓なしの完了なら注意なしの小窓を開く）。ほかの断りは閉じて知らせ・読み直す。401 は入り直し（共通の扱い）
//   口に届かない（回線が切れた・fetch が投げた）ときも、読んでいる・送っているのまま残さず、閉じて「読み込めなかった」の知らせ（E-PAGE-007）
//   流れの状態は頁の中の store（チケット id ごと）に置き、題の行のボタン（complete-act.tsx）と帯（band.tsx の小窓と知らせ）が同じ物を読む。
//   更新は新しい値を作って入れ替える
//   K-703：読んだ確認項目に「必ず守る」から入った未チェックの行（source_page が在る）があれば、口を呼ばず段 5 の小窓も出さず、
//   小窓「まだ完了にできません」（F9 の CompleteBlockedDialog）を出す。完了の口が 409 E-KNW-240 を返したときも、読めれば同じ小窓（読めなければ前の知らせ）
import { useCallback, useSyncExternalStore } from "react";
import { isUuid } from "@kaname/contracts";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import type { Problem } from "./complete-model";
import { catalogMessage, messageOf } from "./message";
import { uncheckedSpecs, uncheckedTasks } from "./unchecked";
import { blockingOf, dialogRows, leftFromConflict, type DialogRow } from "@/features/F9/knowledge/spec-guard-shape";

/** idle：何もしていない／reading：確認項目を読んでいる／open：小窓／sending：完了の口の答えを待っている */
export type CompletePhase = "idle" | "reading" | "open" | "sending";
export interface CompleteState {
  phase: CompletePhase;
  /** 小窓を出しているか（sending の間も、小窓から送ったなら true） */
  dialog: boolean;
  tasks: readonly string[];
  specs: readonly string[];
  problems: readonly Problem[];
  /** 帯に出す赤い知らせ（正本の文） */
  notice: string | null;
  /** 「まだ完了にできません」の小窓に渡す行（止める行 → 人が足した未チェックの行）。null なら出さない（K-703） */
  blocked: readonly DialogRow[] | null;
  /** 押したときに読んだ確認項目の行そのもの（409 で止められたとき、人が足した未チェックを数える・K-703） */
  rows: readonly unknown[];
}
const IDLE: CompleteState = {
  phase: "idle",
  dialog: false,
  tasks: [],
  specs: [],
  problems: [],
  notice: null,
  blocked: null,
  rows: [],
};
/** 小窓の中に出す 422（終わっていない子） */
const CHILDREN_LEFT = "E-VAL-024";
/** 必ず守るの未チェックで完了を止める 409（K-701） */
const KNOWLEDGE_LEFT = "E-KNW-240";

const states = new Map<string, CompleteState>();
const listeners = new Map<string, Set<() => void>>();
const read = (id: string): CompleteState => states.get(id) ?? IDLE;
function write(id: string, patch: Partial<CompleteState>): void {
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

/** 口の 422 の答え → 小窓の中の知らせ（文は正本、明細は口の答えをそのまま。子は id があればそのチケットへのリンク） */
function problemOf(r: CallErr): Problem {
  const details = Array.isArray(r.body["details"]) ? (r.body["details"] as Record<string, unknown>[]) : [];
  return {
    message: messageOf(r),
    items: details
      .filter((d) => d["field"] === "children")
      .map((d) => ({
        text: String(d["message"] ?? ""),
        ...(typeof d["id"] === "string" && isUuid(d["id"]) ? { href: `/tickets/${d["id"]}` } : {}),
      })),
  };
}

export interface CompleteDeps {
  ticketId: string;
  /** 詳細の答えの本文の木（getTicket の body.doc）。無ければ本文の未チェックは 0 */
  doc: unknown;
  /** 完了した・断られた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
}

/** 口が断った（小窓の外に出す物）：閉じて知らせを出し、読み直す。401 は入り直し（共通の扱い） */
async function refused(d: CompleteDeps, r: CallErr, reload: boolean): Promise<void> {
  if (r.status === 401) return write(d.ticketId, { ...IDLE });
  write(d.ticketId, { ...IDLE, notice: messageOf(r) });
  if (reload) await d.onChanged();
}

/** 口に届かなかった（call が投げた）：流れを閉じて、帯に「読み込めなかった」の知らせ。小窓も閉じる（押せないまま残さない） */
function unreachable(ticketId: string): void {
  write(ticketId, { ...IDLE, notice: catalogMessage(PAGE_ERROR.loadFailed) });
}

/** 口を呼ぶ。届かなければ（投げたら）null */
async function reach<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

async function send(d: CompleteDeps, fromDialog: boolean): Promise<void> {
  write(d.ticketId, { phase: "sending", dialog: fromDialog });
  const r = await reach(() =>
    call("completeTicket", {
      params: { id: d.ticketId },
      body: { conditions_confirmed: true },
      screenId: "tickets",
    }),
  );
  if (!r) return unreachable(d.ticketId);
  if (r.ok) {
    write(d.ticketId, { ...IDLE });
    await d.onChanged();
    return;
  }
  if (r.status === 422 && r.code === CHILDREN_LEFT) {
    write(d.ticketId, { phase: "open", dialog: true, problems: [problemOf(r)] });
    return;
  }
  // 一覧を読んだ後に必ず守るが変わって口が止めた：段 5 の小窓を閉じ、口の残りの行で同じ小窓（読めなければ下の知らせ）
  const left = r.status === 409 && r.code === KNOWLEDGE_LEFT ? leftFromConflict(r.body) : null;
  if (left) {
    const rows = read(d.ticketId).rows;
    write(d.ticketId, { ...IDLE, phase: "open", rows, blocked: dialogRows(left, rows) });
    return;
  }
  await refused(d, r, true);
}

/** 「完了にする」：確認項目を 1 回読んで数え、小窓か、そのまま完了か */
async function start(d: CompleteDeps): Promise<void> {
  if (read(d.ticketId).phase !== "idle") return; // 読んでいる・送っている間の 2 回目は送らない
  write(d.ticketId, { ...IDLE, phase: "reading" });
  const r = await reach(() => call("listTestSpecs", { params: { id: d.ticketId }, screenId: "tickets" }));
  if (!r) return unreachable(d.ticketId);
  if (!r.ok) return refused(d, r, r.status === 404);
  const rows: readonly unknown[] = Array.isArray(r.data) ? r.data : [];
  // 必ず守るから入った未チェックの行があれば、口を呼ばずに止める小窓（段 5 の小窓より前・K-703）
  const blocking = blockingOf(rows);
  if (blocking.length) {
    write(d.ticketId, { phase: "open", rows, blocked: dialogRows(blocking, rows) });
    return;
  }
  write(d.ticketId, { rows });
  const tasks = uncheckedTasks(d.doc);
  const specs = uncheckedSpecs(r.data);
  if (!tasks.length && !specs.length) return send(d, false);
  write(d.ticketId, { phase: "open", dialog: true, tasks, specs, problems: [] });
}

/** 小窓の「このまま完了にする」（送っている間の 2 回目は送らない。止める小窓からは送らない） */
async function go(d: CompleteDeps): Promise<void> {
  const s = read(d.ticketId);
  if (s.phase !== "open" || s.blocked) return;
  await send(d, true);
}

/** 小窓の「戻って付ける」・×・Esc（止める小窓の「閉じる」「確認項目に戻る」も）：閉じるだけ（口は呼ばない）。送っている間は閉じない */
function back(ticketId: string): void {
  if (read(ticketId).phase !== "open") return;
  write(ticketId, { ...IDLE });
}

/** 流れの状態と操作。題の行のボタンと帯が同じ store を読む */
export function useComplete(d: CompleteDeps) {
  const { ticketId } = d;
  const sub = useCallback((l: () => void) => subscribe(ticketId, l), [ticketId]);
  const state = useSyncExternalStore(
    sub,
    () => read(ticketId),
    () => IDLE,
  );
  const close = useCallback(() => back(ticketId), [ticketId]);
  return {
    state,
    start: () => start(d),
    go: () => go(d),
    back: close,
  };
}

/** 本文の木（getTicket の body.doc）を答えから取り出す（前の形の答えは undefined） */
export const docOf = (ticket: { body?: { doc?: unknown } | null }): unknown => ticket.body?.doc;
