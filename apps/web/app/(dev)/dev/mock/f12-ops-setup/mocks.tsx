// 段 13（F12）の下絵のモック：運営：パスキーを付ける（部品先行・枝 c/段13）。
//   K-1003 が部品 features/F12/ops/ops-setup.tsx と一緒に運ぶ（K-941 の置き場 f12-ops は後の葉の部品を読まない）
//   本番と同じ部品を、決めた値で並べる。1 つの id ＝ 1 つの状態。ticket・leaf は持ち主の画面の葉（切り方 1 章）
export interface MockEntry {
  id: string;
  /** 下絵の番号（段 13 の下絵の表の no） */
  no: string;
  screen: "ops-team";
  label: string;
  ticket: string;
  leaf: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "op-setup",
    no: "9-6",
    screen: "ops-team",
    label: "パスキーを付ける（メールのリンクで開く・名前の欄・パスキーしか使えない）",
    ticket: "K-1003",
    leaf: "K-1003",
  },
  {
    id: "op-setup-done",
    no: "9-7",
    screen: "ops-team",
    label: "パスキーを付けた（運営のログインへ）",
    ticket: "K-1003",
    leaf: "K-1003",
  },
  {
    id: "op-setup-invalid",
    no: "9-8",
    screen: "ops-team",
    label: "パスキーを付ける：使えないリンク（期限切れ・使った）",
    ticket: "K-1003",
    leaf: "K-1003",
  },
  {
    id: "op-setup-failed",
    no: "9-9",
    screen: "ops-team",
    label: "パスキーを付ける：付けられなかった（もう一度）",
    ticket: "K-1003",
    leaf: "K-1003",
  },
];
