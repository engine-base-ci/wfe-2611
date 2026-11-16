"use client";
// 確認のコードの 6 つの枠（K-221・キャンバス Auth2FA）。1 つの枠に数字 1 つ。打つと次の枠へ・Backspace で前へ・
//   6 けたの貼り付けは 1 字ずつ入れる・全角の数字は半角にそろえる。6 つそろったかの判定と送るのは親（login-form.tsx）
import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";

export const CODE_LENGTH = 6;
export const EMPTY_CODE: readonly string[] = Array.from({ length: CODE_LENGTH }, () => "");

/** 全角を半角にそろえ、数字だけを残す */
const digitsOf = (v: string): string[] => [...v.normalize("NFKC").replace(/\D/g, "")];

/** i 番目から数字を順に入れた新しい並び（はみ出した分は捨てる） */
function placeFrom(code: readonly string[], i: number, ds: readonly string[]): string[] {
  return code.map((d, k) => (k >= i && k - i < ds.length ? ds[k - i]! : d));
}

interface CodeBoxesProps {
  code: readonly string[];
  onCode: (next: string[]) => void;
  inputs: RefObject<(HTMLInputElement | null)[]>;
}

export function CodeBoxes({ code, onCode, inputs }: CodeBoxesProps) {
  const focusAt = (i: number) => inputs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();
  const put = (i: number, raw: string) => {
    const ds = digitsOf(raw);
    if (!ds.length) {
      onCode(code.map((d, k) => (k === i ? "" : d)));
      return;
    }
    const next = placeFrom(code, i, ds);
    if (i + ds.length < CODE_LENGTH) focusAt(i + ds.length);
    onCode(next);
  };
  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || code[i] || i === 0) return;
    e.preventDefault();
    focusAt(i - 1);
    onCode(code.map((d, k) => (k === i - 1 ? "" : d)));
  };
  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    put(i, e.clipboardData.getData("text/plain"));
  };
  return (
    <div className="k-code" role="group" aria-label="確認のコード">
      {code.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          className="k-code-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`確認のコード ${i + 1} けた目`}
          value={d}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => put(i, e.target.value)}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
        />
      ))}
    </div>
  );
}
