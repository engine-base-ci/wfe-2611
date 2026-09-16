// /api/auth-ext（Kaname としての認証の段取り）を画面から呼ぶ。エラーは正本の形（code・message・一手）
import { apiBase, getToken, setToken } from "@/lib/api/client";

export interface ExtError {
  status: number;
  code: string;
  message: string;
  field?: string;
  remaining?: number;
  retry_after_sec?: number;
}
export class AuthExtError extends Error implements ExtError {
  status: number;
  code: string;
  field?: string;
  remaining?: number;
  retry_after_sec?: number;
  constructor(e: ExtError) {
    super(e.message);
    this.status = e.status;
    this.code = e.code;
    if (e.field) this.field = e.field;
    if (e.remaining !== undefined) this.remaining = e.remaining;
    if (e.retry_after_sec !== undefined) this.retry_after_sec = e.retry_after_sec;
  }
}
export async function ext<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const t = getToken();
  if (t) headers["authorization"] = `Bearer ${t}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${apiBase()}/api/auth-ext${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    code?: string;
    message?: string;
    field?: string;
    remaining?: number;
    retry_after_sec?: number;
  };
  if (!res.ok)
    throw new AuthExtError({
      status: res.status,
      code: json.code ?? String(res.status),
      message: json.message ?? "うまくいきませんでした。もう一度試してください",
      ...(json.field ? { field: json.field } : {}),
      ...(json.remaining !== undefined ? { remaining: json.remaining } : {}),
      ...(json.retry_after_sec !== undefined ? { retry_after_sec: json.retry_after_sec } : {}),
    });
  return json.data as T;
}
export const signUp = (b: { email: string; password: string; company_name: string }) =>
  ext<{ token: string | null; user_id: string; email: string }>("/sign-up", b).then(
    (r) => (r.token && setToken(r.token), r),
  );
export const signIn = (b: { email: string; password: string }) =>
  ext<{ token: string | null; two_factor: boolean; two_factor_cookie: string | null }>("/sign-in", b).then(
    (r) => (r.token && setToken(r.token), r),
  );
export const verifyTwoFactor = (b: {
  two_factor_cookie: string;
  code?: string;
  backup_code?: string;
  trust_device?: boolean;
}) => ext<{ token: string }>("/two-factor/verify", b).then((r) => (setToken(r.token), r));
export const invitationPreview = (token: string) =>
  ext<{
    tenant_name: string;
    role_id: string;
    email: string;
    expires_at: string;
    valid: boolean;
    reason: string | null;
  }>(`/invitations/${encodeURIComponent(token)}`, undefined, "GET");
export const acceptInvitation = (token: string, b: { name: string; password: string }) =>
  ext<{ token: string | null; member_id: string }>(`/invitations/${encodeURIComponent(token)}/accept`, b).then(
    (r) => (r.token && setToken(r.token), r),
  );
export const bridgePair = () => ext<{ code: string; expires_in_sec: number }>("/bridge/pair", {});
export const storeCredential = (b: { service_name: string; login: string; password: string; totp_secret?: string }) =>
  ext<{ id: string; vault_ref: string; service_name: string | null }>("/vault/credentials", b);
