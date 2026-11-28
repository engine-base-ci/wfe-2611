// 子チケット・つながりの値の整形（K-452）。口の答え（listTicketLinks・listTickets）を部品（views.tsx）の形に直すだけ。口は呼ばない。
//   札は口の side と kind で決める（派生元／派生先／関連）。見えない相手は番号だけ。外せるかは口の can_remove（役の名前で決めない）
import type { TicketSearchRow } from "@/features/F4/pick/use-ticket-search";
import type { AddLinkKind, LinkCandidate, LinkKind, LinkRow, StageTone, TicketRef } from "./views";

export interface LinkStage {
  id?: string;
  key?: string | null;
  name?: string;
}

/** つながり 1 件（listTicketLinks の data の 1 件・createTicketLink の答え） */
export interface ApiLink {
  id: string;
  kind: "related" | "derived_from";
  side: "derived" | "source" | null;
  other: {
    id: string | null;
    number: string;
    title: string | null;
    stage: LinkStage | null;
    scope: { id: string; name: string } | null;
    visible: boolean;
  };
  can_remove: boolean;
  created_at?: string;
}

/** 子 1 件（listTicketLinks の meta.children の 1 件） */
export interface ApiChild {
  id: string;
  number: string;
  title: string;
  stage: LinkStage | null;
}

/** 小窓の種類 → 口の kind */
export const apiKindOf = (k: AddLinkKind): ApiLink["kind"] => (k === "related" ? "related" : "derived_from");

/** 段の札の色：done＝成功・todo＝中立・ほか＝進行中 */
export function stageTone(stage: LinkStage | null | undefined): StageTone {
  if (stage?.key === "done") return "success";
  if (stage?.key === "todo") return "neutral";
  return "progress";
}

const hrefOf = (id: string): string => `/tickets/${encodeURIComponent(id)}`;

function kindOf(l: ApiLink): LinkKind {
  if (l.kind === "related") return "related";
  return l.side === "source" ? "source" : "derived";
}

/** つながりの行（口の順のまま。部品が札ごとにまとめる） */
export function toLinkRows(links: readonly ApiLink[]): LinkRow[] {
  return links.map((l) => {
    const base = { id: l.id, kind: kindOf(l), canRemove: l.can_remove === true, number: l.other.number };
    if (!l.other.visible || !l.other.id) {
      return { ...base, title: "", stage: "", stageTone: "neutral", visible: false };
    }
    return {
      ...base,
      title: l.other.title ?? "",
      stage: l.other.stage?.name ?? "",
      stageTone: stageTone(l.other.stage),
      href: hrefOf(l.other.id),
    };
  });
}

/** 子の行 */
export function toChildRows(children: readonly ApiChild[]): TicketRef[] {
  return children.map((c) => ({
    number: c.number,
    title: c.title,
    stage: c.stage?.name ?? "",
    stageTone: stageTone(c.stage),
    href: hrefOf(c.id),
  }));
}

/** いまの種類で、もうつながっている相手か（同じ相手との同じ種類） */
export function isLinked(links: readonly ApiLink[], otherId: string, kind: AddLinkKind): boolean {
  const k = apiKindOf(kind);
  return links.some((l) => l.other.id === otherId && l.kind === k);
}

/** 候補の行（このチケット自身は出さない・もうつながっている物は選べない・グループの名前は今のグループ） */
export function candidateRows(
  rows: readonly TicketSearchRow[],
  o: { selfId: string; links: readonly ApiLink[]; kind: AddLinkKind },
): LinkCandidate[] {
  return rows
    .filter((r) => r.id !== o.selfId)
    .map((r) => ({
      number: r.number,
      title: r.title,
      stage: r.stage?.name ?? "",
      stageTone: stageTone(r.stage),
      group: r.scope?.name ?? "",
      ...(isLinked(o.links, r.id, o.kind) ? { linked: true } : {}),
    }));
}
