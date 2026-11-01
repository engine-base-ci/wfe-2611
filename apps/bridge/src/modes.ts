// 許可のモードを CLI の引数にする唯一の場所（D-104.14・D-092 ②）。
// 全部許可は、本人がその会話で選んだときだけ仕事に乗ってくる（既定にはできない・Kaname が選ぶことはない）。
// ここ以外で承認を弱める値を書くと scripts/ci/claude-terms.mjs が赤にする。
export const PERMISSION_MODES = ["manual", "acceptEdits", "auto", "plan", "bypassPermissions"] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

/** 仕事に乗ってきたモードを CLI の引数に。知らない値・空は「毎回聞く」（manual）にする */
export function modeArgs(mode: string | null | undefined): string[] {
  const m = (PERMISSION_MODES as readonly string[]).includes(mode ?? "") ? (mode as PermissionMode) : "manual";
  return ["--permission-mode", m];
}

/** モデル・考える強さ・いつも許可のルールを CLI の引数に。形が怪しい値は渡さない */
export function optionArgs(o: { model?: string | null; effort?: string | null; allowed_tools?: string[] | null }): string[] {
  const a: string[] = [];
  if (o.model && /^[a-z0-9.-]{1,40}$/i.test(o.model)) a.push("--model", o.model);
  if (o.effort && (EFFORTS as readonly string[]).includes(o.effort)) a.push("--effort", o.effort);
  const rules = (o.allowed_tools ?? []).filter((r) => /^[A-Za-z][\w-]{0,40}(\(.{0,300}\))?$/s.test(r) && !/[\r\n]/.test(r)).slice(0, 100);
  if (rules.length) a.push("--allowedTools", ...rules);
  return a;
}
