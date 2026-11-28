// メンバーの画面（K-818）の行の値：口 getWorkspaceMembers（K-419・K-808）の答え → 部品（MembersPage・PersonRow）の形。画面の外の純粋な関数。
//   役割の字：会社の管理者なら「管理者」、そうでなければそのグループの役割（group_role）・無ければ会社の役割の字。役割はグループごと（兼務・D-154.15）
//   状態の字・名前の横の注・最後に使った日（D-154.1）・上の 1 行（気づいてほしいことを知らせるだけ・催促のボタンは持たない）。
//   字のうち下絵に無い物（止まっている人の状態・最後に使った日・上の 1 行の招待中だけの題）は仮
import type { GroupAnswer, InvitedAnswer, MembersAnswer, Person } from "@/features/F10/invite/use-members";
import type { MemberRowData, RoleName } from "./person-row";
import type { GroupData } from "./views";

/** 役割の字 ⇔ 口の role_key（ゲストは段 12 が足す・D-154.23） */
export const ROLE_KEY: Record<RoleName, "admin" | "manager" | "member" | "viewer"> = {
  管理者: "admin",
  マネージャー: "manager",
  メンバー: "member",
  閲覧のみ: "viewer",
};
const LABEL: Record<string, RoleName> = {
  owner: "管理者",
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  staff: "メンバー",
  requester: "メンバー",
  viewer: "閲覧のみ",
};
const labelOf = (key: string | null | undefined): RoleName | undefined => (key ? LABEL[key] : undefined);

/** 7 日以上使っていなければ目立たせる（担当が止まる目安と同じ数・D-154.1） */
const AWAY_DAYS = 7;
const TONES: GroupData["tone"][] = ["teal", "plum", "amber", "indigo"];

/** そのグループの行での役割の字 */
export function rowRole(p: Person): RoleName {
  if (p.role === "admin" || p.role === "owner") return "管理者";
  return labelOf(p.group_role) ?? labelOf(p.role) ?? "メンバー";
}

export function stateText(p: Person): Pick<MemberRowData, "state" | "stateTone"> {
  if (p.suspended) return { state: "一時的に止まっている", stateTone: "warn" };
  switch (p.pc) {
    case "ok":
      return { state: "分身 動いている", stateTone: "ok" };
    case "away":
      return {
        state: p.pc_days_away != null ? `PC ${p.pc_days_away} 日つながっていない` : "PC つながっていない",
        stateTone: "warn",
      };
    case "never":
      return { state: "PC をまだつないでいない", stateTone: "warn" };
    default:
      return { state: "分身なし（見るだけ）", stateTone: "none" };
  }
}

export function lastUsedText(days: number | null | undefined): Pick<MemberRowData, "lastUsed" | "lastUsedAway"> {
  if (days == null) return { lastUsed: "まだ使っていません" };
  if (days <= 0) return { lastUsed: "今日" };
  if (days < AWAY_DAYS) return { lastUsed: `${days} 日前` };
  return { lastUsed: `${days} 日前から使っていない`, lastUsedAway: true };
}

/** 名前の横の注（自分・兼ねている・<名前>も兼ねる） */
export function noteText(p: Person): string | undefined {
  const parts = [
    ...(p.self ? ["自分"] : []),
    ...(p.primary === false ? ["兼ねている"] : []),
    ...(p.other_groups?.length ? [`${p.other_groups.join("・")}も兼ねる`] : []),
  ];
  return parts.length ? parts.join("・") : undefined;
}

function personRow(p: Person): MemberRowData {
  const note = noteText(p);
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: rowRole(p),
    ...stateText(p),
    ...lastUsedText(p.last_used_days),
    ...(note ? { note } : {}),
    ...(p.self ? { self: true } : {}),
  };
}

function invitedRow(v: InvitedAnswer): MemberRowData {
  return {
    id: v.id,
    name: "",
    email: v.email,
    role: labelOf(v.role) ?? "メンバー",
    state: "",
    stateTone: "none",
    invitedLeft: `${v.left_days} 日`,
  };
}

/** 1 つのグループの行（人の並びのあとに、そのグループへの招待中の行） */
export function toRows(group: GroupAnswer, invitations: readonly InvitedAnswer[]): MemberRowData[] {
  return [...group.members.map(personRow), ...invitations.filter((v) => v.scope_id === group.id).map(invitedRow)];
}

/** そのグループのマネージャーの名前（無ければ「なし」・複数は「・」） */
export function managerText(group: GroupAnswer): string {
  const names = group.members.filter((p) => p.group_role === "manager").map((p) => p.name);
  return names.length ? names.join("・") : "なし";
}

/** 口の答え → グループのカードの並び（札の色は前から 4 色を回す・頭の字は ticket_prefix か名前の頭の 1 字） */
export function toGroups(a: MembersAnswer): GroupData[] {
  return a.groups.map((g, i) => ({
    id: g.id,
    code: g.code || g.name.slice(0, 1),
    name: g.name,
    tone: TONES[i % TONES.length]!,
    manager: managerText(g),
    rows: toRows(g, a.invitations),
  }));
}

/** 初めに開くグループの鍵（groupKey）：自分の主のグループ（無ければ最初のグループ） */
export function initialOpen(groups: readonly GroupData[], a: MembersAnswer): string[] {
  const mine = a.groups.findIndex((g) => g.members.some((p) => p.self && p.primary !== false));
  const g = groups[mine >= 0 ? mine : 0];
  return g ? [g.id ?? g.code] : [];
}

export interface BandText {
  title: string;
  sub?: string;
}

/** 上の 1 行：PC がいちばん長くつながっていない人と、招待中の数。どちらも無ければ出さない */
export function bandOf(a: MembersAnswer): BandText | null {
  const seen = new Map<string, Person>();
  for (const g of a.groups) for (const p of g.members) if (p.pc === "away" && !seen.has(p.id)) seen.set(p.id, p);
  const away = [...seen.values()].sort((x, y) => (y.pc_days_away ?? 0) - (x.pc_days_away ?? 0))[0];
  const first = a.invitations[0];
  const invited = first ? `招待中 ${a.invitations.length} 人（${first.email.split("@")[0] ?? ""}@…）` : undefined;
  if (away) {
    const days = away.pc_days_away != null ? `${away.pc_days_away} 日` : "しばらく";
    const sub = [`${away.name}さんの分身は止まっています`, ...(invited ? [invited] : [])].join(" ・ ");
    return { title: `${away.name}さんの PC が ${days}つながっていません`, sub };
  }
  return invited ? { title: invited } : null;
}
