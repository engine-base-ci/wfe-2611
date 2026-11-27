"use client";
// ゲストの場所のホームの読み（K-911）。getPortalHome（GET /api/v1/portal）と listPortalNotices（GET /api/v1/portal/notices）を同時に 1 回ずつ。
//   ホームの読みは外枠（portal-shell）とホーム（home-page）が同じ問い合わせの鍵を共有する（同じ住所を 2 回呼ばない・StrictMode でも）。
//   401 は入り直しへ自動では移さない（期限切れの形を出し、本人が「入り直す」を押す・keepOn401）。読みで first_visit が済みになるので押し直しはしない（retry: false）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";

/** 画面が読む答えの形（11_tickets/K-911.md「読む答えの形」・口は K-906） */
export interface PortalHomeData {
  group_name: string;
  tenant_name: string;
  request_scope_name?: string;
  me: { name: string; initial: string };
  first_visit: boolean;
  requests: { id: string; title: string; from_name: string; created_at: string; badge: string }[];
  tickets: { id: string; title: string; stage: string; from_request?: boolean }[];
}
export interface PortalNotice {
  id: string;
  title: string;
  body: string;
}

export type PortalRead<T> = { ok: true; data: T } | { ok: false; err: CallErr };

const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
export const PORTAL_HOME_KEY = ["portal", "home"] as const;
const PORTAL_NOTICES_KEY = ["portal", "notices"] as const;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

/** 口の答えを画面の形に直す（知らない値は空にする。答えを信じすぎない） */
export function toHome(raw: unknown): PortalHomeData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const me = (d["me"] && typeof d["me"] === "object" ? d["me"] : {}) as Record<string, unknown>;
  const scope = str(d["request_scope_name"]);
  return {
    group_name: str(d["group_name"]),
    tenant_name: str(d["tenant_name"]),
    ...(scope ? { request_scope_name: scope } : {}),
    me: { name: str(me["name"]), initial: str(me["initial"]) },
    first_visit: d["first_visit"] === true,
    requests: arr(d["requests"]).map((r) => ({
      id: str(r["id"]),
      title: str(r["title"]),
      from_name: str(r["from_name"]),
      created_at: str(r["created_at"]),
      badge: str(r["badge"]),
    })),
    tickets: arr(d["tickets"]).map((t) => ({
      id: str(t["id"]),
      title: str(t["title"]),
      stage: str(t["stage"]),
      ...(t["from_request"] === true ? { from_request: true } : {}),
    })),
  };
}

async function readHome(): Promise<PortalRead<PortalHomeData>> {
  const r = await call("getPortalHome", { keepOn401: true, screenId: "portal" });
  return r.ok ? { ok: true, data: toHome(r.data) } : { ok: false, err: r };
}
async function readNotices(): Promise<PortalNotice[]> {
  const r = await call("listPortalNotices", { keepOn401: true, screenId: "portal" });
  if (!r.ok) return []; // お知らせだけ出ない（ホームは出す）
  return arr(r.data)
    .map((n) => ({ id: str(n["id"]), title: str(n["title"]), body: str(n["body"]) }))
    .filter((n) => n.title !== "");
}

/** ホームの読み（外枠とホームが共有する 1 つの鍵） */
export const usePortalHome = () => useQuery({ queryKey: PORTAL_HOME_KEY, queryFn: readHome, ...ONCE });
/** お知らせ（ホームだけが読む） */
export const usePortalNotices = (enabled = true) =>
  useQuery({ queryKey: PORTAL_NOTICES_KEY, queryFn: readNotices, enabled, ...ONCE });
