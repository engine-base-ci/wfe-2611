"use client";
// 届いた依頼の「チケットを作る」小窓の選び肢を読む（K-930）。担当＝前からの口 listMembers（会社の人）・グループ＝前からの口 listScopes（meta.writable の物だけ）。
//   小窓を開いたときに 1 回ずつ並べて読む。グループは外枠と同じ問い合わせ（SCOPES_KEY）を使い回すので、外枠がもう読んでいれば呼ばない。
//   自分ではやり直さない（読めないときは小窓の「もう一度」で）
import { useQuery } from "@tanstack/react-query";
import { call } from "@/lib/api/call";
import { ONCE, SCOPES_KEY, readScopes } from "@/features/F4/create-ticket/ticket-shell";
import { RequestCallError, SCREEN } from "./use-requests";

export interface Choice {
  id: string;
  name: string;
}
/** 読んでいる・読めた・読めなかった */
export type ChoicesState = "loading" | "ok" | "failed";

export interface CreateChoices {
  members: Choice[];
  scopes: Choice[];
  membersState: ChoicesState;
  scopesState: ChoicesState;
  retryMembers: () => void;
  retryScopes: () => void;
}

const MEMBERS_KEY = ["k930", "members"] as const;

interface MemberRow {
  id: string;
  display_name: string;
  deleted_at?: string | null;
  suspended_at?: string | null;
  kind_id?: string;
  role_id?: string | null;
}

async function readMembers(): Promise<Choice[]> {
  const r = await call("listMembers", { query: { limit: 200 }, screenId: SCREEN });
  if (!r.ok) throw new RequestCallError(r);
  // 担当に選べるのは、抜けていない・止められていない会社の人だけ（段 4 の作る画面と同じ）。ゲスト（役 requester・K-918）は会社の人でないので外す
  return (r.data as unknown as MemberRow[])
    .filter((m) => !m.deleted_at && !m.suspended_at && (m.kind_id ?? "human") === "human" && m.role_id !== "requester")
    .map((m) => ({ id: m.id, name: m.display_name }));
}

const stateOf = (q: { isError: boolean; data: unknown }): ChoicesState =>
  q.isError ? "failed" : q.data === undefined ? "loading" : "ok";

export function useCreateChoices(open: boolean): CreateChoices {
  const members = useQuery({ queryKey: MEMBERS_KEY, queryFn: readMembers, enabled: open, ...ONCE });
  const scopes = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes(SCREEN), enabled: open, ...ONCE });
  const writable = new Set(scopes.data?.writable ?? []);
  return {
    members: members.data ?? [],
    scopes: (scopes.data?.rows ?? []).filter((s) => writable.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
    membersState: stateOf(members),
    scopesState: stateOf(scopes),
    retryMembers: () => void members.refetch(),
    retryScopes: () => void scopes.refetch(),
  };
}
