// どのエラーを出すか（K-26・D-069）。文言は正本（07_qa/test-specs/errors.json → @kaname/errors/catalog）の 1 件だけ。画面で文言を作らない
//   API の答え（call() の CallErr）→ 正本の ID。サーバーが正本の ID を返したらそれ、無ければ答えの種類で共通の 1 件
import { CATALOG, type CatalogEntry } from "@kaname/errors/catalog";
import type { CallErr } from "@/lib/api/call";

export const PAGE_ERROR = {
  notFound: "E-PAGE-001",
  forbidden: "E-PAGE-002",
  down: "E-PAGE-003",
  maintenance: "E-PAGE-004",
  sessionExpired: "E-PAGE-005",
  linkExpired: "E-PAGE-006",
  loadFailed: "E-PAGE-007",
  offline: "E-PAGE-008",
} as const;
export type PageErrorCode = (typeof PAGE_ERROR)[keyof typeof PAGE_ERROR];

export function errorCodeOf(r: Pick<CallErr, "kind" | "code" | "status">): string {
  if (r.code in CATALOG) return r.code;
  switch (r.kind) {
    case "not_found":
      return PAGE_ERROR.notFound;
    case "forbidden":
      return PAGE_ERROR.forbidden;
    case "unauthenticated":
      return PAGE_ERROR.sessionExpired;
    default:
      return r.status === 503 ? PAGE_ERROR.maintenance : PAGE_ERROR.loadFailed;
  }
}

export interface ErrorText {
  entry: CatalogEntry;
  /** 何が起きたか（正本の文言の最初の 1 文） */
  title: string;
  /** 続き（書きかけは残る・次に何をすればよいか） */
  body: string;
  /** 次の一手（正本の action を「／」で分けたもの） */
  actions: string[];
}

/** 正本の 1 件を、見出し・本文・一手に分ける。正本に無い ID は作り間違いなので止める */
export function errorText(code: string): ErrorText {
  const entry = CATALOG[code];
  if (!entry) throw new Error(`正本（errors.json）に無いエラー: ${code}`);
  const i = entry.message.indexOf("。");
  const title = i < 0 ? entry.message : entry.message.slice(0, i + 1);
  const body = i < 0 ? "" : entry.message.slice(i + 1);
  return {
    entry,
    title,
    body,
    actions: entry.action
      .split("／")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
