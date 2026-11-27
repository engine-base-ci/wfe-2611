// 運営の受信箱（/ops/support・K-976）の、口の答え（K-948 の形）→ 部品の値と、URL の箱・種類・1 件の読み書き。
//   純粋な関数だけ（@/ を読まない・口を呼ばない）。字は下絵（ops2-sample.ts の INBOX_ROWS・views-inbox.tsx）が正。時刻は日本時間
export type InqTopic = "usage" | "trouble" | "billing" | "other";
export type InqState = "open" | "waiting" | "later" | "done";
export type InboxBox = "unassigned" | "mine" | "waiting" | "later" | "done";

/** listOpsInquiries の 1 行（K-948） */
export interface InqRow {
  id: string;
  title: string;
  topic: InqTopic;
  state: InqState;
  workspace: { id: string; name: string };
  asker: { name: string };
  owner: { member_id: string; name: string } | null;
  later_until: string | null;
  created_at: string;
  last_message_at: string | null;
}
/** OpsInquiryMessage（K-948） */
export interface InqMessage {
  id: string;
  kind: "customer" | "reply" | "note";
  author_name: string;
  body: string;
  attachments: { id: string; name: string; size: number }[];
  created_at: string;
}
export interface InqContext {
  path: string;
  at: string;
  browser: string;
  pc: boolean;
}
export interface InqWorkspaceStatus {
  plan_name: string | null;
  members: number;
  /** connected・paired・never（ほかの値は「—」） */
  pc: string;
  stuck_runs: number;
  overdue: number;
}
/** getOpsInquiry の 1 件（K-948） */
export interface InqDetail extends InqRow {
  messages: InqMessage[];
  context: InqContext | null;
  workspace_status: InqWorkspaceStatus;
}

const TOPIC_LABEL: Record<InqTopic, "使い方" | "うまく動かない" | "お金・プラン" | "ほか"> = {
  usage: "使い方",
  trouble: "うまく動かない",
  billing: "お金・プラン",
  other: "ほか",
};
const STATE_LABEL: Record<InqState, "進行中" | "返事待ち" | "後で" | "済み"> = {
  open: "進行中",
  waiting: "返事待ち",
  later: "後で",
  done: "済み",
};
const PC_LABEL: Record<string, string> = {
  connected: "つながっている",
  paired: "切れている",
  never: "まだつないでいない",
};
export const TOPICS: readonly InqTopic[] = ["usage", "trouble", "billing", "other"];
export const BOXES: readonly InboxBox[] = ["unassigned", "mine", "waiting", "later", "done"];
export const topicLabel = (t: InqTopic) => TOPIC_LABEL[t];

// ---------------------------------------------------------------- 日本時間
const JST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
/** 日本時間の暦の値（UTC の読み方で読む） */
const jst = (d: Date) => new Date(d.getTime() + JST_MS);
const dayNo = (d: Date) => Math.floor(jst(d).getTime() / DAY_MS);
const hhmm = (d: Date) => `${pad(jst(d).getUTCHours())}:${pad(jst(d).getUTCMinutes())}`;
const mmdd = (d: Date) => `${pad(jst(d).getUTCMonth() + 1)}/${pad(jst(d).getUTCDate())}`;

/** 届いた時刻の短い字：今日は HH:mm・昨日は「昨日」・ほかは MM/DD */
export function whenShort(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = dayNo(now) - dayNo(d);
  if (diff === 0) return hhmm(d);
  if (diff === 1) return "昨日";
  return mmdd(d);
}
/** 時刻の字：今日は HH:mm・ほかは MM/DD HH:mm */
function whenLong(iso: string, now: Date, always = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return !always && dayNo(now) === dayNo(d) ? hhmm(d) : `${mmdd(d)} ${hhmm(d)}`;
}

// ---------------------------------------------------------------- 答え → 部品の値
export interface InboxRowView {
  id: string;
  who: string;
  ws: string;
  at: string;
  title: string;
  kind: "使い方" | "うまく動かない" | "お金・プラン" | "ほか";
  state: "進行中" | "返事待ち" | "後で" | "済み";
  mine: boolean;
}
export function rowView(row: InqRow, me: string, now: Date): InboxRowView {
  return {
    id: row.id,
    who: row.asker.name,
    ws: row.workspace.name,
    at: whenShort(row.created_at, now),
    title: row.title,
    kind: TOPIC_LABEL[row.topic],
    state: STATE_LABEL[row.state],
    mine: row.owner?.member_id === me,
  };
}

export interface MessageView {
  head: string;
  body: string;
  memo: boolean;
}
export function messageView(m: InqMessage, now: Date): MessageView {
  const who = m.kind === "customer" ? m.author_name : `${m.author_name}（運営）`;
  return { head: `${who} ・ ${whenLong(m.created_at, now)}`, body: m.body, memo: m.kind === "note" };
}

export interface SideView {
  title: string;
  aside: string;
  rows: [string, string][];
  /** 付いてきた情報の 1 行（無ければ null） */
  context: string | null;
  /** 1 社の画面 */
  href: string;
}
export function sideView(d: InqDetail): SideView {
  const s = d.workspace_status;
  const plan = `${s.plan_name ?? "—"} ・ ${s.members} 人`;
  const c = d.context;
  return {
    title: d.workspace.name,
    aside: plan,
    rows: [
      ["プラン", plan],
      ["この人の PC", PC_LABEL[s.pc] ?? "—"],
      ["止まった実行（7 日）", `${s.stuck_runs} 件`],
      ["請求", s.overdue === 0 ? "期限を過ぎた請求なし" : `期限を過ぎた請求 ${s.overdue} 件`],
    ],
    context: c
      ? `付いてきた情報：画面 ${c.path} ・ ${c.browser} ・ PC ${c.pc ? "つながっている" : "つながっていない"}`
      : null,
    href: `/ops/tenants/${encodeURIComponent(d.workspace.id)}`,
  };
}

/** 1 件の頭の字（人 ・ ワークスペース ・ MM/DD HH:mm） */
export const threadSub = (d: InqRow, now: Date): string =>
  `${d.asker.name} ・ ${d.workspace.name} ・ ${whenLong(d.created_at, now, true)}`;

// ---------------------------------------------------------------- URL
export interface InboxQuery {
  box: InboxBox;
  topic: InqTopic | null;
  id: string | null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;

/** URL の値を読む（知らない値は既定：箱は unassigned・種類は無し・id は uuid の形だけ） */
export function inboxQuery(p: { get(name: string): string | null }): InboxQuery {
  const id = p.get("id");
  return {
    box: oneOf(BOXES, p.get("box")) ?? "unassigned",
    topic: oneOf(TOPICS, p.get("topic")),
    id: id !== null && UUID.test(id) ? id : null,
  };
}
/** URL の問い合わせを書く（順は box・topic・id・既定の値は書かない） */
export function inboxSearch(q: InboxQuery): string {
  const parts: string[] = [];
  if (q.box !== "unassigned") parts.push(`box=${q.box}`);
  if (q.topic) parts.push(`topic=${q.topic}`);
  if (q.id) parts.push(`id=${encodeURIComponent(q.id)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------- 後で
export type LaterChoice = "tomorrow" | "week" | "none";
/** 明日の朝＝翌日 9:00（日本時間）・来週＝次の月曜 9:00・選び直し（none）＝null */
export function laterOf(choice: LaterChoice, now: Date): string | null {
  if (choice === "none") return null;
  const t = jst(now);
  const dow = t.getUTCDay(); // 0 日曜 … 1 月曜
  const add = choice === "tomorrow" ? 1 : (8 - dow) % 7 || 7;
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + add));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T09:00:00+09:00`;
}

// ---------------------------------------------------------------- 答えの形を確かめる
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function isRow(v: unknown): v is InqRow {
  if (!isObj(v)) return false;
  const ws = v["workspace"];
  const asker = v["asker"];
  const owner = v["owner"];
  return (
    isStr(v["id"]) &&
    isStr(v["title"]) &&
    oneOf(TOPICS, isStr(v["topic"]) ? v["topic"] : null) !== null &&
    isStr(v["state"]) &&
    (Object.keys(STATE_LABEL) as string[]).includes(v["state"]) &&
    isObj(ws) &&
    isStr(ws["id"]) &&
    isStr(ws["name"]) &&
    isObj(asker) &&
    isStr(asker["name"]) &&
    (owner === null || (isObj(owner) && isStr(owner["member_id"]) && isStr(owner["name"]))) &&
    isStr(v["created_at"])
  );
}
export const isMessage = (v: unknown): v is InqMessage =>
  isObj(v) &&
  isStr(v["id"]) &&
  (v["kind"] === "customer" || v["kind"] === "reply" || v["kind"] === "note") &&
  isStr(v["author_name"]) &&
  isStr(v["body"]) &&
  isStr(v["created_at"]);
export function isDetail(v: unknown): v is InqDetail {
  if (!isRow(v)) return false;
  const d = v as unknown as Record<string, unknown>;
  const s = d["workspace_status"];
  const c = d["context"];
  return (
    Array.isArray(d["messages"]) &&
    d["messages"].every(isMessage) &&
    (c === null || c === undefined || (isObj(c) && isStr(c["path"]) && isStr(c["browser"]))) &&
    isObj(s) &&
    isNum(s["members"]) &&
    isNum(s["stuck_runs"]) &&
    isNum(s["overdue"]) &&
    (s["pc"] === "connected" || s["pc"] === "paired" || s["pc"] === "never")
  );
}
export const isRows = (v: unknown): v is InqRow[] => Array.isArray(v) && v.every(isRow);

// ---------------------------------------------------------------- 外枠の答え（K-963）
export interface ShellInbox {
  me: string;
  caps: string[];
  counts: Partial<Record<Exclude<InboxBox, "done">, number>>;
}
/** 外枠の答えの data から、自分・できること・箱の数を拾う（形が違えば空） */
export function shellInbox(data: unknown): ShellInbox {
  const d = isObj(data) ? data : {};
  const op = isObj(d["operator"]) ? d["operator"] : {};
  const caps = Array.isArray(op["caps"]) ? op["caps"].filter(isStr) : [];
  const inbox = isObj(d["inbox"]) ? d["inbox"] : {};
  const counts: ShellInbox["counts"] = {};
  for (const k of ["unassigned", "mine", "waiting", "later"] as const) {
    const n = inbox[k];
    if (isNum(n) && n >= 0) counts[k] = n;
  }
  return { me: isStr(op["member_id"]) ? op["member_id"] : "", caps, counts };
}
