// 段 13（F12）の下絵のモック：運営：請求書の型（部品先行・枝 c/段13）。
//   K-1108 が部品 features/F12/ops2/views-invoice-template.tsx と一緒に運ぶ（K-941・K-942 の置き場は後の葉の部品を読まない）
//   本番と同じ部品を、決めた値で並べる。1 つの id ＝ 1 つの状態。ticket・leaf は持ち主の画面の葉（切り方 1 章）
export interface MockEntry {
  id: string;
  /** 下絵の番号（段 13 の下絵の表の no） */
  no: string;
  screen: "ops-billing";
  label: string;
  ticket: string;
  leaf: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "op-invoice-template",
    no: "12-5",
    screen: "ops-billing",
    label: "請求書の型の設定：見る（出す側の会社の情報・振込先・備考）",
    ticket: "K-1108",
    leaf: "K-1108",
  },
  {
    id: "op-invoice-template-edit",
    no: "12-6",
    screen: "ops-billing",
    label: "請求書の型の設定：直す",
    ticket: "K-1108",
    leaf: "K-1108",
  },
  {
    id: "op-invoice-template-failed",
    no: "12-7",
    screen: "ops-billing",
    label: "請求書の型の設定：保存できなかった（書いた値は残る）",
    ticket: "K-1108",
    leaf: "K-1108",
  },
];
