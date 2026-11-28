// 運営のお知らせの口（listOpsNotices・getOpsNotice・addIncidentUpdate・K-980）を読む・書く。
//   顧客の画面の共通の口（lib/api/call.ts）は通さない：あちらは 401 で顧客のログインへ、403 で顧客の同意し直し・安全の画面へ移す
//   （運営の場所はどちらにも乗らない・D-128.172・ops-shell-api.ts と同じ）。生の fetch は関門 C1 の決まりで apps/web/lib の中だけに置く
import { apiBase, getToken } from "@/lib/api/client";

export const OPS_NOTICES_PATH = "/api/v1/ops/notices";

/** 口の結果：読めた・書けた（data は形を頁が確かめる）／入り直し／それ以外の失敗（status 0 は網が切れた） */
export type OpsNoticeResult =
  { kind: "ok"; data: unknown } | { kind: "login" } | { kind: "failed"; status: number; code: string };

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

async function send(method: "GET" | "POST", path: string, body?: unknown): Promise<OpsNoticeResult> {
  const token = getToken();
  const headers: Record<string, string> = {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  if (method === "POST") {
    headers["content-type"] = "application/json";
    headers["idempotency-key"] = newKey();
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers,
      credentials: "omit",
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch {
    return { kind: "failed", status: 0, code: "" }; // 網が切れた
  }
  const json = obj(await res.json().catch(() => null));
  if (res.ok) return { kind: "ok", data: json?.["data"] };
  const c = json?.["code"] ?? json?.["error"];
  const code = typeof c === "string" ? c : "";
  if (res.status === 401 || (res.status === 403 && code === "FORBIDDEN")) return { kind: "login" };
  return { kind: "failed", status: res.status, code };
}

/** 一覧（search は「?kind=…」「?state=draft」か空） */
export const fetchOpsNotices = (search: string): Promise<OpsNoticeResult> =>
  send("GET", `${OPS_NOTICES_PATH}${search}`);

/** 1 件 */
export const fetchOpsNotice = (id: string): Promise<OpsNoticeResult> =>
  send("GET", `${OPS_NOTICES_PATH}/${encodeURIComponent(id)}`);

/** 障害の続報を足す（直ったにするも同じ口） */
export const postIncidentUpdate = (id: string, body: { state: string; body: string }): Promise<OpsNoticeResult> =>
  send("POST", `${OPS_NOTICES_PATH}/${encodeURIComponent(id)}/updates`, body);
