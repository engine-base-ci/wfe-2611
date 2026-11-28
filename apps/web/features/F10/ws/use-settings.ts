// 設定の画面（K-831）：口 getWorkspaceSettings（K-827）を 1 回だけ読む（StrictMode でも 1 回・読み直さない）。
//   書いた答え（名前・ロゴ・誰ができるか）は setQueryData で差し替える（書いたあとに読み直さない・K831-UI-023）
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import type { SettingsAnswer } from "./settings-shape";

export const SCREEN = "company-settings";
export const SETTINGS_KEY = ["k831", "settings"] as const;

/** 読めなかったときの答え（入れ物が 403・503 などを出し分ける） */
export class SettingsLoadError extends Error {
  constructor(readonly result: CallErr) {
    super(result.code);
  }
}

async function readSettings(): Promise<SettingsAnswer> {
  const r = await call("getWorkspaceSettings", { screenId: SCREEN });
  if (!r.ok) throw new SettingsLoadError(r);
  return r.data as unknown as SettingsAnswer;
}

/** 設定を読む。enabled が false の間（役を読み終える前・閲覧のみ）は口を呼ばない */
export function useSettings(enabled: boolean): UseQueryResult<SettingsAnswer, Error> {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: readSettings,
    enabled,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** 読んだ答えを、書いた答えで差し替える関数（読み直さない） */
export function usePatchSettings(): (fn: (a: SettingsAnswer) => SettingsAnswer) => void {
  const qc = useQueryClient();
  return (fn) => qc.setQueryData<SettingsAnswer>(SETTINGS_KEY, (a) => (a ? fn(a) : a));
}
