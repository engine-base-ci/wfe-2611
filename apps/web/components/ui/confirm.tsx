"use client";
// 確かめの画面（2026-09-30 user「ブラウザの削除モーダルが出る。サイトのものにして」）。ブラウザの window.confirm は使わない。
// どの画面からも const ok = await confirmDialog({...}) で呼ぶ（1 部品）。置き場は 1 つ（<ConfirmHost />・providers に 1 回）。
// ネイティブの <dialog>（showModal）：後ろを押させない・Esc で閉じる・開いたら「やめる」に focus（取り消せない操作を Enter で誤って押させない）
import { useEffect, useRef, useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** 決めるボタンの文字（既定「はい」） */
  ok?: string;
  /** やめるボタンの文字（既定「やめる」） */
  cancel?: string;
  /** 取り消せない操作（消す等）。決めるボタンを赤くする */
  danger?: boolean;
}
interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const subs = new Set<() => void>();
const emit = () => {
  for (const f of subs) f();
};

/** 確かめる。決めたら true、やめたら（Esc・外を押す・やめる）false */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false); // 前のが開いていたら、やめたことにする
  return new Promise((resolve) => {
    pending = { ...o, resolve };
    emit();
  });
}

const close = (ok: boolean) => {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
};

export function ConfirmHost() {
  const cur = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => pending,
    () => null,
  );
  const ref = useRef<HTMLDialogElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (cur && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!cur && d.open) d.close();
  }, [cur]);
  return (
    <dialog
      ref={ref}
      className="cdlg"
      aria-labelledby="cdlg-t"
      aria-describedby={cur?.body ? "cdlg-b" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) close(false); // 外（背景）を押したらやめる
      }}
      data-confirm
    >
      {cur ? (
        <div className="cdlg-in">
          <div className="cdlg-h">
            {cur.danger ? <AlertTriangle aria-hidden="true" /> : null}
            <b id="cdlg-t">{cur.title}</b>
          </div>
          {cur.body ? (
            <p id="cdlg-b" className="cdlg-b">
              {cur.body}
            </p>
          ) : null}
          <div className="cdlg-f">
            <button type="button" ref={cancelRef} className="cdlg-no" onClick={() => close(false)} data-confirm-cancel>
              {cur.cancel ?? "やめる"}
            </button>
            <button
              type="button"
              className={cur.danger ? "cdlg-ok danger" : "cdlg-ok"}
              onClick={() => close(true)}
              data-confirm-ok
            >
              {cur.ok ?? "はい"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
