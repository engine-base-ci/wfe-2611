// グループの口（K-802 createScope・K-804 updateScope）が共に使う入力の整えと答えの鍵。
//   入口（contract/op.ts）が先に全角を半角にし前後の空白を落とし、契約の VALUE_RANGES で形を確かめる。ここは整えた後の値の後ろ盾。

/** 色：画面のトークンの tone の鍵（--k-d-*）をそのまま保存する。画面の字は 青緑・赤紫・藍・黄土・朱・若草 */
export const COLORS = ["teal", "plum", "indigo", "amber", "coral", "sage"] as const;
export type ScopeColor = (typeof COLORS)[number];
/** 色を送らないときの色（画面 K-805 の既定と同じ青緑） */
export const DEFAULT_COLOR: ScopeColor = "teal";
/** 名前の長さ・1 つの会社のグループの数（D-154.8）・一度に選べる人の数 */
export const LIMITS = { nameMax: 100, groups: 200, managers: 10, members: 50 } as const;
/** 短い名前（チケットの番号の頭）：英大文字で始まる英大文字と数字の 1〜8 文字。T だけは頭が空のグループのチケット T-n と重なるので使えない */
export const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;
const RESERVED_PREFIX = "T";

/** 答えの鍵（ちょうど 10・この順）。ScopeCreated・ScopeUpdated で同じ */
export const SCOPE_KEYS = [
  "id",
  "name",
  "ticket_prefix",
  "color",
  "parent_id",
  "layer",
  "position",
  "managers",
  "member_count",
  "created_at",
] as const;

const tidy = (v: string): string => v.normalize("NFKC").trim();

/** 名前：整えて 1〜100 文字。合わなければ null */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = tidy(v);
  const n = Array.from(s).length;
  return n >= 1 && n <= LIMITS.nameMax ? s : null;
}

/** 短い名前：整えて大文字にし、形を確かめる。合わなければ null */
export function cleanPrefix(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = tidy(v).toUpperCase();
  return PREFIX_PATTERN.test(s) && s !== RESERVED_PREFIX ? s : null;
}

/** 色：6 つのどれか。送らなければ既定。合わなければ null */
export function cleanColor(v: unknown): ScopeColor | null {
  if (v === undefined || v === null) return DEFAULT_COLOR;
  return typeof v === "string" && (COLORS as readonly string[]).includes(v) ? (v as ScopeColor) : null;
}

/** 人の id の並び：送らなければ空。文字列の並びで上限の内でなければ null */
export function cleanIds(v: unknown, max: number): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string") || v.length > max) return null;
  return v as string[];
}
