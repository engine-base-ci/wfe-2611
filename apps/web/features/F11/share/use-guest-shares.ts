"use client";
// ゲストに見せる相手を読む・付け外しする器（K-905）。口は K-881 の listTicketGuestShares（読む）と updateTicketGuestShares（付け外し）だけ。
//   読むのは詳細を開いたときに 1 回（問い合わせ ["guest-shares", id]・区画とやり取りの頭の印で同じ物を使い、口を増やさない）。
//   付け外しの後は口の答えを写さず、1 回だけ読み直す（再取得を出す・G-02）。変える／変えないは口の答え can_change で決める（役の名前を見ない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { ShareGroup } from "./views";

export interface GuestShares {
  /** 今見せている相手 */
  shared: ShareGroup[];
  /** まだ見せていない選べる相手（書けない人には空） */
  choices: ShareGroup[];
  canChange: boolean;
}

export const guestSharesKey = (id: string) => ["guest-shares", id] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function groupsOf(v: unknown, idKey: "guest_group_id" | "id"): ShareGroup[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).map((g) => ({ id: str(g[idKey]), name: str(g["name"]), summary: str(g["summary"]) }));
}

/** 口の答えを画面の形に直す（純な関数） */
export function sharesOf(data: unknown): GuestShares {
  const d = isRecord(data) ? data : {};
  return {
    shared: groupsOf(d["shared"], "guest_group_id"),
    choices: groupsOf(d["choices"], "id"),
    canChange: d["can_change"] === true,
  };
}

async function readShares(id: string): Promise<GuestShares> {
  const r = await call("listTicketGuestShares", { params: { id }, screenId: "tickets" });
  if (!r.ok) throw new Error(r.code);
  return sharesOf(r.data);
}

/** 付け外しの失敗：小窓に出す知らせ。グループが消えていた（404）ときは候補を読み直す */
export interface ShareFailure {
  title: string;
  body?: string;
  reload: boolean;
}
const GONE = "E-GST-040";
const TOO_MANY = "E-GST-041";
export function failureOf(status: number, code: string): ShareFailure {
  if (status === 404 && code === GONE) return { title: errorText(GONE).title.replace(/。$/, ""), reload: true };
  if (status === 409 && code === TOO_MANY)
    return { title: errorText(TOO_MANY).title.replace(/。$/, ""), reload: false };
  return {
    title: "見せる相手を決められませんでした",
    body: "もう一度押してください。選んだ相手は、この小窓に残っています。",
    reload: false,
  };
}

/** 付け外しの体：変わった物だけ（空の配列は送らない・口は minItems 1） */
export function changeBody(before: readonly string[], after: readonly string[]): { add?: string[]; remove?: string[] } {
  const add = after.filter((x) => !before.includes(x));
  const remove = before.filter((x) => !after.includes(x));
  return { ...(add.length ? { add } : {}), ...(remove.length ? { remove } : {}) };
}

/** 読み方は 1 つ（先読みと区画・やり取りの頭の印で同じ鍵・同じ器。答えがあれば 2 回目の口を呼ばない） */
export const guestSharesQuery = (id: string) =>
  ({ queryKey: guestSharesKey(id), queryFn: () => readShares(id), ...ONCE }) as const;

/** 詳細を開いたときに詳細と同時に 1 回読み始める（詳細の答えを待ってから読むと直列の 2 段目になる・台帳 /tickets/:id の max_stages 1） */
export function usePrefetchGuestShares(id: string, enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    void qc.prefetchQuery(guestSharesQuery(id));
  }, [qc, id, enabled]);
}

export function useGuestShares(id: string) {
  const qc = useQueryClient();
  const q = useQuery(guestSharesQuery(id));
  const reload = useCallback(() => qc.invalidateQueries({ queryKey: guestSharesKey(id) }), [qc, id]);
  /** 付け外し。成功なら読み直し終わってから null、失敗なら知らせ */
  const update = useCallback(
    async (body: { add?: string[]; remove?: string[] }): Promise<ShareFailure | null> => {
      let fail: ShareFailure;
      try {
        const r = await call("updateTicketGuestShares", { params: { id }, body, screenId: "tickets" });
        if (r.ok) {
          await reload();
          return null;
        }
        fail = failureOf(r.status, r.code);
      } catch {
        fail = failureOf(0, "");
      }
      if (fail.reload) await reload();
      return fail;
    },
    [id, reload],
  );
  return {
    data: q.data ?? null,
    failed: q.isError,
    retry: () => void q.refetch(),
    update,
  };
}
