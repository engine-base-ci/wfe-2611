// 自分の設定（K-839）：口 getMe の答え（K-833 の「画面が使う答えの形」）→ 部品 ProfileBody の値。名前・呼ばれ方の確かめと時刻の字。
//   純粋な関数だけ（@/ を読まない・試験と K-840・K-841 も使う）
import { initialOf } from "../ws/settings-shape";
import type { ProfileState, WsRow } from "./profile";

export type MeRole = "admin" | "manager" | "member" | "viewer" | "requester";
export type MeTheme = "system" | "light" | "dark";
export type MeWeek = 0 | 1;
export type MeZone = "Asia/Tokyo" | "UTC";

export interface MeAvatar {
  kind: "text" | "image";
  initial: string;
  url: string | null;
}
export interface MeMember {
  id: string;
  name: string;
  call_name: string | null;
  email: string;
  avatar: MeAvatar;
  language: "ja";
  theme: MeTheme;
  week_start: MeWeek;
  timezone: MeZone;
  email_pending: string | null;
}
export interface MeWorkspace {
  tenant_id: string;
  name: string;
  role: MeRole;
  group: string | null;
  current: boolean;
  own: boolean;
  last_admin: boolean;
  assigned_total: number;
  assigned: { id: string; number: string; title: string }[];
}
/** getMe の答え（data） */
export interface MeAnswer {
  member: MeMember;
  workspaces: MeWorkspace[];
  workspace_name: string | null;
}
/** updateMe の答え（data） */
export interface MeSaved {
  member: MeMember;
  saved_at: string;
}

export const NAME_MAX = 100;
export const NICK_MAX = 20;
/** 写真の大きさの上限（5 MB ちょうどは送る） */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";

export const NAME_EMPTY = "名前を入れてください";
export const NAME_LONG = `名前は ${NAME_MAX} 文字までです。短くしてください`;
/** 仮（口 K-833 の E-ME-003 と同じ字） */
export const NICK_LONG = `呼ばれ方は ${NICK_MAX} 文字までです。短くしてください`;
export const PHOTO_TOO_BIG = "写真は 5 MB までです。小さい写真を選んでください";
export const SAVE_FAILED = "保存できませんでした。通信を確かめて、もう一度入れ直してください";

/** 字の数（絵文字も 1 字） */
export const charCount = (s: string): number => Array.from(s).length;
/** 前後の空白（全角を含む）を削る */
export const cleanText = (s: string): string => s.trim();

/** 名前の誤り（無ければ null）。空・空白だけ・101 字以上 */
export function nameProblem(text: string): string | null {
  const t = cleanText(text);
  if (t === "") return NAME_EMPTY;
  return charCount(t) > NAME_MAX ? NAME_LONG : null;
}
/** 呼ばれ方の誤り（無ければ null）。空は「文字に戻す」なので誤りではない */
export function nickProblem(text: string): string | null {
  return charCount(cleanText(text)) > NICK_MAX ? NICK_LONG : null;
}

/** 役割の字（依頼する側は仮） */
const ROLE_LABEL: Record<MeRole, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧のみ",
  requester: "依頼する側",
};
export const roleLabel = (r: MeRole): string => ROLE_LABEL[r];

/** 入っているワークスペースの 2 行目：自分だけの場所は「自分だけ」・主のグループがあれば「<役割> ・ <グループ>」 */
export function workspaceLine(w: Pick<MeWorkspace, "role" | "group" | "own">): string {
  if (w.own) return "自分だけ";
  return w.group ? `${roleLabel(w.role)} ・ ${w.group}` : roleLabel(w.role);
}

/** 日本時間の HH:mm */
export function clockText(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 9 * 36e5);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

/** 入っているワークスペースの行（部品の WsRow） */
export function toWsRows(ws: readonly MeWorkspace[]): WsRow[] {
  return ws.map((w) => ({
    id: w.tenant_id,
    mark: initialOf(w.name), // 会社の種類の字を外した頭文字（下絵の「株式会社ENGINE BASE」→「E」・設定のロゴと同じ）
    name: w.name,
    role: w.own ? "自分だけ" : roleLabel(w.role),
    ...(w.group && !w.own ? { group: w.group } : {}),
    own: w.own,
    canLeave: !w.own,
  }));
}

/** 答え → 部品の値（名前・呼ばれ方・メール・顔） */
export function toProfileState(a: MeAnswer): ProfileState {
  const m = a.member;
  const photo = m.avatar.kind === "image" && m.avatar.url !== null;
  return {
    name: m.name,
    nick: m.call_name ?? "",
    email: m.email,
    initial: m.avatar.initial,
    face: photo ? "photo" : "text",
    ...(photo ? { photoUrl: m.avatar.url! } : {}),
    // 確かめ待ちのメール（K-840・行が「確かめ待ち」になり［送り直す］が出る）
    ...(m.email_pending ? { emailPending: m.email_pending } : {}),
  };
}
