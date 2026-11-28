"use client";
// 確認のコードの 6 つの枠（K-221・キャンバス Auth2FA）。1 つの枠に数字 1 つ。打つと次の枠へ・Backspace で前へ・
//   6 けたの貼り付けと自動入力（認証アプリ・パスワードの道具の one-time-code）は 1 字ずつ配る・全角の数字は半角にそろえる・
//   日本語の変換中は値をそのまま見せ、確定したときに入れる。6 つそろったかの判定と送るのは親（login-form.tsx）
import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";

export const CODE_LENGTH = 6;
export const EMPTY_CODE: readonly string[] = Array.from({ length: CODE_LENGTH }, () => "");

/** 全角を半角にそろえ、数字だけを残す */
const digitsOf = (v: string): string[] => [...v.normalize("NFKC").replace(/\D/g, "")];

/** i 番目から数字を順に入れた新しい並び（はみ出した分は捨てる） */
function placeFrom(code: readonly string[], i: number, ds: readonly string[]): string[] {
  return code.map((d, k) => (k >= i && k - i < ds.length ? ds[k - i]! : d));
}

/** 入っている枠に 1 字打ったときの、打った字（前の値との違いで決める。カーソルの位置に依らない）。打ち替えでなければ null */
function typedOver(raw: string, prev: string): string | null {
  const chars = [...raw];
  if (chars.length === 1) return chars[0]!;
  if (chars.length !== 2 || !prev || !chars.includes(prev)) return null;
  return chars[0] === prev ? chars[1]! : chars[0]!;
}

interface CodeBoxesProps {
  code: readonly string[];
  onCode: (next: string[]) => void;
  inputs: RefObject<(HTMLInputElement | null)[]>;
}

export function CodeBoxes({ code, onCode, inputs }: CodeBoxesProps) {
  // 変換中の枠の、確定前の字（変換中は値を書き換えない・次の枠へ移らない）
  const [draft, setDraft] = useState<{ i: number; text: string } | null>(null);
  const composing = useRef(false);
  const focusAt = (i: number) => inputs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();

  const put = (i: number, raw: string) => {
    if (raw === "") {
      onCode(code.map((d, k) => (k === i ? "" : d)));
      return;
    }
    const one = typedOver(raw, code[i] ?? "");
    if (one !== null) {
      const d = digitsOf(one);
      if (!d.length) return; // 数字でない字は無視する（枠は元のまま・フォーカスも動かさない）
      if (i + 1 < CODE_LENGTH) focusAt(i + 1);
      onCode(code.map((x, k) => (k === i ? d[0]! : x)));
      return;
    }
    const ds = digitsOf(raw);
    if (!ds.length) return;
    if (i + ds.length < CODE_LENGTH) focusAt(i + ds.length);
    onCode(placeFrom(code, i, ds));
  };

  const onChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (composing.current || (e.nativeEvent as InputEvent).isComposing) {
      setDraft({ i, text: raw });
      return;
    }
    put(i, raw);
  };
  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (composing.current || e.key !== "Backspace" || code[i] || i === 0) return;
    e.preventDefault();
    focusAt(i - 1);
    onCode(code.map((d, k) => (k === i - 1 ? "" : d)));
  };
  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    put(i, e.clipboardData.getData("text/plain"));
  };

  return (
    <div className="k-login-code" role="group" aria-label="確認のコード">
      {code.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          className="k-login-code-box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`確認のコード ${i + 1} けた目`}
          value={draft?.i === i ? draft.text : d}
          // 入っている枠に来たら全部を選び、打った字で置き換える（マウスを離したときに選びが外れないようにする）
          onFocus={(e) => e.currentTarget.select()}
          onMouseUp={(e) => e.preventDefault()}
          onChange={onChange(i)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            const text = e.currentTarget.value;
            setDraft(null);
            if (text !== d) put(i, text); // 変換をやめた（値が変わらない）ときは何もしない
          }}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
        />
      ))}
    </div>
  );
}
