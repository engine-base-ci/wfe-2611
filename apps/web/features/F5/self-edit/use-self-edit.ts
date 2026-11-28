"use client";
// 自分で直す（K-743）の頁の中の箱。承認の id ごとに、直す面の開け閉め・書いている字・もとにした版・先に変わっていた印・直した後の版を持つ。
//   更新は新しい値を作って入れ替える（元の値は変えない）。再読み込みで消える（書きかけは残さない・TP-CRUD-06）
import { useSyncExternalStore } from "react";

export interface SelfEditState {
  open: boolean;
  text: string;
  /** 面の見出しの「版 N をもとに」と、送る体の version */
  baseVersion: number;
  /** 先にほかの人が直していた（E-APR-020）：保存を押せない */
  stale: boolean;
  saving: boolean;
  /** 直して保存した版（カードの下の 1 行・その画面にいる間だけ） */
  edited: { version: number; who: string } | null;
}
const CLOSED: SelfEditState = Object.freeze({
  open: false,
  text: "",
  baseVersion: 0,
  stale: false,
  saving: false,
  edited: null,
});

let states: ReadonlyMap<string, SelfEditState> = new Map();
const listeners = new Set<() => void>();
/** 面を閉じた後に焦点を戻す［自分で直す］のボタン・帯の読み直し（承認の帯の props が持つ） */
const actButtons = new Map<string, HTMLButtonElement>();
const changed = new Map<string, () => Promise<void>>();

function put(id: string, next: SelfEditState): void {
  const m = new Map(states);
  m.set(id, next);
  states = m;
  for (const l of listeners) l();
}
const get = (id: string): SelfEditState => states.get(id) ?? CLOSED;

export const selfEdit = {
  get,
  open(id: string, artifact: { version: number; text: string }): void {
    put(id, {
      ...get(id),
      open: true,
      text: artifact.text,
      baseVersion: artifact.version,
      stale: false,
      saving: false,
    });
  },
  close(id: string, focusBack = false): void {
    put(id, { ...get(id), open: false, text: "", stale: false, saving: false });
    if (focusBack) actButtons.get(id)?.focus();
  },
  write(id: string, text: string): void {
    put(id, { ...get(id), text });
  },
  saving(id: string, saving: boolean): void {
    put(id, { ...get(id), saving });
  },
  stale(id: string, version: number): void {
    put(id, { ...get(id), stale: true, saving: false, baseVersion: version });
  },
  saved(id: string, version: number, who: string): void {
    put(id, { ...get(id), open: false, text: "", stale: false, saving: false, edited: { version, who } });
  },
  forget(id: string): void {
    if (!states.has(id)) return;
    const m = new Map(states);
    m.delete(id);
    states = m;
    for (const l of listeners) l();
  },
  setButton(id: string, el: HTMLButtonElement | null): void {
    if (el) actButtons.set(id, el);
    else actButtons.delete(id);
  },
  setOnChanged(id: string, fn: (() => Promise<void>) | null): void {
    if (fn) changed.set(id, fn);
    else changed.delete(id);
  },
  onChanged(id: string): Promise<void> {
    return changed.get(id)?.() ?? Promise.resolve();
  },
};

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSelfEdit(id: string): SelfEditState {
  return useSyncExternalStore(
    subscribe,
    () => get(id),
    () => CLOSED,
  );
}
