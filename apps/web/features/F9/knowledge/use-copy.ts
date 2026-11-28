"use client";
// K-693「写して直す」の状態と口（copyKnowledgePage・K-690）。体は空（フォルダは選ばせない・棚の直下の最後に入る）・冪等の鍵は call が付ける。
//   答えを待つ間は二度目を送らない。成功したら木を読み直して自分の棚の写しを開く（自動で「直す」へ進めない・元は読み直さない）。
//   断り：409・404 はお知らせ（失敗）＋元のページを読み直す／403・503・網の切れはお知らせ（失敗）だけ。道は変えない
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorText, useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import type { PageCtx } from "./page-slots";
import { TREE_KEY, pageKey } from "./use-knowledge";
import { shareErrorCode } from "./use-share";

const SCREEN = "knowledge";
const DONE = "自分の棚に写しました。「直す」で自分用に直せます。";
const hrefOf = (id: string): string => `/knowledge/${encodeURIComponent(id)}`;

export interface UseCopy {
  busy: boolean;
  copy: () => Promise<void>;
}

export function useCopy(ctx: PageCtx): UseCopy {
  const qc = useQueryClient();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const page = ctx.page;

  const copy = async (): Promise<void> => {
    const p = page;
    if (!p || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let r;
      try {
        r = await call("copyKnowledgePage", { params: { id: p.id }, body: {}, screenId: SCREEN });
      } catch {
        notify(errorText(shareErrorCode("network")).title, { type: "error" });
        return;
      }
      if (!r.ok) {
        notify(errorText(shareErrorCode(r)).title, { type: "error" });
        if (r.status === 404 || r.status === 409) await qc.refetchQueries({ queryKey: pageKey(p.id) });
        return;
      }
      const id = (r.data as { id?: string } | undefined)?.id;
      await qc.refetchQueries({ queryKey: TREE_KEY });
      if (id) ctx.go(hrefOf(id));
      notify(DONE);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return { busy, copy };
}
