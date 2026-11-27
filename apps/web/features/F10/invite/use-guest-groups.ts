// ゲストのグループを読む（listGuestGroups・K-876）・名前を直す（updateGuestGroup）・消す（deleteGuestGroup）（K-927 の確定・K-928）。
//   読むのは開いたとき 1 回（StrictMode でも口は 1 回・鍵 GUEST_GROUPS_KEY）。直した・消した・もう無かったときだけ invalidate で 1 回読み直す
//   （作る応答の写しで一覧を書き換えない・G-02）。答えの形は 11_tickets/K-876.md の K876-API-024・025、直す・消すは K-927.md の確定
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { call, type CallErr } from "@/lib/api/call";

export const GUEST_GROUPS_KEY = ["k874", "guest-groups"] as const;
const SCREEN = "members";

/** 一覧の口の 1 グループ（K-876 の確定）。届け先の社内のグループが消えたら request_scope は null */
export interface GuestGroupAnswer {
  id: string;
  name: string;
  request_scope: { id: string; name: string } | null;
  guests: { id: string; name: string; email: string; suspended: boolean }[];
  invitations: { id: string; email: string; left_days: number }[];
}

/** 一覧を読む（403・503 は query の error に CallErr で入る） */
export function useGuestGroups() {
  return useQuery<GuestGroupAnswer[], CallErr>({
    queryKey: GUEST_GROUPS_KEY,
    queryFn: async () => {
      const r = await call("listGuestGroups", { screenId: SCREEN });
      if (!r.ok) throw r;
      const data = r.data as unknown as { groups?: GuestGroupAnswer[] };
      return data.groups ?? [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** 直す・消すの結果。ok でなければ画面が知らせを出す（error の code・status から） */
export type EditResult = { ok: true } | { ok: false; error: CallErr };

/** 名前を直す・消す。どちらも答えが来たら（うまくいった・もう無かった）一覧を 1 回読み直す */
export function useGuestGroupEdit() {
  const qc = useQueryClient();
  const reload = useCallback(() => qc.invalidateQueries({ queryKey: GUEST_GROUPS_KEY }), [qc]);
  const rename = useCallback(
    async (id: string, name: string): Promise<EditResult> => {
      const r = await call("updateGuestGroup", { params: { id }, body: { name }, screenId: SCREEN });
      if (r.ok || r.status === 404) await reload();
      return r.ok ? { ok: true } : { ok: false, error: r };
    },
    [reload],
  );
  const remove = useCallback(
    async (id: string): Promise<EditResult> => {
      const r = await call("deleteGuestGroup", { params: { id }, screenId: SCREEN });
      if (r.ok || r.status === 404) await reload();
      return r.ok ? { ok: true } : { ok: false, error: r };
    },
    [reload],
  );
  return { rename, remove };
}
