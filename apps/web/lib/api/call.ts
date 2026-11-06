// 新しい画面の API の呼び手（K-27・D-043.3・D-128.113）。口の名前（operationId）で呼び、型は契約から生成した Ops（手で書かない）。
//   画面は契約の口だけを叩く（G39）。道すじ・メソッドは ENDPOINTS から引く（文字列で道すじを書かない）
//   答えの扱いはどの画面でも同じ：401 は入り直し（入力途中は残す）・403 は権限が無い・404 は無い・422 は項目ごとの理由・429 は待つ秒数・501 はまだ作っていない口
import { ENDPOINTS, type Ops, type OpName } from "@kaname/contracts";
import { apiBase, getToken, notifyUnauthorized } from "./client";
import { noticeTermsRequired } from "@/lib/terms-gate";

export type CallArgs<K extends OpName> = ([Ops[K]["params"]] extends [never]
  ? { params?: undefined }
  : { params: Ops[K]["params"] }) &
  ([Ops[K]["query"]] extends [never] ? { query?: undefined } : { query?: Ops[K]["query"] }) &
  ([Ops[K]["body"]] extends [never] ? { body?: undefined } : { body?: Ops[K]["body"] }) & {
    /** 書き込みの冪等キー（同じ操作の押し直しは最初の結果が返る）。無ければ毎回作る */
    idempotencyKey?: string;
    /** どの画面から呼んだか（記録とエラーの知らせに出る） */
    screenId?: string;
    signal?: AbortSignal;
    /** 口が頭で受ける値（例：登録の申し込みの印 x-signup-token・K-51）。契約の parameters の in: header */
    headers?: Record<string, string>;
    /** 401 でも入り直しへ送らない（ログインしていない画面が「今ログインしているか」を確かめるとき・K-51） */
    keepOn401?: boolean;
  };
export interface CallOk<K extends OpName> {
  ok: true;
  status: number;
  data: Ops[K]["data"];
  meta: { cursor?: string; limit?: number; total?: number } & Record<string, unknown>;
}
export type CallErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "step_up"
  | "not_found"
  | "invalid"
  | "conflict"
  | "rate_limited"
  | "not_built"
  | "failed";
export interface CallErr {
  ok: false;
  status: number;
  kind: CallErrorKind;
  code: string;
  message: string | null;
  /** 422 の項目ごとの理由（field → message） */
  fields: Record<string, string>;
  /** 429 のとき、何秒待てばよいか */
  retryAfterSec: number | null;
}
export type CallResult<K extends OpName> = CallOk<K> | CallErr;

const BY_OP = new Map(ENDPOINTS.map((e) => [e.operationId, e]));
const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function kindOf(status: number, code: string): CallErrorKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return code === "STEP_UP_REQUIRED" ? "step_up" : "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "invalid";
  if (status === 429) return "rate_limited";
  if (status === 501) return "not_built";
  return "failed";
}

/** 道すじを作る（:id などを値で埋める。値は URL の形に直す） */
export function pathOf(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/:([a-z_]+)/gi, (_, n: string) => {
    const v = params?.[n];
    if (v === undefined || v === "") throw new Error(`道すじの値が無い: ${n}`);
    return encodeURIComponent(v);
  });
}

export async function call<K extends OpName>(op: K, args: CallArgs<K> = {} as CallArgs<K>): Promise<CallResult<K>> {
  const e = BY_OP.get(op);
  if (!e) throw new Error(`契約に無い口: ${String(op)}`);
  const q = Object.entries((args.query ?? {}) as Record<string, string | number | undefined>)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const write = e.method !== "GET";
  const headers: Record<string, string> = { accept: "application/json", ...(args.headers ?? {}) };
  const token = getToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (args.screenId) headers["x-screen-id"] = args.screenId;
  if (write) {
    headers["content-type"] = "application/json";
    headers["idempotency-key"] = args.idempotencyKey ?? newKey();
  }
  const sentAt = Date.now(); // 同意し直し（K-53）：同意できた時刻より前に出した要求の 403 は見ない
  const res = await fetch(
    `${apiBase()}${pathOf(e.path, args.params as Record<string, string> | undefined)}${q ? `?${q}` : ""}`,
    {
      method: e.method,
      headers,
      ...(write ? { body: JSON.stringify(args.body ?? {}) } : {}),
      ...(args.signal ? { signal: args.signal } : {}),
    },
  );
  if (res.status === 401 && !args.keepOn401) notifyUnauthorized();
  const json = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      data: json["data"] as Ops[K]["data"],
      meta: (json["meta"] ?? {}) as CallOk<K>["meta"],
    };
  }
  const code = String(json["code"] ?? json["error"] ?? res.status);
  // 同意し直しが要る（K-53）：どの画面からでも同意し直しの画面へ移す
  noticeTermsRequired(res.status, json["code"], json["message"], sentAt);
  const details = Array.isArray(json["details"]) ? (json["details"] as { field?: string; message?: string }[]) : [];
  // 正本のエラー（KanameError）は項目を detail.field で返す。文言は正本の message（K-51）
  const one = json["detail"] as { field?: unknown } | undefined;
  if (one && typeof one.field === "string" && typeof json["message"] === "string")
    details.push({ field: one.field, message: json["message"] });
  return {
    ok: false,
    status: res.status,
    kind: kindOf(res.status, code),
    code,
    message: typeof json["message"] === "string" ? json["message"] : null,
    fields: Object.fromEntries(details.filter((d) => d.field).map((d) => [d.field!, d.message ?? ""])),
    retryAfterSec: typeof json["retry_after_sec"] === "number" ? json["retry_after_sec"] : null,
  };
}
