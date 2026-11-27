// 記録の画面（K-825）：口 listAuditEvents（K-823・K-850）の答え → 部品 LogPage の値、URL の値 → 口へ渡す鍵。純粋な関数だけ（@/ を読まない）。
//   確かめに通らない URL の値・知らない鍵は口に送らない（絞りなしで読む・D-154.2：自分の分の入口の鍵は持たない）
import type { LogEntry, LogTab } from "./log";

/** 口の答えの 1 行（K-823 の「画面が使う答えの形」） */
export interface AuditEntryAnswer {
  id: string;
  occurred_at: string;
  kind: LogTab | null;
  action: string;
  actor: { id: string; name: string } | null;
  target: { type: string; id: string; label: string } | null;
  text: string;
  reason: string | null;
  device: string | null;
  step_up: boolean;
  deleted: boolean;
}
export type AuditScope = "all" | "groups";
export interface AuditAnswer {
  entries: AuditEntryAnswer[];
  next_cursor: string | null;
  scope: AuditScope;
  scan_capped?: boolean;
}

/** 画面の絞り（URL の値を確かめた後） */
export interface AuditFilters {
  kind: LogTab | null;
  q: string | null;
  member: string | null;
  ticket: string | null;
}

export const Q_MAX = 100;
const KINDS: readonly LogTab[] = ["perm", "out", "device", "ai", "deleted", "ops"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 起こした人が無い行の名前（仮） */
export const NO_ACTOR = "Kaname";
/** 知らない操作の字（内部の名前を出さない） */
export const OTHER_ACTION = "ほかの操作を行った";
const INTERNAL_TEXT = /^[A-Za-z0-9_.:-]+ を行った$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の MM/DD HH:mm。読めない時刻は空 */
export function whenText(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const t = new Date(ms + JST_OFFSET_MS);
  return `${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** 「が」の後ろの文。空か「<action> を行った」の形は内部の字を出さない */
export function textOf(e: Pick<AuditEntryAnswer, "text" | "action">): string {
  const text = e.text.trim();
  if (text === "" || text === `${e.action} を行った` || INTERNAL_TEXT.test(text)) return OTHER_ACTION;
  return text;
}

export function toLogEntry(e: AuditEntryAnswer): LogEntry {
  const who = e.actor?.name.trim() ?? "";
  return {
    id: e.id,
    when: whenText(e.occurred_at),
    who: who === "" ? NO_ACTOR : who,
    text: textOf(e),
    ...(e.reason ? { reason: e.reason } : {}),
    ...(e.device ? { device: e.device } : {}),
    ...(e.step_up ? { stepUp: true } : {}),
    ...(e.deleted ? { deleted: true } : {}),
  };
}

/** ことばの欄の値：前後の空白を削る。空・長すぎる値は無し */
export function cleanQ(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim();
  return q === "" || Array.from(q).length > Q_MAX ? null : q;
}

const kindOf = (raw: string | null): LogTab | null =>
  raw !== null && (KINDS as readonly string[]).includes(raw) ? (raw as LogTab) : null;
const uuidOf = (raw: string | null): string | null => (raw !== null && UUID.test(raw) ? raw : null);

/** URL の値 → 絞り（確かめに通る値だけ） */
export function filtersFromUrl(get: (key: string) => string | null): AuditFilters {
  return {
    kind: kindOf(get("kind")),
    q: cleanQ(get("q")),
    member: uuidOf(get("member")),
    ticket: uuidOf(get("ticket")),
  };
}

/** 絞り → 口へ渡す鍵（無い値は渡さない） */
export function queryOf(f: AuditFilters): Record<string, string> {
  return {
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.q ? { q: f.q } : {}),
    ...(f.member ? { member_id: f.member } : {}),
    ...(f.ticket ? { ticket_id: f.ticket } : {}),
  };
}

/** 絞り → URL の問い合わせ（?kind=…&q=…&member=…&ticket=…・無ければ空） */
export function searchOf(f: AuditFilters): string {
  const p = new URLSearchParams();
  if (f.kind) p.set("kind", f.kind);
  if (f.q) p.set("q", f.q);
  if (f.member) p.set("member", f.member);
  if (f.ticket) p.set("ticket", f.ticket);
  const s = p.toString();
  return s === "" ? "" : `?${s}`;
}

export const isFiltered = (f: AuditFilters): boolean =>
  f.kind !== null || f.q !== null || f.member !== null || f.ticket !== null;

/** 探したときの件数の字（続きがあれば「以上」） */
export const countText = (n: number, more: boolean): string => `${n} 件${more ? "以上" : ""}見つかりました`;
