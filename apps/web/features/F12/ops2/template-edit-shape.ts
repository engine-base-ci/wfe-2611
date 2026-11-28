// ひな形の新しい版を直す形（K-1111）。画面の外の純粋な関数だけ（@/ を読まない・ブラウザも口も使わない）。
//   今の版の中身（items）は持たず、直し（Edits）だけを持つ：写しは読むたびに口から（今の版の並びのまま直しを当てる）。
//   出す items・今の版との差の字（下絵 op-template-edit の 3 行）・出す理由・下書きの戻し・足す鍵を作る

/** ひな形の部（K-992 の key）。種別・状態・項目 */
export type Part = "kind" | "state" | "field";
export const PART_NAME: Record<Part, string> = { kind: "種別", state: "状態", field: "項目" };
export const partOf = (key: string): Part => (key === "state" || key === "field" ? key : "kind");

/** 中身の 1 つ（K-992 の items・部ごとに使う欄だけを持つ） */
export interface TemplateItem {
  key: string;
  name: string;
  color_key?: string;
  body_template?: unknown;
  field_type?: string;
  required?: boolean;
  description?: string;
  options?: unknown[];
  kind_keys?: string[];
}
export type Change = { kind: "edit"; item: TemplateItem } | { kind: "delete" };
/** 今の版（base）への直し。changes は今の版の key ごと、added は足した物（最後に並ぶ） */
export interface Edits {
  base: number;
  changes: Record<string, Change>;
  added: TemplateItem[];
}
/** この PC に残す下書き（by は運営の人の名前） */
export interface Draft {
  edits: Edits;
  saved_at: string;
  by: string;
}

export const emptyEdits = (base: number): Edits => ({ base, changes: {}, added: [] });
const REASON_MAX = 500;
/** 種別は 10 まで（D-156.84・D-125.68・app.ticket_limits と同じ数） */
export const KIND_LIMIT = 10;

/** 出す items：今の版の並びのまま・消した物を外す・直した物を置き換える・足した物を最後に */
export function itemsOf(current: readonly TemplateItem[], edits: Edits): TemplateItem[] {
  const kept = current.flatMap((it) => {
    const c = edits.changes[it.key];
    if (!c) return [it];
    return c.kind === "delete" ? [] : [c.item];
  });
  return [...kept, ...edits.added];
}

const quoted = (names: readonly string[]) => names.map((n) => `「${n}」`).join("");

/** 今の版との差の字（足す・直す・消すの 0〜3 行。無い種類は行が無い） */
export function diffLines(partName: string, current: readonly TemplateItem[], edits: Edits): string[] {
  const edited = current.flatMap((it) => {
    const c = edits.changes[it.key];
    return c?.kind === "edit" ? [c.item.name] : [];
  });
  const deleted = current.filter((it) => edits.changes[it.key]?.kind === "delete").map((it) => it.name);
  const added = edits.added.map((it) => it.name);
  return [
    ...(added.length ? [`足す：${partName}${quoted(added)}`] : []),
    ...(edited.length ? [`直す：${partName}${quoted(edited)}`] : []),
    ...deleted.map((n) => `消す：${partName}「${n}」（使っているワークスペースの「${n}」はそのまま残る）`),
  ];
}

/** 出す理由（change_reason）＝差の行を「／」でつないだ字（500 字で切る） */
export const reasonOf = (lines: readonly string[]): string => lines.join("／").slice(0, REASON_MAX);

/** 今の版から変えた所があるか */
export const hasChanges = (edits: Edits): boolean => edits.added.length > 0 || Object.keys(edits.changes).length > 0;

/** 生きている数（今の版 − 消す ＋ 足した） */
export const liveCount = (current: readonly TemplateItem[], edits: Edits): number => itemsOf(current, edits).length;

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
let seq = 0;
/** 足す鍵：英小文字で始まる 40 字までの、今の版と足した物のどれとも重ならない鍵（x と 36 進の時刻と連番） */
export function newKey(existing: ReadonlySet<string>): string {
  for (;;) {
    seq += 1;
    const k = `x${Date.now().toString(36)}_${seq.toString(36)}`.slice(0, 40);
    if (KEY_RE.test(k) && !existing.has(k)) return k;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isItem = (v: unknown): v is TemplateItem =>
  isObj(v) && typeof v["key"] === "string" && typeof v["name"] === "string";
const isChange = (v: unknown): v is Change =>
  isObj(v) && (v["kind"] === "delete" || (v["kind"] === "edit" && isItem(v["item"])));
function isEdits(v: unknown): v is Edits {
  if (!isObj(v) || typeof v["base"] !== "number" || !isObj(v["changes"]) || !Array.isArray(v["added"])) return false;
  return Object.values(v["changes"]).every(isChange) && v["added"].every(isItem);
}

/** 下書きを戻す。base が今の版と違う（ほかの人が先に出した）・壊れた・空なら null */
export function loadDraft(raw: string | null, base: number): Draft | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || !isEdits(v["edits"]) || typeof v["saved_at"] !== "string" || typeof v["by"] !== "string")
    return null;
  if (v["edits"].base !== base) return null;
  return { edits: v["edits"], saved_at: v["saved_at"], by: v["by"] };
}

/** 下書きの置き場の鍵（この PC の localStorage） */
export const draftKey = (id: string): string => `kaname.ops.template-draft.${id}`;

/** 下書きを保存した時刻（日本時間の MM/DD HH:mm） */
export function savedAtText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("month")}/${p("day")} ${p("hour")}:${p("minute")}`;
}

/** 副題（下書きが無ければ「今の版 v<N> を写して直しています」） */
export const subOf = (version: number, draft: Draft | null): string =>
  draft
    ? `今の版 v${version} を写して直しています ・ 下書き ・ ${draft.by} ・ ${savedAtText(draft.saved_at)} に保存`
    : `今の版 v${version} を写して直しています`;

/** 本文のひな形の要約（段落ごとの字を「・」でつなぐ・60 字まで） */
export function bodySummary(doc: unknown, max = 60): string {
  const texts: string[] = [];
  const walk = (n: unknown): string => {
    if (!isObj(n)) return "";
    if (typeof n["text"] === "string") return n["text"];
    return Array.isArray(n["content"]) ? n["content"].map(walk).join("") : "";
  };
  if (isObj(doc) && Array.isArray(doc["content"]))
    for (const b of doc["content"]) {
      const t = walk(b).trim();
      if (t) texts.push(t);
    }
  const s = texts.join("・");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** 表の 1 行の印：今の版から（足した／直した／消す／そのまま） */
export type RowChange = "足した" | "直した" | "消す" | null;
export interface EditRowOf {
  item: TemplateItem;
  change: RowChange;
  /** 今の版の物か（足した物は false） */
  current: boolean;
}
export function rowsOf(current: readonly TemplateItem[], edits: Edits): EditRowOf[] {
  return [
    ...current.map((it): EditRowOf => {
      const c = edits.changes[it.key];
      if (!c) return { item: it, change: null, current: true };
      return c.kind === "delete"
        ? { item: it, change: "消す", current: true }
        : { item: c.item, change: "直した", current: true };
    }),
    ...edits.added.map((it): EditRowOf => ({ item: it, change: "足した", current: false })),
  ];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const omit = (changes: Record<string, Change>, key: string): Record<string, Change> =>
  Object.fromEntries(Object.entries(changes).filter(([k]) => k !== key));

/** 1 つを直す（今の版と同じ中身に戻したら直しを外す）・足した物を直す */
export function editItem(current: readonly TemplateItem[], edits: Edits, item: TemplateItem): Edits {
  const base = current.find((c) => c.key === item.key);
  if (!base) return { ...edits, added: edits.added.map((a) => (a.key === item.key ? item : a)) };
  const rest = omit(edits.changes, item.key);
  return { ...edits, changes: same(base, item) ? rest : { ...rest, [item.key]: { kind: "edit", item } } };
}
/** 消す（今の版の物は消す印・足した物は外す） */
export function deleteItem(current: readonly TemplateItem[], edits: Edits, key: string): Edits {
  if (!current.some((c) => c.key === key)) return { ...edits, added: edits.added.filter((a) => a.key !== key) };
  return { ...edits, changes: { ...edits.changes, [key]: { kind: "delete" } } };
}
/** 消すのを取り消す（今の版のまま） */
export function undoDelete(edits: Edits, key: string): Edits {
  return { ...edits, changes: omit(edits.changes, key) };
}
/** 足す（最後に並ぶ） */
export const addItem = (edits: Edits, item: TemplateItem): Edits => ({ ...edits, added: [...edits.added, item] });
