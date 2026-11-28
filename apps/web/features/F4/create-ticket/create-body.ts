// 作る面の本文の持ち方（K-442）。本文は 1 枚の文書の木（K-561 の Doc）で、最初は種別のひな形（薄い節＝attrs.ghost が true）が入る。
//   edited＝本文の部品の onChange が 1 回でも来た（人が触った）・dismissed＝「ひな形を消す」を押した。
//   種別を変えたとき：触っていなければ新しい種別のひな形に入れ替える。書いた後・消した後は今の本文のまま（書いた物を黙って消さない）。
//   作る口に送るのは薄い節を落とした木だけ（text は口が docToText で作る・K-437）。どの関数も新しい物を返し、渡した木を変えない
import { emptyDoc, type Doc } from "@kaname/contracts";

export interface BodyState {
  doc: Doc;
  edited: boolean;
  dismissed: boolean;
}

/** ひな形を持つ種別（種別の口 listTicketKinds の答えの 1 行のうち、本文に要る所だけ） */
export interface BodyKind {
  body_template?: Doc | null;
}

const isGhost = (n: unknown): boolean => {
  const attrs = (n as { attrs?: { ghost?: unknown } } | null)?.attrs;
  return attrs?.ghost === true;
};

/** 薄い節（attrs.ghost が true の節）だけを取り除いた新しい木 */
export function stripGhost(doc: Doc): Doc {
  return { type: "doc", content: doc.content.filter((n) => !isGhost(n)) };
}

const templateOf = (kind: BodyKind | undefined): Doc => kind?.body_template ?? emptyDoc();

/** 開いた直後：今の種別のひな形（無ければ空の木） */
export function initialBody(kind: BodyKind | undefined): BodyState {
  return { doc: templateOf(kind), edited: false, dismissed: false };
}

/** 本文の部品から変わった木が来た（人が触った） */
export function onBodyEdit(s: BodyState, doc: Doc): BodyState {
  return { ...s, doc, edited: true };
}

/** 「ひな形を消す」：薄い節だけ消し、書いた字は残す。以後は種別を変えてもひな形を入れない */
export function dismissTemplate(s: BodyState): BodyState {
  return { ...s, doc: stripGhost(s.doc), dismissed: true };
}

/** 種別を変えた：触っていなければ新しい種別のひな形（無ければ空）・書いた後と消した後は今のまま */
export function bodyOnKindChange(s: BodyState, next: BodyKind | undefined): BodyState {
  if (s.dismissed || s.edited) return s;
  return { ...s, doc: templateOf(next) };
}

/** 本文に薄い節が残っているか（ひな形の注と「ひな形を消す」を出すか） */
export const hasGhost = (doc: Doc): boolean => doc.content.some(isGhost);

/** 作る口に送る本文：薄い節を落とした木だけ（text は付けない） */
export function toCreateBody(s: BodyState): { doc: Doc } {
  return { doc: stripGhost(s.doc) };
}
