// 保存した検索条件の中身（filters）と開き方（K-479・D-128.83）。
//   filters は { v: 1, view: "mine"｜"all", q?: 言葉, params: 今の絞りの欄の組 }。欄の名前は K-478 の FILTER_KEYS だけ（写しを持たない）。
//   開く＝一覧の URL に直して移る。列と行の高さは移る前に端末の覚えに書く（読めない中身のときは書かない）
import { COLUMNS_STORAGE, parseColumns } from "@/features/F4/ticket-list/list-columns";
import { FILTER_KEYS } from "./filter-params";

/** 行の高さの端末の覚え（K-478 の use-list-density と同じ鍵） */
export const DENSITY_STORAGE = "kaname.f7.list-density";
/** 読めない中身で開いたとき、移った先で出すお知らせの印（1 回だけ） */
export const UNREADABLE_FLAG = "kaname.f7.saved-unreadable";

export type ListViewName = "mine" | "all";
export type SavedFilters = {
  v: 1;
  view: ListViewName;
  q?: string;
  params: Record<string, string>;
};
export type Density = "normal" | "compact";

/** 画面が読む保存した条件の 1 件（口の 13 鍵のうち画面が使う物） */
export interface ViewRow {
  id: string;
  name: string;
  share: "self" | "group";
  scope_id: string | null;
  filters: unknown;
  columns: string[];
  density: Density;
  can_edit: boolean;
}

const KNOWN = new Set<string>(FILTER_KEYS as readonly string[]);

/** 今の URL の問い合わせから、保存する絞り（FILTER_KEYS の欄だけ・付いている物は全部） */
export function paramsOfSearch(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of search) if (KNOWN.has(k) && v !== "") out[k] = v;
  return out;
}

/** 保存する filters */
export function filtersOf({
  view,
  q,
  extra,
}: {
  view: ListViewName;
  q: string;
  extra: Record<string, string>;
}): SavedFilters {
  const text = q.trim();
  return { v: 1, view, ...(text ? { q: text } : {}), params: { ...extra } };
}

/** 形の確かめ：v が 1・view が mine か all・params が知っている欄の文字だけ。外れたら null */
export function readFilters(raw: unknown): SavedFilters | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r["v"] !== 1 || (r["view"] !== "mine" && r["view"] !== "all")) return null;
  if (r["q"] !== undefined && typeof r["q"] !== "string") return null;
  const p = r["params"];
  if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (!KNOWN.has(k) || typeof v !== "string") return null;
    params[k] = v;
  }
  return { v: 1, view: r["view"], ...(typeof r["q"] === "string" && r["q"] ? { q: r["q"] } : {}), params };
}

/** 一覧の URL（読めない中身なら、グループだけで絞りなし） */
export function hrefOf(v: Pick<ViewRow, "filters" | "scope_id">): string {
  const f = readFilters(v.filters);
  const u = new URLSearchParams();
  u.set("view", f?.view ?? "all");
  if (v.scope_id) u.set("scope", v.scope_id);
  if (f?.q) u.set("q", f.q);
  for (const [k, val] of Object.entries(f?.params ?? {})) u.set(k, val);
  return `/tickets?${u.toString()}`;
}

/** 今の URL が保存した条件と完全に同じか（view・scope・q・絞りの欄の組） */
export function isCurrent(v: Pick<ViewRow, "filters" | "scope_id">, search: URLSearchParams): boolean {
  const f = readFilters(v.filters);
  if (!f) return false;
  if ((search.get("view") ?? "mine") !== f.view && !(f.view === "all" && search.get("scope"))) return false;
  if ((search.get("scope") ?? null) !== (v.scope_id ?? null)) return false;
  if ((search.get("q") ?? "") !== (f.q ?? "")) return false;
  const now = paramsOfSearch(search);
  const keys = new Set([...Object.keys(now), ...Object.keys(f.params)]);
  for (const k of keys) if (now[k] !== f.params[k]) return false;
  return true;
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 覚えられない窓では、開いた先の既定のまま
  }
}

/** 列と行の高さを端末の覚えに書く（compact は端末の tight）。読めない中身なら書かず、移った先のお知らせの印を置く */
export function rememberLook(v: Pick<ViewRow, "filters" | "columns" | "density">): void {
  if (!readFilters(v.filters)) {
    try {
      window.sessionStorage.setItem(UNREADABLE_FLAG, "1");
    } catch {
      // 印を置けなければお知らせは出ない（絞りなしで開くのは同じ）
    }
    return;
  }
  write(COLUMNS_STORAGE, JSON.stringify(v.columns));
  write(DENSITY_STORAGE, v.density === "compact" ? "tight" : "normal");
}

/** 移った先で 1 回だけ読む（読めない中身で開いたか） */
export function takeUnreadableFlag(): boolean {
  try {
    const hit = window.sessionStorage.getItem(UNREADABLE_FLAG) !== null;
    if (hit) window.sessionStorage.removeItem(UNREADABLE_FLAG);
    return hit;
  } catch {
    return false;
  }
}

/** 今の端末の覚えから、保存する列と行の高さ */
export function lookNow(): { columns: string[]; density: Density } {
  let density: Density = "normal";
  let raw: string | null = null;
  try {
    density = window.localStorage.getItem(DENSITY_STORAGE) === "tight" ? "compact" : "normal";
    raw = window.localStorage.getItem(COLUMNS_STORAGE);
  } catch {
    // 読めなければ既定（全部の列・ふつう）
  }
  return { columns: parseColumns(raw), density };
}
