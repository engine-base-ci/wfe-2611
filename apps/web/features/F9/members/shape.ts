// メンバーの画面（K-710）：口の答え（getWorkspaceMembers・K-419）→ グループの行の値（札の色・札の字・マネージャーの行・初めに開く物・見出しの字・開き閉じ）。
//   画面の外の純粋な関数（@/ を読まない・口は呼ばない）。並びは口の答えのまま（作った順・上のグループが先）
export type GroupTone = "teal" | "plum" | "amber";

/** 札の色を回す順（外枠のグループの札と同じ決め・色は人で変わらない） */
const TONES: readonly GroupTone[] = ["teal", "plum", "amber"];

/** 口の答えの人（このファイルが読む欄だけ） */
export interface ShapeMember {
  name: string;
  /** そのグループでの役（scope_memberships.role・無ければ null。口が欄を付けないときも無いと読む） */
  group_role?: string | null | undefined;
  /** このグループが主の所属か */
  primary?: boolean;
  /** 自分か */
  self?: boolean;
}
/** 口の答えのグループ（このファイルが読む欄だけ） */
export interface ShapeGroup {
  id: string;
  /** scopes.ticket_prefix（無ければ null） */
  code: string | null;
  name: string;
  members: readonly ShapeMember[];
}

/** 口の並び（作った順）の i 番目の札の色 */
export const toneOf = (index: number): GroupTone => TONES[index % TONES.length]!;

/** 札の字：口の code（無ければグループ名の頭 1 字） */
export const groupKey = (group: Pick<ShapeGroup, "code" | "name">): string =>
  group.code || Array.from(group.name)[0] || "";

/** 「マネージャー：<名前>」（group_role が manager の人を「・」でつなぐ・いなければ「なし」） */
export function managerLine(members: readonly Pick<ShapeMember, "name" | "group_role">[]): string {
  const names = members.filter((m) => m.group_role === "manager").map((m) => m.name);
  return `マネージャー：${names.length ? names.join("・") : "なし"}`;
}

/** 初めに開くグループの札の字：自分が主の所属で入っているグループだけ（どこにも無ければ最初のグループ・0 なら空） */
export function initialOpen(groups: readonly ShapeGroup[]): string[] {
  const mine = groups.filter((g) => g.members.some((m) => m.self === true && m.primary !== false)).map(groupKey);
  if (mine.length > 0) return mine;
  const first = groups[0];
  return first ? [groupKey(first)] : [];
}

/** 見出しの下の字 */
export const headSub = (groupCount: number, peopleTotal: number): string =>
  `${groupCount} つのグループ ・ ${peopleTotal} 人。グループを押すと、そのグループのメンバーが出ます`;

/** 重ねない人数：口の count から招待中の数を引く（0 を下回らない） */
export const peopleTotal = (answer: { count: number; invitations: readonly unknown[] }): number =>
  Math.max(0, answer.count - answer.invitations.length);

/** 開き閉じ：開いていなければ足し、開いていれば外す（元の配列を変えない） */
export const toggled = (open: readonly string[], key: string): string[] =>
  open.includes(key) ? open.filter((k) => k !== key) : [...open, key];
