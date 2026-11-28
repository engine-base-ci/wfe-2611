// 本文の道具の帯（K-226・正本 components.doc-toolbar・doc-tool・キャンバス TicketDetail・Create）。
//   14 個の道具はキャンバスの順に出す。どれもまだ使えないので、押せない形（aria-disabled・Tab で止まらない・薄さは正本の使えない状態）で出す（D-145.8・D-145.9）
//   右に note（「「/」で部品を入れる ・ 本文の版 N」など）と children（「版と差分」など）を並べる。
//   詳細の帯だけの違い（左右の余白・上の線・上に貼り付く）は使う画面の CSS が上書きする（部品の素の規則は変えない）
import type { ReactNode } from "react";

/** 道具の名前（読み上げ・title）と帯に出す字。キャンバスの順 */
export const DOC_TOOL_ITEMS: readonly { label: string; glyph: string }[] = [
  { label: "太字", glyph: "B" },
  { label: "斜体", glyph: "I" },
  { label: "見出し", glyph: "見出し" },
  { label: "箇条書き", glyph: "・" },
  { label: "番号つき", glyph: "1." },
  { label: "チェックリスト", glyph: "☐" },
  { label: "表", glyph: "表" },
  { label: "画像・添付", glyph: "画像" },
  { label: "引用", glyph: "引用" },
  { label: "コード", glyph: "</>" },
  { label: "注意の枠", glyph: "注意" },
  { label: "チケットを引く", glyph: "#" },
  { label: "人を呼ぶ", glyph: "@" },
  { label: "リンク", glyph: "リンク" },
];

export interface DocToolsProps {
  /** 帯の名前（詳細は「本文の道具」・作る画面は「文書の道具」） */
  label: string;
  /** 帯の右の説明の字 */
  note?: ReactNode;
  /** 説明の右に置く物（押せない「版と差分」など） */
  children?: ReactNode;
}

export function DocTools({ label, note, children }: DocToolsProps) {
  return (
    <div role="toolbar" aria-label={label} className="k-doc-tools">
      {DOC_TOOL_ITEMS.map((t) => (
        <button
          key={t.label}
          type="button"
          aria-label={t.label}
          title={`${t.label}（まだ使えません）`}
          aria-disabled="true"
          tabIndex={-1}
        >
          {t.glyph}
        </button>
      ))}
      {note || children ? (
        <span className="k-doc-tools-note">
          {note}
          {children}
        </span>
      ) : null}
    </div>
  );
}
