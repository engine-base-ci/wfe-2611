// 作る面の差し込み口の props の型（K-442 が置く・中身は K-443・K-444・K-580 が先のファイルで足す）。
//   create-slots.tsx が再 export する。CreateLink の型は K-580 がここから読む

/** 親（K-443）：見出しの上の入口（top）と項目の表の「親」の行（row）の 2 か所に同じ値で出す */
export interface ParentSlotProps {
  place: "top" | "row";
  value: string | null;
  onChange: (id: string | null) => void;
  /** 欄の下に出す文 */
  error?: string;
  /** 親の担当者を写す（「親と同じ担当者にする」） */
  onCopy: (assigneeId: string) => void;
  /** 今の期限（親の期限との比べ） */
  due: string | null;
}

/** 期限（K-444）：項目の表の「期限」の行 */
export interface DueSlotProps {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

/** つながりの種類（作る口の links の kind と同じ） */
export type CreateLinkKind = "related" | "derived_from";

/** 作る面で足した相手（K-580 の create-links-model が使う・下書きにも残す）。作る口へは種類と id だけを送る */
export interface CreateLink {
  kind: CreateLinkKind;
  /** 相手のチケットの id */
  id: string;
  /** 「EG-097」など（画面に出すだけ・送らない） */
  number: string;
  title: string;
  stage?: { key: string | null; name: string };
}

/** つながり（K-580）：「＋ つながりを足す」 */
export interface LinksSlotProps {
  value: CreateLink[];
  onChange: (next: CreateLink[]) => void;
  /** 作る口を送っている間 */
  busy: boolean;
  /** 今の題名 */
  title: string;
}
