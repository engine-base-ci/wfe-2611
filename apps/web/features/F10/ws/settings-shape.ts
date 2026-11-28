// 設定の画面（K-831・company-settings）：口 getWorkspaceSettings の答え（K-827 の「画面が使う答えの形」）を部品の値に直す純粋な関数。
//   ここは @/ を読まない（部品と口に依らずに確かめられる形）。数え方は口 K-827 と同じ（Array.from で数える＝絵文字は 1 字）

/** 「誰ができるか」の鍵と値（K-829） */
export type PermKey = "billing" | "delete_workspace";
export type PermValue = "admin" | "admin_manager";

export interface SettingsAnswer {
  workspace: { id: string; name: string; logo: { kind: "text" | "image"; url: string | null } };
  permissions: { key: PermKey; name: string; detail: string; value: PermValue; options: readonly PermValue[] }[];
  fixed_rules: { key: string; text: string }[];
  deletion: {
    requested_at: string | null;
    delete_at: string | null;
    days_left: number | null;
    requested_by: { id: string; name: string } | null;
    preview: { tickets: number; members: number };
  };
  /** 読んだ人がどの区画を押せるか（K-827・D-154.83）。管理者は全部 true */
  access: { admin: boolean; billing: boolean; delete_workspace: boolean };
}

/** 部品の「誰ができるか」の 1 行（値と選びは字にして渡す） */
export interface WhoRow {
  key: PermKey;
  name: string;
  detail: string;
  value: PermValue;
  options: readonly { value: PermValue; label: string }[];
}

export const NAME_MAX = 100;
const NAME_EMPTY = "名前を入れてください";
const NAME_LONG = `名前は ${NAME_MAX} 文字までです。短くしてください`;

const VALUE_LABEL: Record<PermValue, string> = { admin: "管理者", admin_manager: "管理者とマネージャー" };

/** 「誰ができるか」の値の字 */
export const valueLabel = (v: PermValue): string => VALUE_LABEL[v];

/** 決まっていて変えられない物の字（口の fixed_rules を並べたとおりにつなぐ） */
export const noteText = (rules: readonly { text: string }[]): string => rules.map((r) => r.text).join("");

/** 名前の欄の値を口へ送る形にする（前後の空白を削る。全角の空白も削る） */
export const cleanName = (text: string): string => text.trim();

/** 名前の誤り（空・空白だけ・100 字を超える）。誤りが無ければ undefined */
export function nameProblem(text: string): string | undefined {
  const n = Array.from(cleanName(text)).length;
  if (n === 0) return NAME_EMPTY;
  if (n > NAME_MAX) return NAME_LONG;
  return undefined;
}

/** 名前の欄の字数（打った字のまま数える） */
export const nameCount = (text: string): number => Array.from(text).length;

/** 保存した時刻（日本時間の HH:mm） */
export function clockText(at: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** 口の答えの「誰ができるか」を部品の行に直す */
export function toWhoRows(answer: Pick<SettingsAnswer, "permissions">): WhoRow[] {
  return answer.permissions.map((p) => ({
    key: p.key,
    name: p.name,
    detail: p.detail,
    value: p.value,
    options: p.options.map((o) => ({ value: o, label: valueLabel(o) })),
  }));
}

/** 「誰ができるか」を変えた答え（{ permissions: [{ key, value }] }）で、読んだ答えの値を差し替える（読み直さない） */
export function withPermissions(
  answer: SettingsAnswer,
  changed: readonly { key: PermKey; value: PermValue }[],
): SettingsAnswer {
  return {
    ...answer,
    permissions: answer.permissions.map((p) => {
      const hit = changed.find((c) => c.key === p.key);
      return hit ? { ...p, value: hit.value } : p;
    }),
  };
}

/** 名前を変えた答え（{ workspace }）で差し替える */
export function withWorkspace(answer: SettingsAnswer, workspace: Partial<SettingsAnswer["workspace"]>): SettingsAnswer {
  return { ...answer, workspace: { ...answer.workspace, ...workspace } };
}

/** ロゴを変えた答え（201 { logo }）で差し替える */
export function withLogo(answer: SettingsAnswer, logo: SettingsAnswer["workspace"]["logo"]): SettingsAnswer {
  return { ...answer, workspace: { ...answer.workspace, logo } };
}

/** ロゴの大きさの上限（2 MB・ちょうど 2 MB は送る） */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TOO_BIG = "ロゴは 2 MB までです。小さい画像を選んでください";
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

const CORP = /^(株式会社|有限会社|合同会社)|(株式会社|有限会社|合同会社)$/g;
/** ロゴが文字のときの頭文字（会社の種類の字を外した名前の最初の 1 字・英字は大文字。下絵の「ENGINE BASE」→「E」と同じ形・仮） */
export function initialOf(name: string): string {
  const core = name.replace(CORP, "").trim() || name.trim();
  return (Array.from(core)[0] ?? "").toUpperCase();
}
