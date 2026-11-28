// 運営の人の画面（/ops/team・K-986）の形：口の答え（listOpsMembers の 8 欄・K-985）→ 部品の値（views-team.tsx）。
//   画面の外の純粋な関数だけ（@/ を読まない・単体の試験 k986-team-shape.test.ts が読む）。字は下絵（ops-sample.ts の CAP_LABELS）が正
import { CAP_LABELS, type TeamPerson } from "./ops-sample";

/** できることの印（口の caps の値）。並びは下絵の CAP_LABELS と同じ */
export const CAP_KEYS = [
  "inquiry",
  "peek",
  "money",
  "stop",
  "notice",
  "distribute",
  "plan_propose",
  "plan_decide",
  "ops_people",
] as const;
export type CapKey = (typeof CAP_KEYS)[number];

/** 口の 1 行（K-985 の 8 欄） */
export interface OpsMemberRow {
  member_id: string;
  name: string;
  email: string;
  caps: string[];
  has_passkey: boolean;
  setup_pending: boolean;
  is_self: boolean;
  locked_caps: string[];
}

/** 変える・外すを押せない訳 */
export type EditLock = { locked: "self" } | { locked: "last"; cap: string } | { locked: null };

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrs = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;

/** 印 → 下絵の字（知らない印は空） */
export function capLabelOf(key: string): string {
  const i = CAP_KEYS.indexOf(key as CapKey);
  return i < 0 ? "" : CAP_LABELS[i]!;
}

/** 9 つの順の真偽 */
export function capFlags(caps: readonly string[]): boolean[] {
  return CAP_KEYS.map((k) => caps.includes(k));
}

/** 真偽 → 口に送る印（9 つの順） */
export function capsOfFlags(flags: readonly boolean[]): CapKey[] {
  return CAP_KEYS.filter((_, i) => flags[i] === true);
}

/** 役の字：9 つ全部は運営の管理者・inquiry ありはサポート・ほかは持つ印の最初の字（切る段の決め・仮） */
export function roleOf(caps: readonly string[]): string {
  if (CAP_KEYS.every((k) => caps.includes(k))) return "運営の管理者";
  if (caps.includes("inquiry")) return "サポート";
  const first = CAP_KEYS.find((k) => caps.includes(k));
  return first ? capLabelOf(first) : "";
}

/** 1 行 → 部品の TeamPerson（4 欄だけ） */
export function teamRowView(row: OpsMemberRow): TeamPerson {
  return {
    initial: Array.from(row.name)[0] ?? "",
    name: row.name,
    role: roleOf(row.caps),
    caps: capFlags(row.caps),
  };
}

/** 名前の下の字（パスキーを付ける前は「… ・ パスキーを付ける前」（仮）） */
export function subOf(row: OpsMemberRow): string {
  return `${roleOf(row.caps)} ・ ${row.has_passkey ? "パスキー" : "パスキーを付ける前"}`;
}

/** 変える・外すを押せない訳（自分・最後の 1 人） */
export function editState(row: OpsMemberRow): EditLock {
  if (row.is_self) return { locked: "self" };
  const first = row.locked_caps[0];
  return first !== undefined ? { locked: "last", cap: capLabelOf(first) } : { locked: null };
}

/** 答えの体の data → 行（形が違えば null・ふつうに見せない） */
export function rowsOf(data: unknown): OpsMemberRow[] | null {
  if (!Array.isArray(data)) return null;
  const rows: OpsMemberRow[] = [];
  for (const v of data) {
    const r = obj(v);
    if (!r || !isStr(r["member_id"]) || !isStr(r["name"]) || !isStrs(r["caps"])) return null;
    rows.push({
      member_id: r["member_id"],
      name: r["name"],
      email: isStr(r["email"]) ? r["email"] : "",
      caps: r["caps"],
      has_passkey: r["has_passkey"] === true,
      setup_pending: r["setup_pending"] === true,
      is_self: r["is_self"] === true,
      locked_caps: isStrs(r["locked_caps"]) ? r["locked_caps"] : [],
    });
  }
  return rows;
}

/** 名前の頭（「高本 聖斗」→「高本」） */
const surnameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** 注意の箱の字（下絵 op-team-edit の字・自分でも最後の 1 人でもない形は（仮）） */
export interface LockText {
  title: string;
  body: string;
}
export const LOCK_TITLE = "この人のできることは変えられません";

/** 最後の 1 人の字（cap は印の字） */
export function lastText(name: string, cap: string): string {
  return `「${cap}」ができるのは${surnameOf(name)}さん 1 人だけなので、最後の 1 人として外すこともできません。 別の運営の人に「${cap}」を渡してから、その人に変えてもらってください`;
}

/** 自分の行の字。最後の 1 人の印も持てば、その字を足す（「運営の人」を先に見る＝下絵の形） */
export function selfText(row: Pick<OpsMemberRow, "name" | "locked_caps">): string {
  const key = row.locked_caps.includes("ops_people") ? "ops_people" : row.locked_caps[0];
  const head = "自分のできることは自分では変えられません。";
  if (key === undefined) return `${head}別の運営の人に変えてもらってください`;
  return `${head}また${lastText(row.name, capLabelOf(key))}`;
}

/** 押せない訳 → 注意の箱の字 */
export function lockTextOf(row: OpsMemberRow): LockText | null {
  const s = editState(row);
  if (s.locked === "self") return { title: LOCK_TITLE, body: selfText(row) };
  if (s.locked === "last") return { title: LOCK_TITLE, body: lastText(row.name, s.cap) };
  return null;
}

/** 外すを押せない訳の字（ボタンの title・仮） */
export function removeLockOf(row: OpsMemberRow): string | null {
  const s = editState(row);
  if (s.locked === "self") return "自分は外せません";
  if (s.locked === "last") return `「${s.cap}」の最後の 1 人なので外せません`;
  return null;
}
