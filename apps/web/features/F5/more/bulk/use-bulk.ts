"use client";
// まとめて承認（K-769）の選んだ物の置き場と口。頭・行・道具・帯・カードの差し込み口（K-730 の QueueBulkSlot）は別々に描かれるので、
//   頁の中の 1 つの store（useSyncExternalStore）を全部が読む。更新は新しい値を作って入れ替える（受けた値は変えない）。
//   口は K-768 の previewBulkApproval（確かめ・読むだけ）と bulkApprove（承認・確かめで見た物だけ）。
//   1 件ずつの守りは口が通す。画面は役の名前で出し分けない
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { CalloutTone } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { messageOf } from "@/features/F5/approve-complete/message";
import { queueKey, type QueueRow } from "@/features/F5/approve-complete/queue";
import {
  BULK_LIMIT,
  NOTHING_TEXT,
  doneText,
  skippedText,
  type BulkScope,
  type SkippedItem,
  type UpdatedItem,
} from "./bulk-words";

const SCREEN = "approvals";

export interface BulkEligible {
  approval_id: string;
  number?: string | null;
  title?: string | null;
  irreversible?: boolean;
  unchecked?: number;
}
export interface BulkPreview {
  eligible: BulkEligible[];
  count: number;
  irreversible_count: number;
  unchecked_count: number;
}
export interface BulkNote {
  tone: CalloutTone;
  text: string;
}
/** 確かめの小窓の中身（開いている間だけ在る） */
export interface BulkFlow {
  scope: BulkScope;
  preview: BulkPreview;
  busy: boolean;
  error: string | null;
}
interface BulkState {
  picked: readonly string[];
  note: BulkNote | null;
  flow: BulkFlow | null;
  /** 確かめの口を読んでいる間（二度押しで 2 回読まない） */
  reading: boolean;
}

const EMPTY: BulkState = { picked: [], note: null, flow: null, reading: false };
let state: BulkState = EMPTY;
const listeners = new Set<() => void>();
const set = (next: Partial<BulkState>): void => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = (): BulkState => state;
const serverSnapshot = (): BulkState => EMPTY;

export const useBulkState = (): BulkState => useSyncExternalStore(subscribe, snapshot, serverSnapshot);

/** まとめて選べる行（AI の成果物。渡された物などは 1 件ずつ決める） */
export const isPickable = (row: QueueRow): boolean => row.kind === "artifact";

/** 選んだ物の置き場。上限 50 件・送る並びは一覧の並び */
export function useBulkPick() {
  const { picked } = useBulkState();
  const toggle = useCallback((id: string, on: boolean): void => {
    const has = state.picked.includes(id);
    if (on && !has && state.picked.length < BULK_LIMIT) set({ picked: [...state.picked, id] });
    if (!on && has) set({ picked: state.picked.filter((p) => p !== id) });
  }, []);
  /** 頭の四角：読み込んだ AI の成果物を 50 件まで全部選ぶ／全部外す */
  const setAll = useCallback((rows: readonly QueueRow[], on: boolean): void => {
    set({
      picked: on
        ? rows
            .filter(isPickable)
            .slice(0, BULK_LIMIT)
            .map((r) => r.id)
        : [],
    });
  }, []);
  /** 一覧を読み直して無くなった物を外す */
  const prune = useCallback((rows: readonly QueueRow[]): void => {
    const ids = new Set(rows.map((r) => r.id));
    const kept = state.picked.filter((p) => ids.has(p));
    if (kept.length !== state.picked.length) set({ picked: kept });
  }, []);
  return { picked, toggle, setAll, prune };
}

/** 選んだ id を一覧の並びにする（押した順でなく） */
export const inListOrder = (rows: readonly QueueRow[], picked: readonly string[]): string[] =>
  rows.filter((r) => picked.includes(r.id)).map((r) => r.id);

const failText = (r: CallErr): string => messageOf(r);

/** 確かめ（previewBulkApproval）：全部は approval_ids を付けない（体 {}＝口の「無ければ全部」）・選んだ物は approval_ids。承認できる物が 0 件・断られたら小窓を開かない */
export function useBulkPreview() {
  const qc = useQueryClient();
  return useCallback(
    async (scope: BulkScope, ids: readonly string[]): Promise<void> => {
      if (state.reading || state.flow) return;
      set({ reading: true, note: null });
      try {
        const r =
          scope === "all"
            ? await call("previewBulkApproval", { screenId: SCREEN })
            : await call("previewBulkApproval", { body: { approval_ids: [...ids] }, screenId: SCREEN });
        if (!r.ok) {
          if (r.status !== 401) set({ note: { tone: "danger", text: failText(r) } }); // 401 は入り直し
          return;
        }
        const p = r.data as unknown as BulkPreview;
        if (!p.eligible?.length) {
          set({ note: { tone: "info", text: NOTHING_TEXT } });
          await qc.invalidateQueries({ queryKey: queueKey });
          return;
        }
        set({ flow: { scope, preview: p, busy: false, error: null } });
      } finally {
        set({ reading: false });
      }
    },
    [qc],
  );
}

interface BulkResult {
  updated: UpdatedItem[];
  skipped: SkippedItem[];
}

/** 承認（bulkApprove）：確かめで見た物だけを送る。待つ間は小窓を閉じず、二度押しでも 1 回 */
export function useBulkApprove() {
  const qc = useQueryClient();
  const approve = useCallback(async (): Promise<void> => {
    const flow = state.flow;
    if (!flow || flow.busy) return;
    set({ flow: { ...flow, busy: true, error: null } });
    const r = await call("bulkApprove", {
      body: { approval_ids: flow.preview.eligible.map((e) => e.approval_id) },
      screenId: SCREEN,
    });
    if (!r.ok) {
      const now = state.flow ?? flow;
      set({ flow: { ...now, busy: false, error: r.status === 401 ? null : failText(r) } });
      return;
    }
    const { updated = [], skipped = [] } = (r.data ?? {}) as unknown as Partial<BulkResult>;
    const note: BulkNote =
      skipped.length > 0
        ? { tone: "warn", text: skippedText(skipped, updated) }
        : { tone: "info", text: doneText(updated) };
    set({ flow: null, picked: [], note });
    await qc.invalidateQueries({ queryKey: queueKey });
  }, [qc]);
  /** ［やめる］・Esc：口を呼ばず閉じる（選んだ印は残る）。答えを待つ間は閉じない */
  const cancel = useCallback((): void => {
    if (state.flow && !state.flow.busy) set({ flow: null });
  }, []);
  return { approve, cancel };
}
