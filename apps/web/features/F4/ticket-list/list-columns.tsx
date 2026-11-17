"use client";
// 一覧の列と表示設定（K-251・一覧の共通の部品。「全部」の一覧 K-252 も使う）。
//   列はキャンバス Main どおり 9 つ（種別・番号・題名・状態・担当者・グループ・期限・予定・実績・更新・代表の答え answer=afc3b0f2fdb4。D-128.15 の 7 列を置き換えた）。
//   表示設定で出す列を選べる。番号と題名は外せない。選んだ列はこのブラウザ（localStorage）に覚える（口は足さない）。
//   覚えた値が文字の配列でなければ 9 つ全部。配列なら知っている鍵だけを使い、番号と題名は必ず足す。並びはいつも決まった並び
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

export const COLUMN_KEYS = [
  "kind",
  "number",
  "title",
  "stage",
  "assignee",
  "scope",
  "due",
  "estimate",
  "updated",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  kind: "種別",
  number: "番号",
  title: "題名",
  stage: "状態",
  assignee: "担当者",
  scope: "グループ",
  due: "期限",
  estimate: "予定・実績",
  updated: "更新",
};
/** 外せない列 */
const FIXED = new Set<ColumnKey>(["number", "title"]);
export const COLUMNS_STORAGE = "kaname.ticket-list.columns";

/** 覚えた値を列の並びに直す（壊れていれば全部・知っている鍵だけ・番号と題名は必ず・決まった並び） */
export function parseColumns(raw: string | null): ColumnKey[] {
  if (raw === null) return [...COLUMN_KEYS];
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return [...COLUMN_KEYS];
  }
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return [...COLUMN_KEYS];
  const picked = new Set<string>(v as string[]);
  return COLUMN_KEYS.filter((k) => FIXED.has(k) || picked.has(k));
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(COLUMNS_STORAGE);
  } catch {
    return null;
  }
}
function writeStored(keys: ColumnKey[]): void {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE, JSON.stringify(keys));
  } catch {
    // 覚えられない（容量・プライベートの窓）ときは、この画面の間だけ効く
  }
}

export interface Columns {
  visible: ColumnKey[];
  toggle: (key: ColumnKey, on: boolean) => void;
  reset: () => void;
}

/** 出す列（このブラウザに覚えた値。サーバーで描くときと最初の描画は全部、描いた後に覚えた値に替える） */
export function useColumns(): Columns {
  const [visible, setVisible] = useState<ColumnKey[]>([...COLUMN_KEYS]);
  useEffect(() => {
    setVisible(parseColumns(readStored()));
  }, []);
  const save = useCallback((next: ColumnKey[]) => {
    setVisible(next);
    writeStored(next);
  }, []);
  const toggle = useCallback(
    (key: ColumnKey, on: boolean) => {
      if (FIXED.has(key)) return;
      const set = new Set(visible);
      if (on) set.add(key);
      else set.delete(key);
      save(COLUMN_KEYS.filter((k) => set.has(k)));
    },
    [save, visible],
  );
  const reset = useCallback(() => save([...COLUMN_KEYS]), [save]);
  return { visible, toggle, reset };
}

/** 表示設定（ボタンと、すぐ下に開く見え方の箱）。箱の中は「表に出す列」と、画面ごとの項目（extra）。
 *  Esc・押し直し・箱の外を押すと閉じ、閉じたらボタンに戻る。箱の位置の基準はボタンを包む要素（キャンバス MnView） */
export function ColumnSettings({ columns, title, extra }: { columns: Columns; title: string; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) btn.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);
  return (
    <span className="k-list-columns-anchor">
      <button
        ref={btn}
        type="button"
        className="k-list-tool"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        表示設定
      </button>
      {open ? (
        <div ref={box} id={id} className="k-list-columns" role="dialog" aria-label={title}>
          <div className="k-list-columns-head">
            <b>{title}</b>
            <button type="button" className="k-list-text-btn" onClick={columns.reset}>
              はじめに戻す
            </button>
          </div>
          {extra}
          <div className="k-list-columns-group" role="group" aria-label="表に出す列">
            <p className="k-list-columns-title">表に出す列</p>
            <ul className="k-list-columns-list">
              {COLUMN_KEYS.map((k) => (
                <li key={k}>
                  <label className="k-list-columns-item">
                    <input
                      type="checkbox"
                      checked={columns.visible.includes(k)}
                      disabled={FIXED.has(k)}
                      onChange={(e) => columns.toggle(k, e.target.checked)}
                    />
                    {COLUMN_LABEL[k]}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <p className="k-list-columns-note">自分だけの見え方。このブラウザに覚える（番号と題名は外せない）</p>
        </div>
      ) : null}
    </span>
  );
}
