// 自分のメニューとワークスペースの切り替え（K-844）：口 getMe・listMyInvitations の答え → 部品 MeMenuPanel・OrgPanel の値。
//   純粋な関数だけ（@/ を読まない・試験からも使える）
import { initialOf } from "../ws/settings-shape";
import type { MeAnswer, MeRole, MeWorkspace } from "./me-shape";

/** 役割の字（依頼する側は仮・D-154.23） */
export const ROLE_LABEL: Record<MeRole, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧のみ",
  requester: "依頼する側",
};
/** 自分だけの場所の役割の字 */
export const OWN_LABEL = "自分だけ";

export interface MenuWho {
  name: string;
  line: string | null;
  face: { kind: "text" | "image"; initial: string; url: string | null };
}
export interface MenuOrgRow {
  id: string;
  mark: string;
  name: string;
  role: string;
  now: boolean;
}

/** 答えの形を確かめる（違えば null） */
export function asMeAnswer(data: unknown): MeAnswer | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Partial<MeAnswer>;
  if (typeof d.member !== "object" || d.member === null || typeof d.member.name !== "string") return null;
  if (!Array.isArray(d.workspaces)) return null;
  return d as MeAnswer;
}

const firstChar = (s: string): string => Array.from(s.trim())[0] ?? "";
const nowOf = (a: MeAnswer): MeWorkspace | undefined => a.workspaces.find((w) => w.current);

/** 誰か：名前・2 行目（今いる会社 ・ 主のグループ）・顔（今いる会社の物だけ）。読めなければ外枠の名前だけ */
export function whoOf(a: MeAnswer | null, fallbackName: string): MenuWho {
  if (!a)
    return { name: fallbackName, line: null, face: { kind: "text", initial: firstChar(fallbackName), url: null } };
  const m = a.member;
  const now = nowOf(a);
  const company = now?.name ?? a.workspace_name ?? "";
  const line = company ? (now?.group ? `${company} ・ ${now.group}` : company) : null;
  const av = m.avatar;
  const face =
    av?.kind === "image" && av.url
      ? { kind: "image" as const, initial: av.initial, url: av.url }
      : { kind: "text" as const, initial: av?.initial || firstChar(m.name), url: null };
  return { name: m.name, line, face };
}

/** 分身の部屋の副：「<呼ばれ方（無ければ名前）>のAI」（仮）。読めなければ「あなたのAI」 */
export function aiHintOf(a: MeAnswer | null, fallbackName: string): string {
  const n = a ? a.member.call_name?.trim() || a.member.name : fallbackName;
  return n ? `${n}のAI` : "あなたのAI";
}

/** 入っているワークスペースの行（答えの順） */
export function orgRows(a: MeAnswer): MenuOrgRow[] {
  return a.workspaces.map((w) => ({
    id: w.tenant_id,
    mark: initialOf(w.name),
    name: w.name,
    role: w.own ? OWN_LABEL : (ROLE_LABEL[w.role] ?? ""),
    now: w.current,
  }));
}

/** 読めないときの 1 行（今いる会社だけ・外枠の名前） */
export function fallbackOrgRow(workspaceName: string): MenuOrgRow {
  return { id: "", mark: initialOf(workspaceName), name: workspaceName, role: "", now: true };
}

/** PC の行（仮・端末の名前は外枠が持たないので出さない） */
export function pcLine(connected: boolean): { title: string; hint: string } {
  return connected
    ? { title: "PC がつながっている", hint: "分身はこの PC で実行する" }
    : { title: "PC をまだつないでいない", hint: "つなぐと分身が動く" };
}

/** 届いた招待の数（答えの total・無ければ一覧の長さ）。読めなければ null */
export function inviteTotal(data: unknown, metaTotal: unknown): number | null {
  if (typeof metaTotal === "number") return metaTotal;
  if (Array.isArray(data)) return data.length;
  if (typeof data === "object" && data !== null) {
    const d = data as { total?: unknown; invitations?: unknown };
    if (typeof d.total === "number") return d.total;
    if (Array.isArray(d.invitations)) return d.invitations.length;
  }
  return null;
}

/** 届いた招待の行の字（仮：0 件の字） */
export function inviteLine(total: number | null): string {
  if (total === null) return "届いた招待 ›";
  return total > 0 ? `届いた招待 ${total} ›` : "届いた招待はありません";
}

export const ORG_UNREAD = "ワークスペースの一覧を読めませんでした";
export const ORG_GONE = "そのワークスペースには入れません";
