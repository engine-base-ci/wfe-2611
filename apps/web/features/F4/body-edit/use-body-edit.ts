"use client";
// 本文を直す状態と口（K-447）。本文は 1 枚の文書の木（D-150.35）。口は書き終えたときの updateTicketBody（K-432）だけで、
//   書いている間はこの PC の写し（body-edit-copy.ts）に 0.6 秒まとめて置く。
//   書き終える：①送っている間は二度目を送らない ②書き始めた木と同じなら口を呼ばず閉じる ③{ version, doc } を 1 回送る（text は送らない）
//     ④通ったら詳細を読み直して閉じ、写しを消す。
//   409・E-SEC-004（先に直された）は帯（字は固定・D-150.13）を立てて詳細を読み直し、次は読み直した最新の版で送る。書いた字は残す。
//   401 はログイン切れの帯（入り直しへ勝手に移さない）。それ以外の断りは赤い箱（正本の文）。どれも書いた字は残る。
//   状態は新しい値を作って入れ替える（書き換えない）。最新の詳細は ref から読む（reload() は版を返さない）
import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { call } from "@/lib/api/call";
import { clearDraftCopies } from "@/lib/api/client";
import { errorCodeOf, PAGE_ERROR } from "@/components/k/error-of";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import type { Detail } from "@/features/F4/create-ticket/detail-types";
import {
  COPY_DELAY_MS,
  EMPTY_DOC,
  isDocTree,
  loadCopy,
  nowIso,
  removeCopy,
  sameDoc,
  writeCopy,
} from "./body-edit-copy";

/** 413 の答えに文が無いときの字（口の答えの message と同じ） */
const TOO_LARGE = "送る内容が大きすぎます";

export interface BodyEditState {
  /** 編集の形か */
  open: boolean;
  /** 書いている木 */
  doc: Doc;
  /** 書き始めた木（同じなら書き終えるで口を呼ばない） */
  baseDoc: Doc;
  /** 書き始めた版（写しの base） */
  version: number;
  /** 先に直された後：次は読み直した最新の版で送る */
  useLatest: boolean;
  /** 写しを置いた時刻（ISO） */
  savedAt: string | null;
  /** 写しを置けなかった */
  saveFailed: boolean;
  /** 送っている間 */
  busy: boolean;
  /** 先に直された帯 */
  stale: boolean;
  /** 赤い箱の文 */
  fail: string | null;
  /** ログイン切れの帯 */
  lost: boolean;
  /** やめるの確かめの小窓 */
  confirm: boolean;
}

const CLOSED: BodyEditState = {
  open: false,
  doc: EMPTY_DOC,
  baseDoc: EMPTY_DOC,
  version: 0,
  useLatest: false,
  savedAt: null,
  saveFailed: false,
  busy: false,
  stale: false,
  fail: null,
  lost: false,
  confirm: false,
};

/** 詳細の本文の木と版（本文の行が無ければ空の木と 0） */
export function bodyOf(detail: Detail): { doc: Doc; version: number } {
  const b = detail.body;
  return {
    doc: b && isDocTree(b.doc) ? b.doc : EMPTY_DOC,
    version: b && Number.isInteger(b.version) ? b.version : 0,
  };
}

/** 本文を直せるか：完了したチケットと、前の形（本文の行が無く区画の字だけ）のチケットは直せない */
export function canEditBody(detail: Detail): boolean {
  if (detail.completed || detail.stage?.key === "done") return false;
  const legacy = !detail.body && (detail.sections ?? []).some((s) => (s.body?.text ?? "").trim() !== "");
  return !legacy;
}

const messageOf = (code: string): string => CATALOG[code]?.message ?? CATALOG[PAGE_ERROR.loadFailed]!.message;

export interface BodyEdit {
  state: BodyEditState;
  begin: () => void;
  change: (doc: Doc) => void;
  finish: () => Promise<void>;
  cancel: () => void;
  discard: () => void;
  keepWriting: () => void;
  reread: () => void;
  relogin: () => void;
}

export function useBodyEdit(ticket: SlotTicket): BodyEdit {
  const [state, setState] = useState<BodyEditState>(CLOSED);
  const stateRef = useRef(state);
  stateRef.current = state;
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;
  const timer = useRef<number | null>(null);
  const id = ticket.id;
  const detail = ticket.detail as unknown as Detail;
  const editable = canEditBody(detail);

  const update = useCallback((f: (s: BodyEditState) => BodyEditState) => {
    setState((s) => {
      const n = f(s);
      stateRef.current = n;
      return n;
    });
  }, []);
  const stopTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const latest = useCallback(() => bodyOf(ticketRef.current.detail as unknown as Detail), []);

  // 開いたとき：写しがあれば編集の形で開き直す（読めない写し・直せないチケットの写しは捨てる）
  useEffect(() => {
    if (!editable) {
      removeCopy(id);
      return;
    }
    const c = loadCopy(id);
    if (!c) return;
    const now = latest();
    update(() => ({
      ...CLOSED,
      open: true,
      doc: c.doc,
      baseDoc: now.doc,
      version: c.base,
      savedAt: c.savedAt,
      stale: c.base !== now.version,
    }));
    // 開いた時の 1 回だけ（チケットが替われば id が替わる）
  }, [id, editable, latest, update]);

  useEffect(() => stopTimer, [stopTimer]);

  const close = useCallback(() => {
    stopTimer();
    removeCopy(id);
    update(() => CLOSED);
  }, [id, stopTimer, update]);

  const begin = useCallback(() => {
    const b = latest();
    update(() => ({ ...CLOSED, open: true, doc: b.doc, baseDoc: b.doc, version: b.version }));
  }, [latest, update]);

  const save = useCallback(() => {
    timer.current = null;
    const s = stateRef.current;
    if (!s.open) return;
    const at = nowIso();
    const ok = writeCopy(id, { savedAt: at, doc: s.doc, base: s.version });
    update((p) => (ok ? { ...p, savedAt: at, saveFailed: false } : { ...p, saveFailed: true }));
  }, [id, update]);

  const change = useCallback(
    (doc: Doc) => {
      update((p) => ({ ...p, doc }));
      stopTimer();
      timer.current = window.setTimeout(save, COPY_DELAY_MS);
    },
    [save, stopTimer, update],
  );

  const finish = useCallback(async () => {
    const s = stateRef.current;
    if (!s.open || s.busy) return;
    if (sameDoc(s.doc, s.baseDoc) && !s.stale) {
      close();
      return;
    }
    const version = s.useLatest ? latest().version : s.version;
    update((p) => ({ ...p, busy: true }));
    let r: Awaited<ReturnType<typeof call<"updateTicketBody">>>;
    try {
      // 契約の型は doc を Record<string, unknown> で持つ（木の形は口の validateDoc が確かめる）
      const doc = s.doc as unknown as Record<string, unknown>;
      r = await call("updateTicketBody", { params: { id }, body: { version, doc }, keepOn401: true });
    } catch {
      update((p) => ({ ...p, busy: false, fail: messageOf(PAGE_ERROR.offline) }));
      return;
    }
    if (r.ok) {
      await ticketRef.current.reload();
      close();
      return;
    }
    if (r.status === 409 && r.code === "E-SEC-004") {
      update((p) => ({ ...p, stale: true, fail: null, lost: false }));
      await ticketRef.current.reload();
      update((p) => ({ ...p, busy: false, useLatest: true }));
      return;
    }
    if (r.status === 401) {
      update((p) => ({ ...p, busy: false, lost: true, fail: null }));
      return;
    }
    const text = r.status === 413 ? (r.message ?? TOO_LARGE) : messageOf(errorCodeOf(r));
    update((p) => ({ ...p, busy: false, fail: text, lost: false }));
  }, [close, id, latest, update]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    if (sameDoc(s.doc, s.baseDoc)) {
      close();
      return;
    }
    update((p) => ({ ...p, confirm: true }));
  }, [close, update]);

  const keepWriting = useCallback(() => update((p) => ({ ...p, confirm: false })), [update]);

  /** 先に直された本文を編集欄に読み込む（書いた字は捨てる・口は呼ばない） */
  const reread = useCallback(() => {
    stopTimer();
    removeCopy(id);
    const b = latest();
    update((p) => ({
      ...p,
      doc: b.doc,
      baseDoc: b.doc,
      version: b.version,
      useLatest: false,
      stale: false,
      fail: null,
      savedAt: null,
      saveFailed: false,
    }));
  }, [id, latest, stopTimer, update]);

  /** 写しを消してログインし直す（続きから書けるとは約束しない） */
  const relogin = useCallback(() => {
    stopTimer();
    clearDraftCopies();
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  }, [stopTimer]);

  return { state, begin, change, finish, cancel, discard: close, keepWriting, reread, relogin };
}
