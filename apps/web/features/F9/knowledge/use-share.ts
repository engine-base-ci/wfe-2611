"use client";
// K-693「グループを選んで共有」の状態と口（getKnowledgeShares・setKnowledgeShares・K-689）。
//   小窓（開いているか・読んだ groups・選び・読んでいる間・送っている間・赤い箱）を持つ。更新は新しい値を作って入れ替える。
//   開いた時点で読む口を 1 回・答えを待つ間は二度目を送らない。やめる・Esc・× は口を呼ばず閉じ、選びは捨てる
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText, useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { PageCtx } from "./page-slots";
import { initialSelection, shareBody, shareDiff, shareDoneText, type ShareGroupAnswer } from "./share-shape";
import { TREE_KEY, pageKey } from "./use-knowledge";

const SCREEN = "knowledge";
/** 別のタブで先に上げるのを頼んでいた（小窓を閉じて読み直す） */
const TAKEN_CODE = "E-KNW-011";
const SHARE_LABEL = "グループを選んで共有";
/** 焦点を戻す先が出るまで待つ回数（描き直しの回数） */
const REFOCUS_FRAMES = 60;

export interface ShareState {
  pageId: string;
  /** 読む口の答え（読む前・読めなかったときは null） */
  groups: readonly ShareGroupAnswer[] | null;
  fromGroupName: string;
  selected: ReadonlySet<string>;
  /** 付け外しした順（最後に触った物が後ろ・外す注意の名前の順） */
  touched: readonly string[];
  loading: boolean;
  busy: boolean;
  /** 赤い箱の正本の ID */
  error: string | null;
}

type Err = CallErr | "network";
type Reply<T> = { ok: true; data: T } | { ok: false; err: Err };
async function safe<T>(run: () => Promise<{ ok: true; data: T } | CallErr>): Promise<Reply<T>> {
  try {
    const r = await run();
    return r.ok ? { ok: true, data: r.data } : { ok: false, err: r };
  } catch {
    return { ok: false, err: "network" };
  }
}
/** 赤い箱・お知らせに出す正本の ID（網の切れ＝E-PAGE-008・503＝E-PAGE-003・ほかは口の答えから） */
export function shareErrorCode(err: Err): string {
  if (err === "network") return PAGE_ERROR.offline;
  if (err.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(err);
}
const codeIs = (err: Err, code: string): boolean => err !== "network" && err.code === code;

interface SharesData {
  from_group_name?: string;
  groups?: readonly ShareGroupAnswer[];
}
const groupsOf = (d: unknown): readonly ShareGroupAnswer[] => (d as SharesData | undefined)?.groups ?? [];

/** 「グループを選んで共有」に焦点を戻す（描き直しの後に出るまで待つ） */
function focusShareButton(): void {
  if (typeof window === "undefined") return;
  let n = 0;
  const step = (): void => {
    const el = [...document.querySelectorAll<HTMLButtonElement>(".k-f9-acts button")].find(
      (b) => b.textContent?.trim() === SHARE_LABEL,
    );
    if (el) {
      if (document.activeElement !== el) el.focus();
      return;
    }
    if (++n < REFOCUS_FRAMES) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

export interface UseShare {
  state: ShareState | null;
  openShare: () => void;
  toggle: (groupId: string) => void;
  submitShare: () => Promise<void>;
  close: () => void;
}

export function useShare(ctx: PageCtx): UseShare {
  const qc = useQueryClient();
  const notify = useNotify();
  const [state, setStateRaw] = useState<ShareState | null>(null);
  const stateRef = useRef<ShareState | null>(null);
  const busyRef = useRef(false);
  /** 開くたびに増やす（閉じた後に届いた読む口の答えを捨てる） */
  const openSeq = useRef(0);
  const page = ctx.page;

  const put = (next: ShareState | null): void => {
    stateRef.current = next;
    setStateRaw(next);
  };
  const patch = (over: Partial<ShareState>): void => {
    const cur = stateRef.current;
    if (cur) put({ ...cur, ...over });
  };
  const reloadWait = async (id: string): Promise<void> => {
    await Promise.all([qc.refetchQueries({ queryKey: pageKey(id) }), qc.refetchQueries({ queryKey: TREE_KEY })]);
  };

  const openShare = (): void => {
    const p = page;
    if (!p || stateRef.current || busyRef.current) return;
    const seq = ++openSeq.current;
    put({
      pageId: p.id,
      groups: null,
      fromGroupName: p.place.shelf_name,
      selected: new Set(),
      touched: [],
      loading: true,
      busy: false,
      error: null,
    });
    void (async () => {
      const r = await safe(() => call("getKnowledgeShares", { query: { page_id: p.id }, screenId: SCREEN }));
      if (seq !== openSeq.current || !stateRef.current) return;
      if (!r.ok) {
        patch({ loading: false, error: shareErrorCode(r.err) });
        return;
      }
      const groups = groupsOf(r.data);
      patch({
        loading: false,
        groups,
        fromGroupName: (r.data as SharesData).from_group_name ?? p.place.shelf_name,
        selected: initialSelection(groups),
      });
    })();
  };

  const close = (): void => {
    const cur = stateRef.current;
    if (!cur || cur.busy) return;
    openSeq.current += 1;
    put(null);
    focusShareButton();
  };

  const toggle = (groupId: string): void => {
    const cur = stateRef.current;
    if (!cur || cur.busy || !cur.groups) return;
    const next = new Set(cur.selected);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    put({ ...cur, selected: next, touched: [...cur.touched.filter((id) => id !== groupId), groupId] });
  };

  const submitShare = async (): Promise<void> => {
    const cur = stateRef.current;
    if (!cur || !cur.groups || busyRef.current) return;
    const before = cur.groups;
    const diff = shareDiff(before, cur.selected);
    if (!diff.added.length && !diff.removed.length) return;
    busyRef.current = true;
    patch({ busy: true, error: null });
    try {
      const body = shareBody(cur.pageId, before, cur.selected);
      const r = await safe(() => call("setKnowledgeShares", { body, screenId: SCREEN }));
      if (!r.ok) {
        if (codeIs(r.err, TAKEN_CODE)) {
          put(null);
          notify(errorText(shareErrorCode(r.err)).title, { type: "error" });
          await reloadWait(cur.pageId);
          return;
        }
        patch({ busy: false, error: shareErrorCode(r.err) });
        return;
      }
      put(null);
      await reloadWait(cur.pageId);
      const text = shareDoneText(before, groupsOf(r.data));
      if (text) notify(text);
    } finally {
      busyRef.current = false;
    }
  };

  return { state, openShare, toggle, submitShare, close };
}
