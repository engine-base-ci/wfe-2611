"use client";
// 運営のお知らせの口（K-980 の読む口・続報を足す口・K-1015 の書く口）。読む口は 1 つずつの鍵で 1 回（StrictMode でも 1 回・retry しない）。
//   K-980：一覧の鍵 ["k980","list",札]・1 件の鍵 ["k980","one",id]（ops-notices-api.ts の口・404 は status で見る）・続報を足す。
//   K-1015：書き直す頁の 1 件の鍵 ["k1015","one",id]（call の口・missing／forbidden に分けて形も確かめる。K-980 の 1 件と答えの形が違うので鍵を分ける）・
//   作る・直す・出すの 3 つの書く口（成功で 1 件の 2 つの鍵と一覧の鍵を捨てる）と、誰に › ワークスペースを選ぶ の候補（listOpsWorkspaces・選んだときだけ 1 回・並びは口のまま）。
//   外枠の口は入れ物（K-946）と同じ鍵で、ここからは読み直さない（二重に呼ばない・D-156.4）。
//   印は顧客の画面と同じ Bearer（call・K-946 と同じ取り方）。401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import { fetchOpsShell, fetchOpsWorkspaces } from "@/lib/ops-shell-api";
import { fetchOpsNotice, fetchOpsNotices, postIncidentUpdate, type OpsNoticeResult } from "@/lib/ops-notices-api";
import { OPS_SHELL_KEY } from "@/features/F12/ops/use-ops-shell";
import type { NoticeBody, NoticeDetail } from "./notice-form";
import { noticesSearch, type NoticeChip } from "./notices-shape";

const SCREEN = "ops-notices";
const opts = { screenId: SCREEN, keepOn401: true } as const;
const once = { retry: false, refetchOnWindowFocus: false } as const;

export const NOTICES_LIST_ROOT = ["k980", "list"] as const;
export const noticesListKey = (chip: NoticeChip) => ["k980", "list", chip] as const;
export const noticeOneKey = (id: string) => ["k980", "one", id] as const;
export const noticeEditKey = (id: string) => ["k1015", "one", id] as const;
export const WS_PICKS_KEY = ["k1015", "workspaces"] as const;

/** 外枠の答え（入れ物が読んだ物をそのまま使う。開いたときに読み直さない＝外枠の口は 1 回） */
export function useOpsShellOnce() {
  return useQuery({
    queryKey: OPS_SHELL_KEY,
    queryFn: fetchOpsShell,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** 外枠の答えの data（ok のときだけ・形は頁が確かめる） */
export function shellDataOf(r: unknown): unknown {
  const o = r as { kind?: unknown; data?: unknown } | undefined;
  return o?.kind === "ok" ? o.data : undefined;
}

/** 外枠の答えの operator.caps（入れ物 K-946 が読んだ同じ鍵をそのまま使い、ここからは読み直さない）。読めなければ空 */
export function useOpsCaps(): { pending: boolean; caps: string[] } {
  const q = useOpsShellOnce();
  const d = q.data as { kind?: string; data?: { operator?: { caps?: unknown } } } | undefined;
  const raw = d?.kind === "ok" ? d.data?.operator?.caps : undefined;
  const caps = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  return { pending: q.isPending, caps };
}

/** 一覧（札が すべて でなければ問い合わせを 1 つ付ける）。できることが無ければ呼ばない */
export function useOpsNotices(chip: NoticeChip, enabled: boolean) {
  return useQuery({
    queryKey: noticesListKey(chip),
    queryFn: () => fetchOpsNotices(noticesSearch({ chip })),
    enabled,
    ...once,
  });
}

/** 1 件の読みの結果（書き直す頁・K-1015）：読めた／入り直し／無い（404）／権限が無い（403）／それ以外の失敗（503・網の切れ・形が違う） */
export type NoticeRead =
  | { kind: "ok"; data: NoticeDetail }
  | { kind: "login" }
  | { kind: "missing" }
  | { kind: "forbidden" }
  | { kind: "failed" };

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isDetail = (d: unknown): d is NoticeDetail =>
  isObj(d) && typeof d["id"] === "string" && typeof d["title"] === "string" && isObj(d["audience"]);

export async function fetchNotice(id: string): Promise<NoticeRead> {
  let r: { ok: true; data: unknown } | CallErr;
  try {
    r = await call("getOpsNotice", { ...opts, params: { id } });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) return isDetail(r.data) ? { kind: "ok", data: r.data } : { kind: "failed" };
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  if (r.status === 404) return { kind: "missing" };
  return { kind: "failed" };
}

/** 1 件。2 つ目に enabled を渡す呼び方は 1 件の頁（K-980・答えは OpsNoticeResult）、id だけ（null で呼ばない）は書き直す頁（K-1015・答えは NoticeRead） */
export function useOpsNotice(id: string, enabled: boolean): UseQueryResult<OpsNoticeResult>;
export function useOpsNotice(id: string | null): UseQueryResult<NoticeRead>;
export function useOpsNotice(id: string | null, enabled?: boolean): UseQueryResult<OpsNoticeResult | NoticeRead> {
  const forEdit = enabled === undefined;
  const key = id ?? "";
  return useQuery<OpsNoticeResult | NoticeRead>({
    queryKey: forEdit ? noticeEditKey(key) : noticeOneKey(key),
    queryFn: () => (forEdit ? fetchNotice(key) : fetchOpsNotice(key)),
    enabled: forEdit ? id !== null : enabled,
    ...once,
  });
}

/** 続報を足す（直ったにするも同じ口）。書けたら 1 件と一覧を読み直す */
export function useAddIncidentUpdate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { state: string; body: string }) => postIncidentUpdate(id, body),
    onSuccess: async (r) => {
      if (r.kind !== "ok") return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: noticeOneKey(id) }),
        qc.invalidateQueries({ queryKey: noticeEditKey(id) }),
        qc.invalidateQueries({ queryKey: NOTICES_LIST_ROOT }),
      ]);
    },
  });
}

/** ワークスペースを選ぶ の候補（id と名前・口の並びのまま） */
export interface WsPick {
  id: string;
  name: string;
}
async function fetchWsPicks(): Promise<WsPick[]> {
  const r = await fetchOpsWorkspaces("");
  if (r.kind !== "ok" || !Array.isArray(r.data)) throw new Error("ops workspaces read failed");
  return r.data.flatMap((w: unknown) =>
    isObj(w) && typeof w["id"] === "string" && typeof w["name"] === "string" ? [{ id: w["id"], name: w["name"] }] : [],
  );
}
export const useWsPicks = (enabled: boolean) =>
  useQuery({ queryKey: WS_PICKS_KEY, queryFn: fetchWsPicks, enabled, staleTime: Infinity, ...once });

/** 書く口の結果：書けた 1 件／断られた（CallErr）／網が切れた */
export type WriteResult = { ok: true; data: NoticeDetail } | { ok: false; err: CallErr | null };

async function write(job: () => Promise<{ ok: true; data: unknown } | CallErr>): Promise<WriteResult> {
  try {
    const r = await job();
    if (!r.ok) return { ok: false, err: r };
    return isDetail(r.data) ? { ok: true, data: r.data } : { ok: false, err: null };
  } catch {
    return { ok: false, err: null };
  }
}
const w = (body: unknown) => ({ ...opts, body: body as never });

export const createNotice = (body: NoticeBody) => write(() => call("createOpsNotice", w(body)));
export const updateNotice = (id: string, body: NoticeBody) =>
  write(() => call("updateOpsNotice", { ...w(body), params: { id } }));
export const publishNotice = (id: string) => write(() => call("publishOpsNotice", { ...w({}), params: { id } }));

/** 作る・直す・出す（成功したら 1 件の 2 つの鍵と一覧の鍵を捨てる） */
export function useNoticeWrites() {
  const qc = useQueryClient();
  const done = (r: WriteResult) => {
    if (!r.ok) return;
    void qc.invalidateQueries({ queryKey: NOTICES_LIST_ROOT });
    void qc.invalidateQueries({ queryKey: noticeOneKey(r.data.id) });
    void qc.invalidateQueries({ queryKey: noticeEditKey(r.data.id) });
  };
  const create = useMutation({ mutationFn: createNotice, onSuccess: done });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: NoticeBody }) => updateNotice(id, body),
    onSuccess: done,
  });
  const publish = useMutation({ mutationFn: publishNotice, onSuccess: done });
  return { create, update, publish };
}
