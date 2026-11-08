"use client";
// 承認して完了する（K-63）の画面の共通：チケットの詳細の読み直し（@tanstack/react-query）・エラーの文・日本時間・期限の区切り。
//   チケットの詳細（getTicket）は、K-60 の詳細と K-63 の帯が同じ鍵で読む（帯が読み直しの間隔を決める）
import { useQuery } from "@tanstack/react-query";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";

export const ticketKey = (id: string) => ["k60", "ticket", id] as const;
export const queueKey = ["k63", "queue"] as const;
/** 読み直しの間隔（今の実行が待っている・動いている・確認待ちの間だけ） */
export const POLL_MS = 3_000;

/** チケットを読めなかった（答えの体の正本の ID を持つ） */
export class TicketReadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** チケットの詳細を読む。interval は読み直しの間隔（false で読み直さない）。同じ鍵の読み手のうち短いものが効く */
export function useTicket<T>(id: string, o: { enabled?: boolean; interval?: number | false } = {}) {
  return useQuery({
    queryKey: ticketKey(id),
    enabled: o.enabled ?? true,
    retry: false,
    refetchInterval: o.interval ?? false,
    queryFn: async (): Promise<T> => {
      const r = await call("getTicket", { params: { id }, screenId: "tickets" });
      if (!r.ok) throw new TicketReadError(errorCodeOf(r));
      return r.data as unknown as T;
    },
  });
}

/** 知らせの文。正本の文の後ろの（…）の例（「山田さんが 1 分前に承認」など）は出さない */
export function messageOf(r: Pick<CallErr, "kind" | "code" | "status">): string {
  let code = errorCodeOf(r);
  try {
    errorText(code);
  } catch {
    code = PAGE_ERROR.loadFailed;
  }
  return errorText(code).entry.message.replace(/（[^）]*）$/, "");
}
export const catalogMessage = (code: string): string => errorText(code).entry.message.replace(/（[^）]*）$/, "");

const pad = (n: number) => String(n).padStart(2, "0");
/** 日本時間の「11/08 15:20」 */
export function jstStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** 日本時間の今日（YYYY-MM-DD）から days 日後 */
export const jstDay = (days = 0, now = Date.now()): string =>
  new Date(now + 9 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

export const DUE_GROUPS = ["期限切れ", "今日", "7 日以内", "それより後", "期限なし"] as const;
export type DueGroup = (typeof DUE_GROUPS)[number];
/** 期限の区切り（日本時間の日付・D-128.36） */
export function dueGroupOf(due: string | null, now = Date.now()): DueGroup {
  if (!due) return "期限なし";
  const today = jstDay(0, now);
  if (due < today) return "期限切れ";
  if (due === today) return "今日";
  if (due <= jstDay(7, now)) return "7 日以内";
  return "それより後";
}
