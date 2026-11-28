// 探した字の強調（キャンバス StOverlay の太字）。探した語に当たる所を mark で包む。大文字小文字は同じ扱い。
//   全角半角のそろえ方は口の側（D-128.157）。ここは見えている字の上の色付けだけ。
import { Fragment } from "react";

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function HitMark({ text, terms }: { text: string; terms: readonly string[] }) {
  const ts = terms.filter(Boolean);
  if (ts.length === 0) return <>{text}</>;
  // split の丸括弧に入れると、当たった所が奇数番目に入る
  const parts = text.split(new RegExp(`(${ts.map(escape).join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="k-f7-hit-mark">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
