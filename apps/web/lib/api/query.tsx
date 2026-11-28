"use client";
// TanStack Query（server state）。書き込みの後は別 GET で再取得して画面に反映する（G-03・T-US-03）
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { ApiResponse } from "@kaname/contracts";
import { api, setUnauthorizedHandler, type RequestOptions } from "./client";

export function ApiProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: false } } }),
  );
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    // 401 → 入り直し（今いた場所を next に）。二重に飛ばない
    let fired = false;
    setUnauthorizedHandler(() => {
      if (fired || path.startsWith("/login")) return;
      fired = true;
      client.clear();
      // 戻す先は、開いていた画面の印（?new=1・?from= など）まで含める（入り直したら続きから・K-57・K-60）
      router.replace(`/login?next=${encodeURIComponent(path + window.location.search)}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [client, router, path]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const keys = {
  list: (table: string, query?: RequestOptions["query"]) => ["list", table, query ?? {}] as const,
  one: (table: string, id: string) => ["one", table, id] as const,
};
export function useList<T>(
  table: string,
  query?: RequestOptions["query"],
  screenId?: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: keys.list(table, query),
    queryFn: () => api.list<T>(table, query, screenId),
    ...(opts?.enabled === undefined ? {} : { enabled: opts.enabled }),
  });
}
export function useOne<T>(table: string, id: string | null, screenId?: string) {
  return useQuery({
    queryKey: keys.one(table, id ?? ""),
    queryFn: () => api.get<T>(table, id!, screenId),
    enabled: !!id,
  });
}
/** 作成：成功したら一覧を無効化して別 GET で取り直す（作成レスポンスだけで合格にしない） */
export function useCreate<T>(table: string, screenId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.create<T>(table, body, screenId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["list", table] });
    },
  });
}
export function useUpdate<T>(table: string, screenId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => api.update<T>(table, id, body, screenId),
    onSuccess: async (_r: ApiResponse<T>, v) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["list", table] }),
        qc.invalidateQueries({ queryKey: keys.one(table, v.id) }),
      ]);
    },
  });
}
export function useRemove(table: string, screenId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove(table, id, screenId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["list", table] });
    },
  });
}
