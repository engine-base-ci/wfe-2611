// 会社の側の「ひな形がこう変わります」（K-1016）：口の答え（K-993 の listKindTemplateUpdates の 1 行・7 欄）→ 部品（views-skills.tsx の TemplateUpdatePage）の値。
//   画面の外の純粋な関数（@/ を読まない・単体の試験 apps/web/test/k1016-template-update-shape.test.ts）。字は下絵が正

export type TemplatePart = "kind" | "state" | "field";
/** 差の 1 つ（K-993：key・change・target_label・detail_label） */
export interface TemplateDiffIn {
  key: string;
  change: "add" | "change";
  target_label: string;
  detail_label: string;
}
/** 届いた版の 1 行（K-993 の 7 欄） */
export interface KindTemplateUpdateIn {
  id: string;
  part: TemplatePart;
  part_name: string;
  from_version: number;
  to_version: number;
  released_at: string;
  diffs: TemplateDiffIn[];
}
/** 部品の差の 1 行（views-skills.tsx の DiffRow と同じ形） */
export interface TemplateDiffRow {
  id: string;
  kind: "足す" | "変える";
  target: string;
  detail: string;
}

/** 届いた版が 2 つ以上のときに出す順（部の順：種別・状態・項目） */
const PART_ORDER: Record<TemplatePart, number> = { kind: 0, state: 1, field: 2 };

const MMDD = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" });
/** 日本の時刻の「MM/DD」。読めなければ空 */
function mmddOf(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const p = Object.fromEntries(MMDD.formatToParts(t).map((x) => [x.type, x.value]));
  return `${p["month"] ?? ""}/${p["day"] ?? ""}`;
}

/** 副題「<part_name> v<from> → v<to> ・ 手を付けていない所だけ ・ 出した日 <MM/DD> ・ Kaname 運営より」 */
export function updateHead(u: KindTemplateUpdateIn): string {
  return `${u.part_name} v${u.from_version} → v${u.to_version} ・ 手を付けていない所だけ ・ 出した日 ${mmddOf(u.released_at)} ・ Kaname 運営より`;
}

/** 差の 1 つ → 部品の 1 行（id は key） */
export function diffRow(d: TemplateDiffIn): TemplateDiffRow {
  return { id: d.key, kind: d.change === "change" ? "変える" : "足す", target: d.target_label, detail: d.detail_label };
}

/** 届いた版のうち、いま出す 1 つ（部の順の最初）。無ければ null */
export function firstUpdate(list: readonly KindTemplateUpdateIn[]): KindTemplateUpdateIn | null {
  return [...list].sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part])[0] ?? null;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isPart = (x: unknown): x is TemplatePart => x === "kind" || x === "state" || x === "field";

function diffOf(x: unknown): TemplateDiffIn | null {
  if (!isObj(x)) return null;
  const { key, change, target_label, detail_label } = x;
  if (typeof key !== "string" || (change !== "add" && change !== "change")) return null;
  if (typeof target_label !== "string" || typeof detail_label !== "string") return null;
  return { key, change, target_label, detail_label };
}

/** 口の答えの 1 行の形を確かめる（違えば null） */
export function updateOf(x: unknown): KindTemplateUpdateIn | null {
  if (!isObj(x)) return null;
  const { id, part, part_name, from_version, to_version, released_at, diffs } = x;
  if (typeof id !== "string" || !isPart(part) || typeof part_name !== "string") return null;
  if (typeof from_version !== "number" || typeof to_version !== "number" || typeof released_at !== "string")
    return null;
  if (!Array.isArray(diffs)) return null;
  const rows = diffs.map(diffOf);
  if (rows.some((d) => d === null)) return null;
  return { id, part, part_name, from_version, to_version, released_at, diffs: rows as TemplateDiffIn[] };
}
