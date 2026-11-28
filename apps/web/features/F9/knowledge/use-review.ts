"use client";
// K-696「管理 › 見直すページ」の状態と口：読む（getKnowledgeReview・K-695）・並べて見る 2 ページ（getKnowledgePage・K-677）。
//   見直すページは管理が開いたとき 1 回（窓に戻っても読み直さない・G-16）。並べるページは開いたとき 2 ページを同時に読み、
//   閉じて開き直しても・別の行が同じページを開いても読み直さない。更新は新しい値を作って入れ替える
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k";
import { call } from "@/lib/api/call";
import { reviewRows, type ReviewAnswer, type ReviewRows } from "./review-shape";
import type { PageAnswer } from "./shape";

const SCREEN = "knowledge";
export const REVIEW_KEY = ["k696", "knowledge", "review"] as const;
export const reviewPageKey = (id: string) => ["k696", "knowledge", "page", id] as const;
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** 読めなかった訳（noAccess＝見られない） */
export class ReviewLoadError extends Error {
  constructor(
    readonly code: string,
    readonly noAccess: boolean,
  ) {
    super(code);
    this.name = "ReviewLoadError";
  }
}

async function readReview(): Promise<ReviewAnswer> {
  let r;
  try {
    r = await call("getKnowledgeReview", { screenId: SCREEN });
  } catch {
    throw new ReviewLoadError(PAGE_ERROR.loadFailed, false); // 網が切れた
  }
  if (r.ok) return r.data as unknown as ReviewAnswer;
  if (r.status === 403) throw new ReviewLoadError(PAGE_ERROR.forbidden, true);
  throw new ReviewLoadError(r.status === 503 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed, false);
}

async function readPage(id: string): Promise<PageAnswer> {
  let r;
  try {
    r = await call("getKnowledgePage", { params: { id }, screenId: SCREEN });
  } catch {
    throw new ReviewLoadError(PAGE_ERROR.loadFailed, false);
  }
  if (r.ok) return r.data as unknown as PageAnswer;
  if (r.status === 403 || r.status === 404 || r.status === 422) throw new ReviewLoadError(PAGE_ERROR.forbidden, true);
  const code = errorCodeOf(r);
  throw new ReviewLoadError(code === PAGE_ERROR.maintenance && r.status === 503 ? PAGE_ERROR.down : code, false);
}

export interface PairPage {
  status: "loading" | "error" | "ready";
  page?: PageAnswer;
  error?: ReviewLoadError;
}

export interface Review {
  status: "loading" | "error" | "ready";
  error: ReviewLoadError | null;
  rows: ReviewRows;
  /** 並べて開いている食い違いの行 */
  openIds: ReadonlySet<string>;
  /** ページの id → 並べる列の状態（開いている行のページだけ） */
  pages: ReadonlyMap<string, PairPage>;
  toggleCompare: (rowId: string) => void;
  retryPage: (pageId: string) => void;
  retry: () => void;
}

const EMPTY: ReviewRows = { unused: [], conflicts: [], broken: [], pairs: {} };

export function useReview(): Review {
  const qc = useQueryClient();
  const q = useQuery<ReviewAnswer, ReviewLoadError>({ queryKey: REVIEW_KEY, queryFn: readReview, ...ONCE });
  const rows = q.data ? reviewRows(q.data) : EMPTY;
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const pageIds = [
    ...new Set(
      [...openIds].flatMap((id) => {
        const p = rows.pairs[id];
        return p ? [p.upperId, p.lowerId] : [];
      }),
    ),
  ];
  const results = useQueries({
    queries: pageIds.map((id) => ({
      queryKey: reviewPageKey(id),
      queryFn: () => readPage(id),
      ...ONCE,
    })),
  });
  const pages = new Map<string, PairPage>(
    pageIds.map((id, i) => {
      const r = results[i]!;
      if (r.data) return [id, { status: "ready", page: r.data as PageAnswer }];
      if (r.isError) return [id, { status: "error", error: r.error as ReviewLoadError }];
      return [id, { status: "loading" }];
    }),
  );

  const toggleCompare = (rowId: string) =>
    setOpenIds((cur) => (cur.has(rowId) ? new Set([...cur].filter((x) => x !== rowId)) : new Set([...cur, rowId])));
  const retryPage = (pageId: string) => void qc.refetchQueries({ queryKey: reviewPageKey(pageId) });

  return {
    status: q.isError ? "error" : q.data ? "ready" : "loading",
    error: q.error ?? null,
    rows,
    openIds,
    pages,
    toggleCompare,
    retryPage,
    retry: () => void q.refetch(),
  };
}
