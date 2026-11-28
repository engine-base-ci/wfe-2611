"use client";
// 概要の口（getScopeOverview・GET /api/v1/scopes/:id/overview・K-477）を 1 回読む（K-480）。書かない。
//   グループを選んでいない（scopeId が null）ときは口を呼ばない。グループが替わったら前の答えを捨てる（呼び出しごとの印で見分ける）
//   404 は正本 E-PAGE-001・それ以外は errorCodeOf（届かないとき E-PAGE-007）。401 は共通の入り直しに任せる
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallResult } from "@/lib/api/call";
import { overviewOf, type Overview } from "./overview-data";

export type ScopeOverviewState =
  { state: "idle" } | { state: "loading" } | { state: "ok"; data: Overview } | { state: "error"; code: string };

export interface ScopeOverviewRead {
  read: ScopeOverviewState;
  retry: () => void;
}

type Answer = CallResult<"getScopeOverview"> | null;

async function readOverview(id: string): Promise<Answer> {
  try {
    return await call("getScopeOverview", { params: { id }, screenId: "tickets" });
  } catch {
    return null; // 届かない（ネットが切れた）
  }
}

const codeOf = (r: Answer): string => {
  if (r === null || r.ok) return PAGE_ERROR.loadFailed;
  if (r.status === 404) return PAGE_ERROR.notFound;
  return errorCodeOf(r);
};

export function useScopeOverview(scopeId: string | null): ScopeOverviewRead {
  const [read, setRead] = useState<ScopeOverviewState>(scopeId ? { state: "loading" } : { state: "idle" });
  const seq = useRef(0);

  const load = useCallback(() => {
    const mine = ++seq.current;
    if (!scopeId) {
      setRead({ state: "idle" });
      return;
    }
    setRead({ state: "loading" });
    void readOverview(scopeId).then((r) => {
      if (mine !== seq.current) return; // 後から替えたグループの答えだけを描く
      if (r?.ok) return setRead({ state: "ok", data: overviewOf(r.data) });
      if (r?.kind === "unauthenticated") return;
      setRead({ state: "error", code: codeOf(r) });
    });
  }, [scopeId]);

  useEffect(() => {
    load();
    return () => {
      seq.current += 1; // 画面を離れた・グループが替わった後に届いた答えは描かない
    };
  }, [load]);

  return { read, retry: load };
}
