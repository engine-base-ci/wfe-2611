// 画面の L1 を実データで流す土台：API（apps/api・3011）と DB（管理者）を直接使って前提を作る。QA が作ったデータだけを触る（G-10）
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Page } from "@playwright/test";

export const API = process.env["API_BASE"] ?? "http://127.0.0.1:3011";
const ADMIN = process.env["DATABASE_URL_ADMIN"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
export const PW = "correct-horse-battery-1";
// 宛先は「送出先が本当に受け取れるもの」にする。example.com は送出先に拒否され、
// 「本当に送られたか」の行が検証できない（拒否を握り潰していた間だけ緑に見えていた）。
// QA_MAIL_TO で環境ごとに変えられる（<uniq> がその回の一意な文字に置き換わる）。
const MAIL_TO = process.env["QA_MAIL_TO"] ?? "delivered+<uniq>@resend.dev";
export const uniqEmail = () =>
  MAIL_TO.replace("<uniq>", `qa-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5)}`);

export async function api<T>(
  path: string,
  body?: unknown,
  token?: string,
  method = body === undefined ? "GET" : "POST",
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
}
/** 会社ごと登録して token を返す（画面の前提） */
export async function signupViaApi(company = "QA 社") {
  const email = uniqEmail();
  const r = await api<{ data: { token: string; user_id: string } }>("/api/auth-ext/sign-up", {
    email,
    password: PW,
    company_name: company,
  });
  if (r.status !== 201) throw new Error(`sign-up ${r.status} ${JSON.stringify(r.json)}`);
  const c = new pg.Client({ connectionString: ADMIN });
  await c.connect();
  const m = await c.query<{ id: string; tenant_id: string; scope_id: string }>(
    "select id, tenant_id, scope_id from members where auth_user_id = $1",
    [r.json.data.user_id],
  );
  await c.end();
  return {
    email,
    token: r.json.data.token,
    userId: r.json.data.user_id,
    memberId: m.rows[0]!.id,
    tenantId: m.rows[0]!.tenant_id,
    scopeId: m.rows[0]!.scope_id,
  };
}
/** ブラウザにトークンを持たせる（画面は localStorage の kaname.token を Bearer に載せる） */
export async function loginAs(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), token);
}
export async function admin<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: ADMIN });
  await c.connect();
  try {
    return (await c.query<T>(sql, params)).rows;
  } finally {
    await c.end();
  }
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** TOTP（RFC 6238・SHA1・30 秒・6 桁）。認証アプリの代わり */
export function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[h.length - 1]! & 0xf;
  const code =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}
/** メールのリンク：開発では API がログに URL を出す（Resend の鍵が無いとき）。KANAME_API_LOG が無ければ null */
export function lastMailUrl(kind: "verify" | "reset", email: string): string | null {
  const p = process.env["KANAME_API_LOG"];
  if (!p) return null;
  const lines = readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.includes(`（${kind} → ${email}）`)); // 「送出先が無い」でも「リンク」でも拾う
  const last = lines[lines.length - 1];
  const m = last ? /: (https?:\S+)/.exec(last) : null;
  return m ? m[1]! : null;
}
export const WIDTHS = [375, 768, 1024, 1440] as const;
export async function noOverflow(page: Page, path: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto(path);
    if (!res || res.status() >= 400) throw new Error(`${path} が ${res?.status()}`);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) throw new Error(`${path} 幅 ${width} で ${o}px 溢れ`);
  }
}
/** Bridge の行を前提として置く（claim の実体は T-I-02。画面は sessions の行で「つながった」を判定する） */
export const bridgeRow = (u: { tenantId: string; memberId: string }) =>
  admin(
    "insert into sessions (tenant_id, member_id, kind_id, device_label, auth_session_id) values ($1, $2, 'bridge', 'MacBook Pro（QA）', $3)",
    [u.tenantId, u.memberId, `qa-${Date.now()}`],
  );

/** 閲覧のみ（R4）で参加した人。招待を作って受ける（権限で見えない画面の検査に使う） */
export async function viewerViaApi() {
  const { randomBytes } = await import("node:crypto");
  const boss = await signupViaApi("招く会社");
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'viewer', $3, now() + interval '7 days', $4)",
    [boss.tenantId, email, sha256(token), boss.memberId],
  );
  const r = await api<{ data: { token: string } }>(`/api/auth-ext/invitations/${token}/accept`, {
    name: "閲覧のみ QA",
    password: PW,
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`accept ${r.status} ${JSON.stringify(r.json)}`);
  return { ...boss, token: r.json.data.token, email };
}

/** API のログから、そのアドレス宛の送信の記録を読む（[mail] 送った／送れなかった） */
export function mailLog(email: string): { sent: string; failed: string } {
  const p = process.env["KANAME_API_LOG"];
  if (!p) return { sent: "", failed: "" };
  const lines = readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.includes(email));
  return {
    sent: lines.filter((l) => l.includes("[mail] 送った")).pop() ?? "",
    failed: lines.filter((l) => l.includes("[mail] 送れなかった")).pop() ?? "",
  };
}
