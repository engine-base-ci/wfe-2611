// 自分の設定の口（段 11：K-833 読む・直す／K-834 顔／K-835 メール）が答える member の形を作る共通の関数（K-833）。
//   DB の関数（app.me_member_row）が返す今の会社の自分の行を、画面が使う形に直す：
//   { id, name, call_name, email, avatar: { kind, initial, url }, language, theme, week_start, timezone, email_pending }
//   顔：avatar_ref が在れば期限つき URL（関門 C4 の signUrl・10 分）を作って kind image。作れなければ kind text に落とす（D-154.50）。
//   initial は呼ばれ方（無ければ名前）の 1 文字目（サロゲート対は 1 文字）
import type { TenantContext } from "@kaname/db/context";
import type { ObjectStore } from "@kaname/storage";

/** 顔の期限つき URL の長さ（秒） */
const AVATAR_TTL_SECONDS = 600;

/** DB の関数 app.me_member_row が返す行 */
export interface MeMemberRow {
  id: string;
  name: string;
  call_name: string | null;
  email: string | null;
  avatar_ref: string | null;
  language: string;
  theme: string;
  week_start: number;
  timezone: string;
  email_pending: string | null;
}

export interface MeAvatar {
  kind: "text" | "image";
  initial: string;
  url: string | null;
}

export interface MeMember {
  id: string;
  name: string;
  call_name: string | null;
  email: string | null;
  avatar: MeAvatar;
  language: string;
  theme: string;
  week_start: number;
  timezone: string;
  email_pending: string | null;
}

/** 顔の文字：呼ばれ方（無ければ名前）の 1 文字目 */
export function avatarInitial(row: Pick<MeMemberRow, "name" | "call_name">): string {
  return Array.from(row.call_name || row.name || "")[0] ?? "";
}

/** 顔の形：写真が在れば期限つき URL つきの image、作れなければ・無ければ text */
export async function avatarOf(
  objects: ObjectStore,
  ctx: TenantContext,
  row: Pick<MeMemberRow, "name" | "call_name" | "avatar_ref">,
): Promise<MeAvatar> {
  const initial = avatarInitial(row);
  if (!row.avatar_ref) return { kind: "text", initial, url: null };
  const signed = await objects.signUrl(ctx, row.avatar_ref, AVATAR_TTL_SECONDS);
  return signed.status === "done"
    ? { kind: "image", initial, url: signed.value.url }
    : { kind: "text", initial, url: null };
}

/** 今の会社の自分の行を、画面が使う member の形にする（avatar_ref は答えに出さない） */
export async function toMember(objects: ObjectStore, ctx: TenantContext, row: MeMemberRow): Promise<MeMember> {
  return {
    id: row.id,
    name: row.name,
    call_name: row.call_name,
    email: row.email,
    avatar: await avatarOf(objects, ctx, row),
    language: row.language,
    theme: row.theme,
    week_start: row.week_start,
    timezone: row.timezone,
    email_pending: row.email_pending,
  };
}
