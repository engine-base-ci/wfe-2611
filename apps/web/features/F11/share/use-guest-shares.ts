"use client";
// ゲストに見せる相手を読む・付け外しする器（K-905）。口は K-881 の listTicketGuestShares（読む）と updateTicketGuestShares（付け外し）だけ。
//   区画とやり取りの頭の印は、詳細の答え（getTicket）の guest_share で出す（初めの読み込みで見せる相手の口を呼ばない・
//   台帳 perf_budget.json の /tickets/:id の上限 8・PM の決め 2026-11-27 案 (a)）。
//   listTicketGuestShares を読むのは小窓を開いたとき（候補 choices と 1 つずつの summary）の 1 回と、付け外しが 404・E-GST-040 で断られたときの候補の読み直しだけ。
//   付け外しの後は口の答えを写さず、詳細を 1 回だけ読み直す（再取得を出す・G-02）。変える／変えないは答えの can_change で決める（役の名前を見ない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import type { SlotDetail, SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { ShareGroup } from "./views";

export interface GuestShares {
  /** 今見せている相手 */
  shared: ShareGroup[];
  /** まだ見せていない選べる相手（書けない人には空） */
  choices: ShareGroup[];
  canChange: boolean;
}
/** 詳細の答えの guest_share を画面の形にした物（summary・choices は載らない） */
export interface ShareState {
  shared: ShareGroup[];
  canChange: boolean;
}

export const guestSharesKey = (id: string) => ["guest-shares", id] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function groupsOf(v: unknown, idKey: "guest_group_id" | "id"): ShareGroup[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).map((g) => ({ id: str(g[idKey]), name: str(g["name"]), summary: str(g["summary"]) }));
}

/** 見せる相手の口の答えを画面の形に直す（純な関数） */
export function sharesOf(data: unknown): GuestShares {
  const d = isRecord(data) ? data : {};
  return {
    shared: groupsOf(d["shared"], "guest_group_id"),
    choices: groupsOf(d["choices"], "id"),
    canChange: d["can_change"] === true,
  };
}

/** 詳細の答えの guest_share を画面の形に直す（純な関数）。欄が無ければ null（区画を描かない・「社内だけ」と言わない） */
export function shareStateOf(detail: SlotDetail): ShareState | null {
  const g = detail["guest_share"];
  if (!isRecord(g)) return null;
  return { shared: groupsOf(g["shared"], "guest_group_id"), canChange: g["can_change"] === true };
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

/** 小窓の候補の読み方（小窓が開いている間だけ持つ：閉じたら捨て、次に開いたときに読み直す） */
const guestSharesQuery = (id: string) =>
  ({ queryKey: guestSharesKey(id), queryFn: () => readShares(id), ...ONCE, gcTime: 0 }) as const;

/** 小窓を開いたときに候補を 1 回読む（区画を描いただけでは呼ばない） */
export function useShareChoices(id: string) {
  const q = useQuery(guestSharesQuery(id));
  return { data: q.data ?? null, failed: q.isError, retry: () => void q.refetch() };
}

/** 付け外し。成功なら詳細を 1 回読み直し終わってから null、失敗なら知らせ（404・E-GST-040 は小窓の候補を読み直す） */
export function useShareUpdate(ticket: SlotTicket) {
  const qc = useQueryClient();
  const { id, reload } = ticket;
  return useCallback(
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
      if (fail.reload) await qc.refetchQueries({ queryKey: guestSharesKey(id), exact: true });
      return fail;
    },
    [id, reload, qc],
  );
}
