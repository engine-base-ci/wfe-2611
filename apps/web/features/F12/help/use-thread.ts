// 問い合わせ 1 件のやり取り（K-1007）の口：1 件を読む（getMyInquiry）・返事を書く（postInquiryMessage）・済みにする（resolveMyInquiry）。
//   読むのは 1 画面 1 回（StrictMode でも二重にしない・窓に戻っても読み直さない）。開いたら自分の問い合わせの一覧（K-956 の鍵）を古い印にする
//   （返事ありの印は口が読んだ印を付けた後の答えに合わせる・K-951）。書いた・済みにした後は 1 件を読み直す（別 GET で画面と答えを合わせる）。
//   口が断った番号は呼ぶ側が出し分ける：見つからない（404）・止まっている（503 → E-PAGE-003）・網の切れ（E-PAGE-007）
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Ops } from "@kaname/contracts";
import { errorCodeOf, PAGE_ERROR } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { InquiryDetailIn } from "./thread-shape";
import { INQUIRIES_KEY } from "./use-help";

const SCREEN = "inquiry";
export const inquiryKey = (id: string) => ["k1007", "inquiry", id] as const;

/** 口が断った（または網が切れた）。notFound はその問い合わせが見えない（無い・別の人の・消えた） */
export class ThreadCallError extends Error {
  constructor(
    readonly code: string,
    readonly notFound = false,
  ) {
    super(code);
  }
}

const refusal = (r: CallErr): ThreadCallError =>
  r.kind === "not_found"
    ? new ThreadCallError(PAGE_ERROR.notFound, true)
    : new ThreadCallError(r.status === 503 ? PAGE_ERROR.down : errorCodeOf(r));

/** 呼ぶ。網の切れは E-PAGE-007、断られたら番号つきで投げる */
async function ask<T>(go: () => Promise<{ ok: true; data: unknown } | CallErr>): Promise<T> {
  let r: Awaited<ReturnType<typeof go>>;
  try {
    r = await go();
  } catch {
    throw new ThreadCallError(PAGE_ERROR.loadFailed);
  }
  if (!r.ok) throw refusal(r);
  return r.data as T;
}

const isDetail = (v: unknown): v is InquiryDetailIn => {
  const d = v as Partial<InquiryDetailIn> | null;
  return !!d && typeof d.id === "string" && typeof d.title === "string" && Array.isArray(d.messages);
};

export function useInquiry(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: inquiryKey(id),
    ...ONCE,
    queryFn: async (): Promise<InquiryDetailIn> => {
      const v = await ask<unknown>(() => call("getMyInquiry", { params: { id }, screenId: SCREEN }));
      // 形が違えば読めなかったとして扱う（ふつうに見せない・G-15）
      if (!isDetail(v)) throw new ThreadCallError(PAGE_ERROR.loadFailed);
      return { ...v, context: v.context ?? null };
    },
  });
  const opened = q.isSuccess;
  useEffect(() => {
    if (opened) void qc.invalidateQueries({ queryKey: INQUIRIES_KEY });
  }, [opened, qc]);
  return q;
}

/** 読み直す：1 件と自分の問い合わせの一覧 */
const refresh = (qc: ReturnType<typeof useQueryClient>, id: string): Promise<unknown> =>
  Promise.all([qc.invalidateQueries({ queryKey: inquiryKey(id) }), qc.invalidateQueries({ queryKey: INQUIRIES_KEY })]);

/** 返事を書く（体は body だけ）。済みの後に書くと口が開き直す（state waiting・D-156.25） */
export function useReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      ask<unknown>(() =>
        call("postInquiryMessage", {
          params: { id },
          body: { body } as unknown as Ops["postInquiryMessage"]["body"],
          screenId: SCREEN,
        }),
      ),
    onSuccess: () => refresh(qc, id),
  });
}

/** 解決したので済みにする（体は空） */
export function useResolve(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      ask<unknown>(() =>
        call("resolveMyInquiry", {
          params: { id },
          body: {} as unknown as Ops["resolveMyInquiry"]["body"],
          screenId: SCREEN,
        }),
      ),
    onSuccess: () => refresh(qc, id),
  });
}
