"use client";
// 保存した検索条件の読み・書き（K-479）。読みは外枠の口 getShell の答えの saved_views（外枠と同じ問い合わせ SCOPES_KEY・口を増やさない）。
//   無い・配列でない・形の外れた 1 件は捨てる（外枠の答え全体は読める扱いのまま・左のメニューは今のまま）。
//   書く口（createSavedView・updateSavedView・deleteSavedView）は成功したら外枠の問い合わせを読み直す。失敗は CallErr をそのまま返す
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ONCE, SCOPES_KEY, readScopes, type ScopeRow } from "@/features/F4/create-ticket/ticket-shell";
import { call, type CallErr } from "@/lib/api/call";
import type { Density, SavedFilters, ViewRow } from "./open-view";

const SCREEN = "tickets";

/** 外枠の答えの saved_views を読む（形の外れた物は捨てる） */
export function readViews(raw: unknown): ViewRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ViewRow[] = [];
  for (const x of raw) {
    if (typeof x !== "object" || x === null) continue;
    const r = x as Record<string, unknown>;
    if (typeof r["id"] !== "string" || typeof r["name"] !== "string") continue;
    if (r["share"] !== "self" && r["share"] !== "group") continue;
    const scope = r["scope_id"];
    if (scope !== null && scope !== undefined && typeof scope !== "string") continue;
    const columns = Array.isArray(r["columns"]) ? r["columns"].filter((c): c is string => typeof c === "string") : [];
    out.push({
      id: r["id"],
      name: r["name"],
      share: r["share"],
      scope_id: typeof scope === "string" ? scope : null,
      filters: r["filters"],
      columns,
      density: r["density"] === "compact" ? "compact" : "normal",
      can_edit: r["can_edit"] === true,
    });
  }
  return out;
}

interface ShellLike {
  rows?: ScopeRow[];
  saved_views?: unknown;
}

/** 外枠の答え（グループの行と保存した条件）。enabled が偽なら読まない */
export function useSavedViews(enabled: boolean): { views: ViewRow[] | null; groups: ScopeRow[] } {
  const q = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes(SCREEN), enabled, ...ONCE });
  const data = q.data as ShellLike | undefined;
  return useMemo(
    () => ({ views: data ? readViews(data.saved_views) : null, groups: Array.isArray(data?.rows) ? data.rows : [] }),
    [data],
  );
}

export interface CreateInput {
  name: string;
  share: "self" | "group";
  scope_id: string;
  filters: SavedFilters;
  columns: string[];
  density: Density;
}
export type WriteResult = { ok: true; name: string } | { ok: false; err: CallErr | null };

const failOf = (r: CallErr | null): WriteResult => ({ ok: false, err: r });

/** 書く口。成功したら外枠の問い合わせ（saved_views を含む）を読み直す。つながらないときは err が null */
export function useSavedViewWrites() {
  const qc = useQueryClient();
  const reread = useCallback(() => qc.invalidateQueries({ queryKey: SCOPES_KEY }), [qc]);
  const createView = useCallback(
    async (input: CreateInput, idempotencyKey: string): Promise<WriteResult> => {
      try {
        const r = await call("createSavedView", { body: input, idempotencyKey, screenId: SCREEN });
        if (!r.ok) return failOf(r);
        void reread();
        return { ok: true, name: input.name };
      } catch {
        return failOf(null);
      }
    },
    [reread],
  );
  const renameView = useCallback(
    async (id: string, name: string): Promise<WriteResult> => {
      try {
        const r = await call("updateSavedView", { params: { id }, body: { name }, screenId: SCREEN });
        if (!r.ok) return failOf(r);
        void reread();
        return { ok: true, name };
      } catch {
        return failOf(null);
      }
    },
    [reread],
  );
  const deleteView = useCallback(
    async (id: string): Promise<WriteResult> => {
      try {
        const r = await call("deleteSavedView", { params: { id }, screenId: SCREEN });
        if (!r.ok) return failOf(r);
        void reread();
        return { ok: true, name: "" };
      } catch {
        return failOf(null);
      }
    },
    [reread],
  );
  return { createView, renameView, deleteView, reread };
}

// ---- 今の URL の問い合わせ（一覧は history.replaceState で絞りを替えるので、操作のたびに読み直す）
function subscribe(onChange: () => void): () => void {
  let t = 0;
  const later = () => {
    window.clearTimeout(t);
    t = window.setTimeout(onChange, 0);
  };
  const events = ["popstate", "click", "change", "keyup"] as const;
  for (const e of events) window.addEventListener(e, later, true);
  return () => {
    window.clearTimeout(t);
    for (const e of events) window.removeEventListener(e, later, true);
  };
}
const snapshot = (): string => window.location.search;
const serverSnapshot = (): string => "";

/** 今の URL の問い合わせ（サーバーで描くときは空） */
export function useUrlSearch(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => new URLSearchParams(s), [s]);
}

/** 1 回だけ真になる（描いた後・Toaster が付いた後に出すお知らせ用） */
export function useAfterMount(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  return ready;
}
