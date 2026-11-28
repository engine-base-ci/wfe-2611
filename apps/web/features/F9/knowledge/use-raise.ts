"use client";
// K-692「上の棚に上げる」の状態と口（requestKnowledgeRaise・withdrawKnowledgeRequest・dismissKnowledgeRequest・K-687）。
//   頼む小窓（フォルダ・ひとこと・送っている間・欄の誤り・赤い箱）と帯の送っている間を持つ。頼む前に似たページを探す（K-691 の useSimilarCheck）。
//   更新は新しい値を作って入れ替える。答えを待つ間は二度目を送らない
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { errorText, useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { pageTarget } from "./must-shape";
import type { PageCtx } from "./page-slots";
import { RAISE_ROOT, messageProblem, raiseBody, raiseDoneText, raiseToOf, type RaiseTo } from "./raise-shape";
import { useSimilarCheck } from "./similar-check";
import { TREE_KEY, pageKey } from "./use-knowledge";
import { boxCodeOf } from "./use-page-writing";

const SCREEN = "knowledge";
/** 入れるフォルダが上げる先の棚でない（欄の下に出す） */
const FOLDER_CODE = "E-KNW-103";
/** 別のタブで先に頼んでいた（小窓を閉じて読み直す） */
const TAKEN_CODE = "E-KNW-011";
const RAISE_LABEL = "上の棚に上げる";
/** 焦点を戻す先が出るまで待つ回数（描き直しの回数） */
const REFOCUS_FRAMES = 60;

export interface RaiseState {
  open: boolean;
  to: RaiseTo;
  folder: string;
  message: string;
  busy: boolean;
  messageError: string | null;
  /** 正本の ID */
  folderError: string | null;
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
const codeIs = (err: Err, code: string): boolean => err !== "network" && err.code === code;
/** 読み直す断り（もう決まっている・もう無い）：404・409 */
const needsReread = (err: Err): boolean => err !== "network" && (err.status === 404 || err.status === 409);

/** 「上の棚に上げる」に焦点を戻す（押せる形で出るまで描き直しを待つ） */
function focusRaiseButton(): void {
  if (typeof window === "undefined") return;
  let n = 0;
  const step = (): void => {
    const el = [...document.querySelectorAll<HTMLButtonElement>(".k-f9-acts button")].find(
      (b) => b.textContent?.trim() === RAISE_LABEL,
    );
    if (el) {
      if (document.activeElement !== el) el.focus();
      return;
    }
    if (++n < REFOCUS_FRAMES) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

export interface UseRaise {
  state: RaiseState | null;
  bandBusy: boolean;
  similarDialog: ReactNode;
  similarOpen: boolean;
  openRaise: () => void;
  setFolder: (v: string) => void;
  setMessage: (v: string) => void;
  submitRaise: () => Promise<void>;
  withdraw: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  close: () => void;
}

export function useRaise(ctx: PageCtx): UseRaise {
  const qc = useQueryClient();
  const notify = useNotify();
  const sim = useSimilarCheck();
  const [state, setStateRaw] = useState<RaiseState | null>(null);
  const [bandBusy, setBandBusy] = useState(false);
  const stateRef = useRef<RaiseState | null>(null);
  const busyRef = useRef(false);
  const bandRef = useRef(false);
  const page = ctx.page;

  const put = (next: RaiseState | null): void => {
    stateRef.current = next;
    setStateRaw(next);
  };
  const patch = (over: Partial<RaiseState>): void => {
    const cur = stateRef.current;
    if (cur) put({ ...cur, ...over });
  };
  const reloadWait = async (id: string): Promise<void> => {
    await Promise.all([qc.refetchQueries({ queryKey: pageKey(id) }), qc.refetchQueries({ queryKey: TREE_KEY })]);
  };
  const failNotify = (err: Err): void => {
    notify(errorText(boxCodeOf(err)).title, { type: "error" });
  };

  const openRaise = (): void => {
    const to = raiseToOf(page?.raise_to);
    if (!page || !to || busyRef.current) return;
    put({
      open: true,
      to,
      folder: RAISE_ROOT,
      message: "",
      busy: false,
      messageError: null,
      folderError: null,
      error: null,
    });
  };

  const close = (): void => {
    const cur = stateRef.current;
    if (!cur || cur.busy) return;
    put(null);
    focusRaiseButton();
  };

  const raiseFailed = async (pageId: string, err: Err): Promise<void> => {
    if (codeIs(err, TAKEN_CODE)) {
      put(null);
      failNotify(err);
      await reloadWait(pageId);
      return;
    }
    if (codeIs(err, FOLDER_CODE)) {
      patch({ busy: false, folderError: FOLDER_CODE, error: null });
      return;
    }
    patch({ busy: false, folderError: null, error: boxCodeOf(err) });
  };

  const submitRaise = async (): Promise<void> => {
    const p = page;
    const cur = stateRef.current;
    if (!p || !cur || busyRef.current) return;
    const problem = messageProblem(cur.message);
    if (problem) {
      patch({ messageError: problem });
      return;
    }
    busyRef.current = true;
    patch({ busy: true, messageError: null, folderError: null, error: null });
    try {
      const go = await sim.check({
        page_id: p.id,
        title: p.title,
        desc: p.desc,
        text: p.body?.text ?? "",
        when: "raise",
        target: pageTarget(p.place, p.title),
      });
      if (!go) {
        patch({ busy: false });
        return;
      }
      const latest = stateRef.current ?? cur;
      const body = raiseBody({
        groupId: p.place.shelf === "me" ? latest.to.group_id : null,
        folder: latest.folder,
        message: latest.message,
      });
      const r = await safe(() => call("requestKnowledgeRaise", { params: { id: p.id }, body, screenId: SCREEN }));
      if (!r.ok) return await raiseFailed(p.id, r.err);
      put(null);
      await reloadWait(p.id);
      notify(raiseDoneText(r.data.state, r.data.to_name ?? latest.to.shelf_name));
    } finally {
      busyRef.current = false;
    }
  };

  const endRequest = async (run: () => Promise<{ ok: true; data: unknown } | CallErr>, done: string): Promise<void> => {
    const p = page;
    if (!p || bandRef.current) return;
    bandRef.current = true;
    setBandBusy(true);
    try {
      const r = await safe(run);
      if (r.ok) {
        await reloadWait(p.id);
        notify(done);
        return;
      }
      failNotify(r.err);
      if (needsReread(r.err)) await reloadWait(p.id);
    } finally {
      bandRef.current = false;
      setBandBusy(false);
    }
  };

  const withdraw = (id: string): Promise<void> =>
    endRequest(() => call("withdrawKnowledgeRequest", { params: { id }, screenId: SCREEN }), "取り下げました");
  const dismiss = (id: string): Promise<void> =>
    endRequest(
      () => call("dismissKnowledgeRequest", { params: { id }, body: {}, screenId: SCREEN }),
      "お知らせを消しました",
    );

  return {
    state,
    bandBusy,
    similarDialog: sim.dialog,
    similarOpen: sim.open,
    openRaise,
    setFolder: (v) => patch({ folder: v, folderError: null }),
    setMessage: (v) => patch({ message: v, messageError: null }),
    submitRaise,
    withdraw,
    dismiss,
    close,
  };
}
