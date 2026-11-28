// 作る面で足したつながりの持ち方（K-580）。純粋な関数だけ（@/ を読まない・単体の試験と下書きの読み方 draft-shape が直に読む）。
//   並びは派生元が関連より前・それぞれ足した順。同じ相手の同じ種類は足さない（別の種類は足せる）。上限 20 件。
//   どの関数も渡した並びを変えず、新しい並びを返す。作る口へは [{ kind, other_ticket_id }] だけを送る（番号・題名は送らない）
import type { CreateLink, CreateLinkKind } from "../create-ticket/create-slot-types";

export type { CreateLink, CreateLinkKind } from "../create-ticket/create-slot-types";

/** 作る面で足せるつながりの上限（作る口の links の maxItems と同じ） */
export const LINKS_MAX = 20;

const KINDS: readonly CreateLinkKind[] = ["derived_from", "related"];

/** 派生元を関連より前に（それぞれの中は渡した順のまま） */
const ordered = (list: readonly CreateLink[]): CreateLink[] => KINDS.flatMap((k) => list.filter((l) => l.kind === k));

/** 同じ種類・同じ相手がもう在るか */
export function isLinked(list: readonly CreateLink[], kind: CreateLinkKind, id: string): boolean {
  return list.some((l) => l.kind === kind && l.id === id);
}

/** 足す（同じ種類・同じ相手・上限のときは足さずに同じ中身を返す） */
export function addLink(list: readonly CreateLink[], link: CreateLink): CreateLink[] {
  if (list.length >= LINKS_MAX || isLinked(list, link.kind, link.id)) return [...list];
  return ordered([...list, link]);
}

/** 外す（種類と相手で決める） */
export function removeLink(list: readonly CreateLink[], kind: CreateLinkKind, id: string): CreateLink[] {
  return list.filter((l) => !(l.kind === kind && l.id === id));
}

/** 作る口の links（画面の並びのまま・1 件も無ければ undefined＝鍵を付けない） */
export function toLinksPayload(
  list: readonly CreateLink[],
): { kind: CreateLinkKind; other_ticket_id: string }[] | undefined {
  if (list.length === 0) return undefined;
  return list.map((l) => ({ kind: l.kind, other_ticket_id: l.id }));
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const isKind = (v: unknown): v is CreateLinkKind => v === "related" || v === "derived_from";

function readStage(v: unknown): CreateLink["stage"] | undefined {
  if (!isObj(v)) return undefined;
  const key = typeof v["key"] === "string" ? v["key"] : null;
  const name = typeof v["name"] === "string" ? v["name"] : "";
  return { key, name };
}

/** 下書きの 1 行（形の違う行は null） */
function readOne(v: unknown): CreateLink | null {
  if (!isObj(v)) return null;
  const { kind, id, number, title } = v;
  if (!isKind(kind) || typeof id !== "string" || typeof number !== "string") return null;
  const stage = readStage(v["stage"]);
  return { kind, id, number, title: typeof title === "string" ? title : "", ...(stage ? { stage } : {}) };
}

/** 下書きの links を読む（配列でなければ無し・形の違う行はその行だけ捨てる・先頭の 20 件まで） */
export function readDraftLinks(raw: unknown): CreateLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map(readOne)
    .filter((l): l is CreateLink => l !== null)
    .slice(0, LINKS_MAX);
}
