// 探す口（search・K-468〜K-470）の答えを、探す箱の部品の値に直す（純な関数・K-471）。
//   口の 1 件は kind・id・title・snippet・url の 5 つ。種類ごとの組は画面の順（チケット → 決定 → ナレッジ → 会話）に並べ替え、組の中の並びは口のまま。
//   行き先は url が「/」で始まり「//」でないときだけ押せる（それ以外は出すが押せない形）
import type { BadgeTone } from "@/components/k";
import { HITS_PER_KIND, type HitKind, type SearchGroupView, type SearchHitView } from "./search-types";

/** 口の答えの 1 件（契約の SearchHit） */
export interface ApiHit {
  kind: HitKind;
  id: string;
  title: string;
  snippet: string;
  url: string;
}

const KINDS: readonly HitKind[] = ["ticket", "decision", "knowledge", "conversation"];
/** 画面に組を並べる順（下絵のとおり・口の順とは違う） */
export const GROUP_ORDER: readonly HitKind[] = ["ticket", "decision", "knowledge", "conversation"];

/** 答えの形の確かめ：鍵 5 つが文字・kind が 4 つのどれか（違う 1 件は読み飛ばす） */
export function isHit(v: unknown): v is ApiHit {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    ["kind", "id", "title", "snippet", "url"].every((k) => typeof o[k] === "string") &&
    KINDS.includes(o["kind"] as HitKind)
  );
}

/** 押せる行き先か（同じ場所の中の道だけ） */
export function hrefOf(url: string): string | undefined {
  return url.startsWith("/") && !url.startsWith("//") ? url : undefined;
}

const WARNING = new Set(["承認待ち", "渡し中"]);
const PROGRESS = new Set(["実行中", "作業中"]);
/** チケットの段の札の色 */
export function badgeToneOf(stage: string): BadgeTone {
  if (WARNING.has(stage)) return "warning";
  if (PROGRESS.has(stage)) return "progress";
  if (stage === "完了") return "success";
  return "neutral";
}

const SEP = "・";
/** 「EG-128・承認待ち」を前と後ろに分ける（「・」が無ければ前だけ） */
function splitSnippet(s: string): [string, string] {
  const i = s.indexOf(SEP);
  return i < 0 ? [s.trim(), ""] : [s.slice(0, i).trim(), s.slice(i + SEP.length).trim()];
}

/** 口の 1 件 → 1 行の値 */
export function hitViewOf(hit: ApiHit): SearchHitView {
  const href = hrefOf(hit.url);
  const base = { id: hit.id, kind: hit.kind, title: hit.title, ...(href ? { href } : {}) };
  if (hit.kind === "ticket") {
    const [lead, stage] = splitSnippet(hit.snippet);
    return {
      ...base,
      ...(lead ? { lead } : {}),
      ...(stage ? { tag: { label: stage, tone: badgeToneOf(stage) } } : {}),
    };
  }
  if (hit.kind === "decision") {
    const [num, ticket] = splitSnippet(hit.snippet);
    const meta = ticket ? `${num} ${SEP} ${ticket}` : num;
    return { ...base, ...(meta ? { meta } : {}) };
  }
  if (hit.kind === "knowledge") return { ...base, ...(hit.snippet ? { meta: hit.snippet } : {}) };
  return { ...base, ...(hit.snippet ? { snippet: hit.snippet } : {}) };
}

/** 口の答え → 種類ごとの組（画面の順・各 5 件まで・0 件の組も並べる） */
export function groupsOf(hits: readonly ApiHit[]): SearchGroupView[] {
  return GROUP_ORDER.map((kind) => ({
    kind,
    hits: hits
      .filter((h) => h.kind === kind)
      .slice(0, HITS_PER_KIND)
      .map(hitViewOf),
  }));
}
