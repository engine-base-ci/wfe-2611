"use client";
// 自分の設定 › 知らせ（K-843）：口 getNotificationSettings をタブを開いたワークスペースごとに 1 回読む（開き直しても読み直さない）。
//   保存（updateNotificationSettings）は押した項目だけを送り、答えで差し替える（読み直さない）。
//   写す（copyNotificationSettings）は写した先の読みを捨てる（次に開いたとき 1 回読む）
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import type { NotifyAnswer, NotifyPatch } from "./notify-shape";
import { ME_SCREEN } from "./use-me";

export const notifyKey = (workspaceId: string) => ["k843", "notify", workspaceId] as const;

/** 読めなかった（口の断り・網の切れ） */
export class NotifyReadError extends Error {
  constructor(readonly err: CallErr | null) {
    super(err?.code ?? "network");
  }
}

async function readNotify(workspaceId: string): Promise<NotifyAnswer> {
  let r;
  try {
    r = await call("getNotificationSettings", { query: { workspace_id: workspaceId }, screenId: ME_SCREEN });
  } catch {
    throw new NotifyReadError(null);
  }
  if (!r.ok) throw new NotifyReadError(r);
  return r.data as unknown as NotifyAnswer;
}

/** 開いたタブのワークスペースの受け方（失敗は自分で読み直すまで読み直さない） */
export function useNotifySettings(workspaceId: string): UseQueryResult<NotifyAnswer, NotifyReadError> {
  return useQuery<NotifyAnswer, NotifyReadError>({
    queryKey: notifyKey(workspaceId),
    queryFn: () => readNotify(workspaceId),
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export type WriteResult<T> = { ok: true; data: T } | { ok: false; err: CallErr | null };

/** 保存と写す */
export function useNotifyWrite(): {
  saveNotify: (workspaceId: string, patch: NotifyPatch) => Promise<WriteResult<NotifyAnswer>>;
  copyNotify: (from: string, to: readonly string[]) => Promise<WriteResult<{ copied_to: string[] }>>;
} {
  const qc = useQueryClient();
  return {
    saveNotify: async (workspaceId, patch) => {
      try {
        const body = { workspace_id: workspaceId, ...patch };
        const r = await call("updateNotificationSettings", {
          // 契約の生成した型は出来事を字の並びで持つ（K-837 の答えの形は物の並び）
          body: body as unknown as Ops["updateNotificationSettings"]["body"],
          screenId: ME_SCREEN,
        });
        if (!r.ok) return { ok: false, err: r };
        const data = r.data as unknown as NotifyAnswer;
        qc.setQueryData<NotifyAnswer>(notifyKey(workspaceId), data);
        return { ok: true, data };
      } catch {
        return { ok: false, err: null }; // 網が切れた
      }
    },
    copyNotify: async (from, to) => {
      try {
        const r = await call("copyNotificationSettings", {
          body: { from_workspace_id: from, to_workspace_ids: [...to] },
          screenId: ME_SCREEN,
        });
        if (!r.ok) return { ok: false, err: r };
        for (const id of to) qc.removeQueries({ queryKey: notifyKey(id) });
        return { ok: true, data: r.data as unknown as { copied_to: string[] } };
      } catch {
        return { ok: false, err: null };
      }
    },
  };
}
