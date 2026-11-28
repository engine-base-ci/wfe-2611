// 困ったとき・お知らせ（K-956）の読む口 3 本と読んだ印の口。どれも 1 画面 1 回（StrictMode でも二重にしない・窓に戻っても読み直さない）。
//   3 本は同時に始める（直列にしない）。鍵は上の帯（K-957：稼働状況）・問い合わせる小窓（K-953）・やり取り（K-1007）と分け合う。
//   答えの形が違う（並びでない など）なら読めなかったとして扱う（ふつうに見せない・G-15）
import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { call } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { InquiryIn, NoticeIn, StatusIn } from "./help-shape";

export const SCREEN = "notices";
export const NOTICES_KEY = ["k956", "notices"] as const;
export const STATUS_KEY = ["k956", "status"] as const;
export const INQUIRIES_KEY = ["k956", "inquiries"] as const;
export const readKey = (id: string) => ["k956", "read", id] as const;

/** 口の失敗は投げる（react-query の失敗になる）。中身は呼ぶ側が形を確かめる */
const dataOf = (r: { ok: true; data: unknown } | { ok: false; code: string }): unknown => {
  if (!r.ok) throw new Error(r.code);
  return r.data;
};
const listOf = <T>(v: unknown, what: string): T[] => {
  if (!Array.isArray(v)) throw new Error(`${what} の形が違う`);
  return v as T[];
};

export function useNotices() {
  return useQuery({
    queryKey: NOTICES_KEY,
    ...ONCE,
    queryFn: async (): Promise<NoticeIn[]> =>
      listOf<NoticeIn>(dataOf(await call("listNotices", { screenId: SCREEN })), "お知らせ"),
  });
}

export function useServiceStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    ...ONCE,
    queryFn: async (): Promise<StatusIn> => {
      const v = dataOf(await call("getServiceStatusForMember", { screenId: SCREEN })) as Partial<StatusIn> | null;
      if (!v || !Array.isArray(v.components)) throw new Error("稼働状況の形が違う");
      return v as StatusIn;
    },
  });
}

export function useMyInquiries() {
  return useQuery({
    queryKey: INQUIRIES_KEY,
    ...ONCE,
    queryFn: async (): Promise<InquiryIn[]> =>
      listOf<InquiryIn>(dataOf(await call("listMyInquiries", { screenId: SCREEN })), "問い合わせ"),
  });
}

/** 読んだ印（体は空）。同じお知らせは 1 回だけ（二度開いても・StrictMode でも・失敗しても呼び直さない）。済んだら一覧を読み直す */
export function useMarkRead(id: string) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationKey: readKey(id),
    mutationFn: async () => {
      dataOf(await call("markNoticeRead", { params: { id }, body: {}, screenId: SCREEN }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTICES_KEY }),
  });
  const mutate = m.mutate;
  /** この表示の中で、どのお知らせに印を呼んだか（失敗も「呼んだ」に数える） */
  const calledFor = useRef<string | null>(null);
  const entries = useCallback(() => qc.getMutationCache().findAll({ mutationKey: readKey(id), exact: true }), [qc, id]);
  /** 1 回だけ呼ぶ。この表示で呼んだか、前に開いて呼んだ（いま呼んでいる・済んだ・失敗した）なら呼ばない */
  const markOnce = useCallback(() => {
    if (calledFor.current === id) return;
    calledFor.current = id;
    if (entries().some((x) => x.state.status !== "idle")) return;
    mutate();
  }, [id, entries, mutate]);
  const done = (): boolean => entries().some((x) => x.state.status === "success");
  return { markOnce, done, status: m.status };
}
