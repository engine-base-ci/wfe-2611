// 許可のモード（D-104.14）の選択肢。画面で全部許可の値を書いてよいのはここだけ（claude-terms.mjs が検査）。
// 全部許可は本人がその会話で選んだときだけ（既定にできない・選ぶときに何が起きるかを出す）
export const PERMISSION_MODES = ["manual", "acceptEdits", "auto", "plan", "bypassPermissions"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];
/** 既定にできるモード（全部許可は含めない） */
export type DefaultMode = Exclude<PermissionMode, (typeof PERMISSION_MODES)[4]>;
export const ALL_ALLOWED: PermissionMode = PERMISSION_MODES[4];
export const MODES: readonly { id: PermissionMode; label: string; desc: string }[] = [
  { id: "manual", label: "毎回聞く", desc: "道具を使う前に毎回たずねます（既定）" },
  { id: "acceptEdits", label: "編集は自動", desc: "ファイルの編集は聞かずに進め、それ以外は聞きます" },
  { id: "auto", label: "自動で判断", desc: "Claude が危なさを見て、危ないものだけ聞きます" },
  { id: "plan", label: "計画だけ", desc: "動かずに、進め方だけ出します" },
  {
    id: ALL_ALLOWED,
    label: "全部許可",
    desc: "何も聞かずに進めます。外への送信・削除も確かめません。自分で選んだときだけ・この会話だけ",
  },
];
