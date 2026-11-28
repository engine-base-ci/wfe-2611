// メンバーの 1 人の口 getMember（K-810）の答え → 部品 MemberPage の値（K-819）。画面の外の純粋な関数（@/ を読まない）。
//   日付と時刻は日本時間。字の決めはチケット K-819「答え → 部品の値」のとおり（「仮」の字はキャンバスに無い状態の物）
//   契約の型は中身を持たないので、ここで読む形を決め、形の違う答えは null にする（入口で確かめる）
import type { MemberDetailData } from "./types";

export type PcState = "ok" | "away" | "never" | "none";

export interface MemberAnswer {
  member: {
    id: string;
    name: string;
    email: string;
    role: string;
    suspended: boolean;
    since: string;
    self: boolean;
    is_owner: boolean;
    role_changed: { at: string; by: string | null; from: string } | null;
  };
  groups: { id: string; name: string; primary: boolean; role: string | null }[];
  assigned: { tickets: number; overdue: number; stuck: number; handing: number };
  clone: { pc: PcState; pc_days_away: number | null; device: string | null };
  login: { passkeys: number; has_password: boolean; two_factor: boolean; last_login_at: string | null };
  recent_events: { id: string; action: string; at: string; by: string | null }[];
}

/** 役割の字（管理者・マネージャー・メンバー・閲覧のみ） */
const ROLE_TEXT: Record<string, string> = {
  owner: "管理者",
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  staff: "メンバー",
  viewer: "閲覧のみ",
  requester: "依頼する側",
};
const roleText = (role: string | null | undefined): string => (role ? (ROLE_TEXT[role] ?? "メンバー") : "メンバー");

/** 記録のことば。知らない action は内部の字を出さず「ほかの操作」 */
export const ACTION_TEXT: Record<string, string> = {
  "member.role_change": "役割が変わった",
  "member.groups_change": "グループが変わった",
  "member.suspend": "一時的に止めた",
  "member.resume": "戻した",
  "member.remove": "外した",
  "member.joined": "入った",
};
const OTHER_ACTION = "ほかの操作";
/** 最近の記録は新しい順のまま 5 件まで */
const RECORDS_MAX = 5;
const NO_RUNS = "今月の実行 — ・ 人ごとの枠 —";

const JST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function jstParts(iso: string): Record<string, string> | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Object.fromEntries(JST.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
}

/** YYYY-MM-DD（日本時間） */
export function dayText(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p["year"]}-${p["month"]}-${p["day"]}` : "";
}
/** MM/DD（日本時間） */
export function monthDayText(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p["month"]}/${p["day"]}` : "";
}
/** MM/DD HH:mm（日本時間） */
export function clockText(iso: string): string {
  const p = jstParts(iso);
  return p ? `${p["month"]}/${p["day"]} ${p["hour"]}:${p["minute"]}` : "";
}

const by = (name: string | null): string => (name ? `（${name}）` : "");

function roleNoteOf(m: MemberAnswer["member"]): string | undefined {
  if (m.role_changed)
    return `${monthDayText(m.role_changed.at)} に${roleText(m.role_changed.from)}から${by(m.role_changed.by)}`;
  return m.is_owner ? "ワークスペースを作った人" : undefined;
}

function pcOf(c: MemberAnswer["clone"]): Pick<MemberDetailData, "pcLine" | "pcTone"> {
  switch (c.pc) {
    case "ok":
      return { pcLine: c.device ? `PC つながっている（${c.device}）` : "PC つながっている", pcTone: "ok" };
    case "away":
      return { pcLine: `PC ${c.pc_days_away ?? 0} 日つながっていない`, pcTone: "warn" };
    case "never":
      return { pcLine: "PC をまだつないでいない", pcTone: "warn" };
    default:
      return { pcLine: "分身なし（見るだけ）", pcTone: "none" };
  }
}

function loginOf(l: MemberAnswer["login"]): Pick<MemberDetailData, "loginHow" | "twofa" | "twofaApp" | "lastLogin"> {
  const keys = l.passkeys > 0;
  let loginHow = "入り方なし";
  if (keys && l.has_password) loginHow = `パスワードとパスキー ${l.passkeys} つ`;
  else if (keys) loginHow = `パスキー ${l.passkeys} つ`;
  else if (l.has_password) loginHow = "パスワード";
  let twofa = "付けていない";
  if (l.two_factor) twofa = "付けている（認証アプリ）";
  else if (keys) twofa = "付けていない（パスキーで入るので要らない）";
  const lastLogin = l.last_login_at ? clockText(l.last_login_at) || "まだ入っていません" : "まだ入っていません";
  return { loginHow, twofa, twofaApp: l.two_factor, lastLogin };
}

/** 口の答え → 部品の値 */
export function toDetailData(a: MemberAnswer): MemberDetailData {
  const m = a.member;
  const primary = a.groups.find((g) => g.primary) ?? a.groups[0];
  const role = m.role === "admin" || m.role === "owner" ? roleText(m.role) : roleText(primary?.role ?? m.role);
  const roleNote = roleNoteOf(m);
  return {
    name: m.name,
    email: m.email,
    since: dayText(m.since),
    group: primary?.name ?? "グループなし",
    role,
    ...(roleNote ? { roleNote } : {}),
    also: a.groups.filter((g) => g !== primary).map((g) => g.name),
    ticketLine: `担当 ${a.assigned.tickets} 件 ・ 期限切れ ${a.assigned.overdue} ・ 渡し中 ${a.assigned.handing}`,
    ...pcOf(a.clone),
    runsLine: NO_RUNS,
    stuckLine: `止まった（7 日） ${a.assigned.stuck}`,
    ...loginOf(a.login),
    records: a.recent_events.slice(0, RECORDS_MAX).map((e) => ({
      when: clockText(e.at),
      text: `${ACTION_TEXT[e.action] ?? OTHER_ACTION}${by(e.by)}`,
    })),
    self: m.self,
    suspended: m.suspended,
  };
}

// ---------------------------------------------------------------- 入口で答えの形を確かめる
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const PC: readonly PcState[] = ["ok", "away", "never", "none"];

function readMember(v: Obj): MemberAnswer["member"] | null {
  const id = str(v["id"]);
  const name = str(v["name"]);
  if (!id || name === null) return null;
  const rc = isObj(v["role_changed"]) ? v["role_changed"] : null;
  const at = rc ? str(rc["at"]) : null;
  return {
    id,
    name,
    email: str(v["email"]) ?? "",
    role: str(v["role"]) ?? "member",
    suspended: v["suspended"] === true,
    since: str(v["since"]) ?? "",
    self: v["self"] === true,
    is_owner: v["is_owner"] === true,
    role_changed: rc && at ? { at, by: str(rc["by"]), from: str(rc["from"]) ?? "" } : null,
  };
}

/** 口の答え（data）を読む。member が無い・形が違うときは null */
export function readAnswer(raw: unknown): MemberAnswer | null {
  if (!isObj(raw) || !isObj(raw["member"])) return null;
  const member = readMember(raw["member"]);
  if (!member) return null;
  const groups = (Array.isArray(raw["groups"]) ? raw["groups"] : []).filter(isObj).map((g) => ({
    id: str(g["id"]) ?? "",
    name: str(g["name"]) ?? "",
    primary: g["primary"] === true,
    role: str(g["role"]),
  }));
  const as = isObj(raw["assigned"]) ? raw["assigned"] : {};
  const cl = isObj(raw["clone"]) ? raw["clone"] : {};
  const lg = isObj(raw["login"]) ? raw["login"] : {};
  const pc = PC.find((p) => p === cl["pc"]) ?? "none";
  return {
    member,
    groups,
    assigned: {
      tickets: num(as["tickets"]),
      overdue: num(as["overdue"]),
      stuck: num(as["stuck"]),
      handing: num(as["handing"]),
    },
    clone: {
      pc,
      pc_days_away: typeof cl["pc_days_away"] === "number" ? cl["pc_days_away"] : null,
      device: str(cl["device"]),
    },
    login: {
      passkeys: num(lg["passkeys"]),
      has_password: lg["has_password"] === true,
      two_factor: lg["two_factor"] === true,
      last_login_at: str(lg["last_login_at"]),
    },
    recent_events: (Array.isArray(raw["recent_events"]) ? raw["recent_events"] : []).filter(isObj).map((e) => ({
      id: str(e["id"]) ?? "",
      action: str(e["action"]) ?? "",
      at: str(e["at"]) ?? "",
      by: str(e["by"]),
    })),
  };
}
