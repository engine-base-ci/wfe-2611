"use client";
// K-693「写して直す」の差し込み（page-slots.ts の PAGE_SLOTS に 1 行）。acts.copy（写す）と bands.openOriginal（写しの帯の「元のページを開く」）を返す。
//   写す口の答えを待つ間は acts.copy を渡さない（押せない形 aria-disabled・二度押しでも 1 回）。ページが無い間は何も渡さない
import type { PageCtx, PageSlot } from "./page-slots";
import { useCopy } from "./use-copy";

const hrefOf = (id: string): string => `/knowledge/${encodeURIComponent(id)}`;

export function useCopySlot(ctx: PageCtx): PageSlot {
  const c = useCopy(ctx);
  if (!ctx.page) return {};
  return {
    acts: c.busy ? {} : { copy: () => void c.copy() },
    bands: { openOriginal: (pageId) => ctx.go(hrefOf(pageId)) },
  };
}
