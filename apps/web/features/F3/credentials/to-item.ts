// 預けたログイン情報の一覧の口（listCredentials・K-351 の toCredential）の 1 件を、見た目の部品の行（CredentialItem）に直す（K-356）。
//   純粋な関数：時刻は引数（now）で受け、時刻と日付は日本時間で出す。値（vault_ref など）は口が返さないので、ここでも扱わない。
//   札：確かめの状態（login_check.state）→ 部品の札。札が「使える」で、期限（expires_on）まで 1 日以下（当日・過ぎたも）なら「期限が近い」
//   （代表の答え answer=e34268dbfbac：期限が近いは期限を越える 1 日前から）。使われ方は「これまでに N 回 ・ 最後 MM/DD」だけ（使うもの・この 1 か月の回数は出さない）
import type { CheckState, CredentialItem } from "./views";

/** 口の 1 件（契約の型 Credential の、画面が読む欄だけ。欄は全部 K-351 の toCredential が返す） */
export interface CredentialAnswer {
  id?: string;
  name?: string;
  description?: string | null;
  layer?: string;
  kind?: string;
  two_factor?: string | null;
  destinations?: string[];
  expires_on?: string | null;
  use_count?: number;
  last_used_at?: string | null;
  login_check?: Record<string, unknown> | null;
}

export type Layer = "workspace" | "personal";
export interface CredentialRow extends CredentialItem {
  layer: Layer;
}

const TZ = "Asia/Tokyo";
/** コードを待つ長さ（D-117：10 分のあいだに入れないと確かめを止める） */
const CODE_WAIT_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 期限が近いと出すのは、期限まで何日以下から（1 日前・当日・過ぎた） */
const EXPIRING_DAYS = 1;

const STATE_OF: Record<string, CheckState> = {
  pending: "checking",
  running: "checking",
  waiting: "checking",
  asking: "needs_code",
  ok: "ok",
  bad_password: "bad_password",
  bad_code: "bad_password",
  captcha: "captcha",
  no_bridge: "no_pc",
  forbidden: "forbidden",
  needs_2fa: "stopped",
  unreachable: "stopped",
  no_form: "stopped",
  stopped: "stopped",
  no_answer: "stopped",
};

const NOTE_OF: Partial<Record<CheckState, string>> = {
  checking: "PC がログインして確かめている",
  no_pc: "PC をつなぐと、1 回ログインして確かめる",
  forbidden: "このサービスは規約で自動のログインを禁止しているので、分身は使わない",
};

/** 日本時間の年月日と時刻の部品 */
function jst(at: Date): { y: number; m: number; d: number; hh: string; mm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "0";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), hh: get("hour"), mm: get("minute") };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const validDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
};
/** 日本時間の日付どうしの日数（b − a） */
const daysBetween = (a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number =>
  Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);

/** 期限の日（YYYY-MM-DD）まで、今日（日本時間）から何日か。形が違えば null */
function daysToExpiry(expiresOn: string | null | undefined, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresOn ?? "");
  if (!m) return null;
  return daysBetween(jst(now), { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
}

/** 確かめた時刻「M/D HH:MM に確かめた」 */
function checkedAt(at: Date | null): string | null {
  if (!at) return null;
  const t = jst(at);
  return `${t.m}/${t.d} ${t.hh}:${t.mm} に確かめた`;
}

/** コード待ちの補足（2 段階の種類で文を分ける・残りの分は確かめを頼んだ時刻から 10 分） */
function waitingNote(twoFactor: string | null | undefined, at: Date | null, now: Date): string {
  const what =
    twoFactor === "sms"
      ? "SMS のコードを待っている"
      : twoFactor === "email"
        ? "メールのコードを待っている"
        : twoFactor === "push"
          ? "スマホのアプリの承認を待っている"
          : "コードを待っている";
  if (!at) return what;
  const left = Math.max(0, Math.ceil((at.getTime() + CODE_WAIT_MS - now.getTime()) / 60000));
  return `${what}（あと ${left} 分）`;
}

function expiryNote(days: number | null): string | null {
  if (days === null || days > EXPIRING_DAYS) return null;
  if (days === EXPIRING_DAYS) return `あと ${EXPIRING_DAYS} 日で期限`;
  if (days === 0) return "今日で期限";
  return "期限が過ぎています";
}

/** 使われ方「これまでに N 回 ・ 最後 MM/DD」（今日なら「最後 今日」）・使っていなければ「まだ使っていない」 */
function usageOf(count: number, lastUsed: Date | null, now: Date): string {
  if (count < 1) return "まだ使っていない";
  if (!lastUsed) return `これまでに ${count} 回`;
  const t = jst(lastUsed);
  const last = daysBetween(t, jst(now)) === 0 ? "今日" : `${pad2(t.m)}/${pad2(t.d)}`;
  return `これまでに ${count} 回 ・ 最後 ${last}`;
}

function stateOf(kind: "login" | "key", raw: unknown): CheckState {
  // 確かめていない（null）・知らない値：鍵は確かめる物が無いので「使える」、ログイン情報は「まだ確かめていない」
  const hit = typeof raw === "string" ? STATE_OF[raw] : undefined;
  if (hit) return hit;
  return kind === "key" ? "ok" : "unchecked";
}

export function toItem(c: CredentialAnswer, now: Date): CredentialRow {
  const kind = c.kind === "key" ? "key" : "login";
  const lc = c.login_check ?? {};
  const detail = typeof lc["detail"] === "string" && lc["detail"] ? (lc["detail"] as string) : null;
  const at = validDate(typeof lc["at"] === "string" ? (lc["at"] as string) : null);
  const days = daysToExpiry(c.expires_on, now);
  let state = stateOf(kind, lc["state"]);
  if (state === "ok" && days !== null && days <= EXPIRING_DAYS) state = "expiring";

  let check: string | null = NOTE_OF[state] ?? null;
  if (state === "needs_code") check = waitingNote(c.two_factor, at, now);
  if (state === "bad_password" || state === "captcha") check = checkedAt(at);
  if (state === "stopped") check = [detail, checkedAt(at)].filter(Boolean).join(" ・ ") || null;
  const note = [check, expiryNote(days)].filter(Boolean).join(" ・ ") || null;

  return {
    id: c.id ?? "",
    name: c.name ?? "",
    description: c.description ?? null,
    kind,
    layer: c.layer === "personal" ? "personal" : "workspace",
    destinations: c.destinations ?? [],
    usage: usageOf(c.use_count ?? 0, validDate(c.last_used_at), now),
    state,
    note,
  };
}
