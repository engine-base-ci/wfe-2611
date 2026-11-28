// 確認項目の出どころの印と「まだ完了にできません」の小窓の値を読む入口（K-703・決め 12）。純粋な関数だけ（口を呼ばない・入力を書き換えない・@/ を読まない）。
//   行の形の正は口の葉 K-434（listTestSpecs の 1 行・K-726 が source_page を足す）と K-701（完了の口の 409 E-KNW-240・detail.left）。
//   完了を止めるのは「必ず守る」から入った行（出どころ knowledge・source_page が在る・チェックが無い）だけ。人が足した行は数えて注意だけ出す。
//   形の違う行は捨てる（画面を落とさない）
import { pageHref } from "./ticket-rows-shape";

/** 完了を止める行 1 つ（文・出どころのページの題名と id） */
export interface BlockRow {
  id: string;
  text: string;
  from: string;
  pageId: string;
}
/** 小窓に渡す行（ticket-views.tsx の SpecRow と同じ形）。from があるのは止める行だけ */
export interface DialogRow {
  id: string;
  text: string;
  done: false;
  from?: string;
}
/** 印の字とページの道（道が無いときは字だけ） */
export interface SpecMark {
  label: string;
  href: string | null;
}

/** 完了を止める 409 の番号（K-701） */
const KNOWLEDGE_LEFT = "E-KNW-240";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const isKnowledge = (row: Rec): boolean => row["source"] === "knowledge";
const isOpen = (row: Rec): boolean => row["checked"] !== true;

/** 行の出どころのページ（id・題名が文字のときだけ） */
function sourcePage(row: Rec): { id: string; title: string } | null {
  const p = row["source_page"];
  if (!isRec(p)) return null;
  const id = str(p["id"]);
  const title = str(p["title"]);
  return id !== null && title !== null ? { id, title } : null;
}

/** 完了を止める行：出どころ knowledge・source_page が在る・チェックが無い行（元の順） */
export function blockingOf(rows: readonly unknown[]): BlockRow[] {
  return rows.flatMap((r): BlockRow[] => {
    if (!isRec(r) || !isKnowledge(r) || !isOpen(r)) return [];
    const page = sourcePage(r);
    const id = str(r["id"]);
    const text = str(r["title"]);
    return page && id !== null && text !== null ? [{ id, text, from: page.title, pageId: page.id }] : [];
  });
}

/** 人が足した行（出どころが knowledge でない）のうち、チェックの無い行 */
function openManual(rows: readonly unknown[]): Rec[] {
  return rows.filter((r): r is Rec => isRec(r) && !isKnowledge(r) && isOpen(r));
}

/** 注意だけの数：チェックの無い人が足した行の数（knowledge の行は数えない） */
export function cautionCount(rows: readonly unknown[]): number {
  return openManual(rows).length;
}

/** 完了の口の 409 の体から止める行を読む。E-KNW-240 で読める行が 1 つ以上なら並び、それ以外は null */
export function leftFromConflict(body: unknown): BlockRow[] | null {
  if (!isRec(body) || body["code"] !== KNOWLEDGE_LEFT) return null;
  const detail = body["detail"];
  const left = isRec(detail) ? detail["left"] : null;
  if (!Array.isArray(left)) return null;
  const rows = left.flatMap((x): BlockRow[] => {
    if (!isRec(x)) return [];
    const id = str(x["id"]);
    const text = str(x["title"]);
    const pageId = str(x["page_id"]);
    const from = str(x["page_title"]);
    return id !== null && text !== null && pageId !== null && from !== null ? [{ id, text, from, pageId }] : [];
  });
  return rows.length ? rows : null;
}

/** 小窓に渡す行：止める行 → 人が足したチェックの無い行。止める行が 0 なら空（小窓を作らない） */
export function dialogRows(blocking: readonly BlockRow[], rows: readonly unknown[]): DialogRow[] {
  if (!blocking.length) return [];
  const manual = openManual(rows).flatMap((r): DialogRow[] => {
    const id = str(r["id"]);
    return id !== null ? [{ id, text: str(r["title"]) ?? "", done: false }] : [];
  });
  return [...blocking.map((b): DialogRow => ({ id: b.id, text: b.text, done: false, from: b.from })), ...manual];
}

/** 確認項目の行の印：出どころ knowledge で source_page が在る行だけ「ナレッジ：<題名>」とページの道 */
export function specMark(row: unknown): SpecMark | null {
  if (!isRec(row) || !isKnowledge(row)) return null;
  const page = sourcePage(row);
  return page ? { label: `ナレッジ：${page.title}`, href: pageHref(page.id) } : null;
}
