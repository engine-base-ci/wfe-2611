// チケットのやり取りに出るナレッジの 3 つの行（K-702）の、値を読む唯一の入口。純粋な関数・@/ を読まない・入力を書き換えない。
//   行は口の葉が ticket_messages（kind change・作者なし）に書く。changes の 1 要素の形の正は口の葉：
//     守る物 guard_list（K-699）：{ field, from: null, to, note: null, must: [{id,title,place}], opened: [{id,title,place}] }
//     開いたページ knowledge_open（K-698）：{ field, from: null, to: 題名, note: 場所, page_id }
//     守れていなかった決まり knowledge_breach（K-700）：{ field, from: 出来事の種類, to: 題名, note: 理由 または null, page_id }
//   形の違う行・値はその行だけ捨てる（落とさない）。口が壊れた値を返しても、ほかの行は出る

export type KnowledgeField = "guard_list" | "knowledge_open" | "knowledge_breach";
export type BreachKind = "ai_unchecked" | "human_unchecked" | "ai_self_reported";

export interface GuardPageRef {
  id: string;
  title: string;
  place: string;
}
export interface GuardRead {
  must: GuardPageRef[];
  opened: GuardPageRef[];
}
export interface OpenedRead {
  page_id: string | null;
  title: string;
  place: string;
}
export interface BreachRead {
  kind: BreachKind;
  title: string;
  note: string;
  page_id: string | null;
}

const FIELDS: readonly KnowledgeField[] = ["guard_list", "knowledge_open", "knowledge_breach"];
const BREACH_KINDS: readonly BreachKind[] = ["ai_unchecked", "human_unchecked", "ai_self_reported"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** changes の最初の 1 要素の field が 3 つのどれかなら、その名前（それ以外は null＝段 5・段 7 の字に任せる） */
export function knowledgeFieldOf(changes: unknown): KnowledgeField | null {
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const first: unknown = changes[0];
  if (!isRec(first)) return null;
  const f = first["field"];
  return typeof f === "string" && (FIELDS as readonly string[]).includes(f) ? (f as KnowledgeField) : null;
}

function pagesOf(v: unknown): GuardPageRef[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p: unknown) => {
    if (!isRec(p)) return [];
    const id = str(p["id"]);
    const title = str(p["title"]);
    const place = str(p["place"]);
    return id !== null && title !== null && place !== null ? [{ id, title, place }] : [];
  });
}

/** 守る物：must・opened の各行から id・title・place が全部文字の物だけ（形の違う行は捨てる）。object でなければ null */
export function readGuard(change: unknown): GuardRead | null {
  if (!isRec(change)) return null;
  return { must: pagesOf(change["must"]), opened: pagesOf(change["opened"]) };
}

/** 開いたページ：to＝題名・note＝場所（無ければ空の字）・page_id（文字でなければ null）。題名が文字でなければ null */
export function readOpened(change: unknown): OpenedRead | null {
  if (!isRec(change)) return null;
  const title = str(change["to"]);
  if (title === null) return null;
  return { page_id: str(change["page_id"]), title, place: str(change["note"]) ?? "" };
}

/** 守れていなかった決まり：from＝出来事の種類（3 つだけ）・to＝題名・note＝理由（無ければ空の字） */
export function readBreach(change: unknown): BreachRead | null {
  if (!isRec(change)) return null;
  const kind = change["from"];
  const title = str(change["to"]);
  if (typeof kind !== "string" || !(BREACH_KINDS as readonly string[]).includes(kind) || title === null) return null;
  return { kind: kind as BreachKind, title, note: str(change["note"]) ?? "", page_id: str(change["page_id"]) };
}

/** ページの道：uuid の形のときだけ /knowledge/<id>（小文字）。それ以外はリンクにしない（null） */
export function pageHref(id: unknown): string | null {
  return typeof id === "string" && UUID.test(id) ? `/knowledge/${id.toLowerCase()}` : null;
}

/** 畳んだ 1 行の件数の字（個数は並びの長さ） */
export function guardCounts(g: { must: readonly unknown[]; opened: readonly unknown[] }): string {
  return `必ず守る ${g.must.length}・開いたページ ${g.opened.length}`;
}

/** 広げるのは読んだ答えの並びのいちばん後ろの行だけ（後ろに 1 行でもあれば畳む） */
export function isExpanded(index: number, length: number): boolean {
  return index === length - 1;
}
