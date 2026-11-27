"use client";
// 運営の 1 社の画面の入れ物（/ops/tenants/<id>）。頭・タブ・読む口は K-971 の受け持ち。
//   K-972：頭のボタン（中を見る・お知らせを送る・⋯ › 止める／再開する）・見ている間の帯・止めている帯・小窓をつなぐ（ws-dialogs.tsx）。
//   1 社は getOpsWorkspace（鍵 ["k971","ws",id]）。できること（caps）は外枠の答え（K-946 と同じ鍵・ここからは読み直さない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ErrorState } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { fetchOpsShell } from "@/lib/ops-shell-api";
import { PeekPanel } from "./tenant-dialogs";
import { TenantFrame } from "./tenant-frame";
import { StatusTab } from "./tenant-tabs";
import { OPS_SHELL_KEY } from "./use-ops-shell";
import { ShellBanner, useWsDialogs, type WsAnswer } from "./ws-dialogs";

const SCREEN = "ops-tenant";
const wsKey = (id: string) => ["k971", "ws", id] as const;

/** 外枠の答えの operator.caps（読めなければ空＝どの操作も押せない形） */
function capsOf(data: unknown): string[] {
  const d = data as { kind?: string; data?: { operator?: { caps?: unknown } } } | undefined;
  const caps = d?.kind === "ok" ? d.data?.operator?.caps : undefined;
  return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === "string") : [];
}

export function WsTenantScreen({ id }: { id: string }) {
  const qc = useQueryClient();
  const shell = useQuery({
    queryKey: OPS_SHELL_KEY,
    queryFn: fetchOpsShell,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const ws = useQuery({
    queryKey: wsKey(id),
    queryFn: async () => {
      const r = await call("getOpsWorkspace", { params: { id }, screenId: SCREEN });
      if (!r.ok) throw r;
      return r.data as unknown as WsAnswer;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const reload = useCallback(() => void qc.invalidateQueries({ queryKey: wsKey(id) }), [qc, id]);
  const replace = useCallback((next: WsAnswer) => qc.setQueryData(wsKey(id), next), [qc, id]);

  if (ws.isPending) return null;
  if (ws.isError || !ws.data) {
    const code = (ws.error as { status?: number } | null)?.status === 404 ? PAGE_ERROR.notFound : PAGE_ERROR.loadFailed;
    return <ErrorState code={code} acts={code === PAGE_ERROR.loadFailed ? [reload] : []} />;
  }
  return <WsTenantBody id={id} ws={ws.data} caps={capsOf(shell.data)} reload={reload} replace={replace} />;
}

function WsTenantBody(props: {
  id: string;
  ws: WsAnswer;
  caps: string[];
  reload: () => void;
  replace: (ws: WsAnswer) => void;
}) {
  const d = useWsDialogs(props);
  return (
    <>
      {d.peekBand ? <ShellBanner>{d.peekBand}</ShellBanner> : null}
      <TenantFrame tab="status" acts={d.acts} stopBand={d.stopBand} notice={d.notice} resuming={d.resuming}>
        {d.peeking ? <PeekPanel /> : null}
        <StatusTab />
      </TenantFrame>
      {d.dialogs}
    </>
  );
}
