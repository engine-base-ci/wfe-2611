// メンバーの 1 人を読む（K-819・口 getMember は K-810）。1 画面 1 回（StrictMode でも口は 1 回・自分では読み直さない）。
//   書いたあと（K-820〜K-822）は reloadMember（invalidate）で 1 回だけ読み直す。
//   口が断ったときは CallErr ごと投げ、入れ物が状態と code で出し分ける（404・422＝見つからない・403＝権限・ほか＝読めない）
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { readAnswer, type MemberAnswer } from "./member-shape";

export const SCREEN = "member-detail";
export const memberKey = (id: string) => ["k819", "member", id] as const;

/** 口が断った・答えの形が違うとき */
export class MemberLoadError extends Error {
  constructor(readonly r: Pick<CallErr, "status" | "kind" | "code">) {
    super(`getMember ${r.status} ${r.code}`);
  }
}

async function readMember(id: string): Promise<MemberAnswer> {
  const r = await call("getMember", { params: { id }, screenId: SCREEN });
  if (!r.ok) throw new MemberLoadError(r);
  const a = readAnswer(r.data);
  if (!a) throw new MemberLoadError({ status: 500, kind: "failed", code: "E-PAGE-007" });
  return a;
}

/** enabled が false の間（役を読んでいる・見られない人）は口を呼ばない */
export function useMember(id: string, enabled: boolean) {
  return useQuery({ queryKey: memberKey(id), queryFn: () => readMember(id), enabled, ...ONCE });
}

/** 書いたあとに 1 回だけ読み直す（K-820〜K-822 が使う） */
export function reloadMember(qc: QueryClient, id: string): Promise<void> {
  return qc.invalidateQueries({ queryKey: memberKey(id) });
}
