// API クライアント（T-US-03）。画面は API を叩くだけ（D-043.2・D-051.1）。認証はトークン（Bearer・D-051.2）。
// 401 は「入り直し」に落とす。入力途中の内容は draft（sessionStorage）に残して失わない
import type { ApiError, ApiResponse } from "@kaname/contracts";
import { WEB_ENV } from "@/lib/env";
import { noticeTermsRequired } from "@/lib/terms-gate";
import { ENDPOINTS, type EndpointDef, type EndpointKind } from "@kaname/contracts";

export const apiBase = (): string => WEB_ENV.apiBase;
const TOKEN_KEY = "kaname.token";
export const getToken = (): string | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null): void => {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode 等。メモリだけで続ける */
  }
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message ?? body.error ?? `HTTP ${status}`);
  }
  get code(): string {
    return this.body.code ?? this.body.error ?? String(this.status);
  }
}

/** 401 のときに呼ばれる（入り直しへ）。Provider が差し込む */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null): void => {
  onUnauthorized = fn;
};
/** 「入っていない」と分かった（API が 401）。手元の鍵を捨てて入り直しへ（auth-ext の口も同じ扱い・D-086.4） */
export const notifyUnauthorized = (): void => {
  setToken(null);
  onUnauthorized?.();
};

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  /** 書き込みは冪等キーを必ず付ける（二重送信は最初の結果の再送になる：op.ts） */
  idempotencyKey?: string;
  screenId?: string;
}
const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
  const qs = o.query
    ? "?" +
      Object.entries(o.query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const headers: Record<string, string> = { accept: "application/json", ...(o.headers ?? {}) };
  const token = getToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (o.screenId) headers["x-screen-id"] = o.screenId;
  const write = method !== "GET" && method !== "HEAD";
  if (write) {
    headers["content-type"] = "application/json";
    headers["idempotency-key"] = o.idempotencyKey ?? uuid();
  }
  const sentAt = Date.now(); // 同意し直し（K-53）：同意できた時刻より前に出した要求の 403 は見ない
  const res = await fetch(`${apiBase()}${path}${qs}`, {
    method,
    headers,
    ...(write ? { body: JSON.stringify(o.body ?? {}) } : {}),
  });
  if (res.status === 401) {
    notifyUnauthorized();
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({ error: "bad_response" }))) as unknown;
  if (!res.ok) {
    const b = json as ApiError;
    noticeTermsRequired(res.status, b.code, b.message, sentAt); // 同意し直しが要る（K-53）
    throw new ApiRequestError(res.status, b);
  }
  return json as T;
}

export const endpointOf = (table: string, kind: EndpointKind): EndpointDef | undefined =>
  ENDPOINTS.find((e) => e.table === table && e.kind === kind);

/** 表ごとの一覧／1 件／作成／更新／削除。契約（registry）に無い組は呼べない */
export const api = {
  list: <T>(table: string, query?: RequestOptions["query"], screenId?: string) => {
    const e = endpointOf(table, "list");
    if (!e) throw new Error(`契約に一覧が無い: ${table}`);
    return request<ApiResponse<T[]>>("GET", e.path, { ...(query ? { query } : {}), ...(screenId ? { screenId } : {}) });
  },
  get: <T>(table: string, id: string, screenId?: string) => {
    const e = endpointOf(table, "get");
    if (!e) throw new Error(`契約に 1 件取得が無い: ${table}`);
    return request<ApiResponse<T>>("GET", e.path.replace(":id", id), screenId ? { screenId } : {});
  },
  create: <T>(table: string, body: unknown, screenId?: string) => {
    const e = endpointOf(table, "create");
    if (!e) throw new Error(`契約に作成が無い: ${table}`);
    return request<ApiResponse<T>>("POST", e.path, { body, ...(screenId ? { screenId } : {}) });
  },
  update: <T>(table: string, id: string, body: unknown, screenId?: string) => {
    const e = endpointOf(table, "update");
    if (!e) throw new Error(`契約に更新が無い: ${table}`);
    return request<ApiResponse<T>>("PATCH", e.path.replace(":id", id), { body, ...(screenId ? { screenId } : {}) });
  },
  remove: (table: string, id: string, screenId?: string) => {
    const e = endpointOf(table, "delete");
    if (!e) throw new Error(`契約に削除が無い: ${table}`);
    return request<void>("DELETE", e.path.replace(":id", id), screenId ? { screenId } : {});
  },
};

/** 入力途中の内容を残す（401 で入り直しても失わない：D-051） */
const DRAFT = "kaname.draft:";
export const saveDraft = (key: string, data: unknown): void => {
  try {
    window.sessionStorage.setItem(DRAFT + key, JSON.stringify(data));
  } catch {
    /* 保存できないときは黙って続ける（入力はまだ画面にある） */
  }
};
export const takeDraft = <T>(key: string): T | null => {
  try {
    const v = window.sessionStorage.getItem(DRAFT + key);
    if (v === null) return null;
    window.sessionStorage.removeItem(DRAFT + key);
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};
