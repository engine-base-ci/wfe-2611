// 認証の拡張ルート（/api/auth-ext/*・境界 B2 の外側の口）。Better Auth の /api/auth/* に無い「Kaname としての段取り」：
//   登録（会社を作る hook はパッケージ側）・ロック付きログイン・招待の下見と受諾・Bridge の接続コード・資格情報を預ける（関門 C8）
// 契約（08_api）の外なのは、認証の操作が Better Auth の口に属するため（T-F-05）。画面のタスク T-U-01〜05／09／10 が使う
import { Hono } from "hono";
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { acceptInvitation, hashToken } from "@kaname/auth/invitations";
import { createSessionResolver } from "@kaname/auth/resolver";
import { EMAIL_RE, normalizeEmail, signInWithLock, signUp } from "@kaname/auth/signup";
import type { Repository } from "@kaname/db/repository";
import type { SecretsGateway } from "@kaname/secrets";

export interface AuthExtDeps {
  auth: Auth;
  appPool: pg.Pool;
  repo: Repository;
  secrets: SecretsGateway;
}
const bad = (
  c: { json: (b: unknown, s: number) => Response },
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => c.json({ error: code.toLowerCase(), code, message, ...extra }, status);

export function authExt(d: AuthExtDeps): Hono {
  const app = new Hono();
  const resolve = createSessionResolver(d.auth, d.appPool);

  // 登録（T-U-01）：会社名とメール。既存メールは 409（E-CONF-001）。メールは NFKC・空白除去・小文字（表記ゆらぎ）
  app.post("/sign-up", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      company_name?: string;
      name?: string;
    };
    const email = normalizeEmail(String(b.email ?? ""));
    if (!EMAIL_RE.test(email)) return bad(c, 422, "E-VAL-004", "メールアドレスの形式が違います", { field: "email" });
    if (!b.password || b.password.length < 12)
      return bad(c, 422, "E-VAL-005", "パスワードは 12 文字以上にしてください", { field: "password" });
    const company = String(b.company_name ?? "")
      .normalize("NFKC")
      .trim();
    if (!company) return bad(c, 422, "E-VAL-006", "会社名（または屋号）を入れてください", { field: "company_name" });
    try {
      const r = await signUp(d.auth, {
        email,
        password: b.password,
        name: String(b.name ?? company),
        companyName: company,
      });
      return c.json({ data: { token: r.token, user_id: r.userId, email } }, 201);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/already|exists|登録/i.test(msg))
        return bad(
          c,
          409,
          "E-CONF-001",
          "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
        );
      throw e;
    }
  });

  // ログイン（T-U-05）：5 回で 15 分ロック（E-AUTH-001／002）。2 段階なら token 無しで twoFactor=true
  app.post("/sign-in", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = normalizeEmail(String(b.email ?? ""));
    if (!EMAIL_RE.test(email) || !b.password)
      return bad(c, 422, "E-VAL-004", "メールアドレスとパスワードを入れてください");
    const r = await signInWithLock(d.auth, d.appPool, email, b.password, c.req.header("user-agent"));
    if (r.ok) {
      // 2 段階の待ち状態は Better Auth が Cookie で持つ。画面は別 origin・Bearer だけなので、その値を JSON で返し /two-factor/verify で受け取る
      return c.json({
        data: { token: r.token, two_factor: r.twoFactor, two_factor_cookie: r.twoFactor ? r.cookie : null },
      });
    }
    if (r.lockedUntil) {
      const sec = Math.max(1, Math.ceil((r.lockedUntil.getTime() - Date.now()) / 1000));
      return bad(c, 429, "E-AUTH-002", "15 分間ロックしました。急ぐときはメールでロックを解除できます", {
        retry_after_sec: sec,
        remaining: 0,
      });
    }
    return bad(
      c,
      401,
      "E-AUTH-001",
      `メールアドレスかパスワードが違います。あと ${r.remaining} 回で 15 分ロックします`,
      { remaining: r.remaining },
    );
  });

  // 2 段階の確認（T-U-05）：6 桁か回復コード。待ち状態の cookie は sign-in が返したもの
  app.post("/two-factor/verify", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as {
      two_factor_cookie?: string;
      code?: string;
      backup_code?: string;
      trust_device?: boolean;
    };
    if (!b.two_factor_cookie) return bad(c, 401, "E-AUTH-004", "ログインからやり直してください");
    const headers = new Headers({ cookie: b.two_factor_cookie });
    const ua = c.req.header("user-agent");
    if (ua) headers.set("user-agent", ua);
    const api = d.auth.api as unknown as {
      verifyTOTP: (o: {
        headers: Headers;
        body: { code: string; trustDevice?: boolean };
        returnHeaders: true;
      }) => Promise<{ response: { token: string } }>;
      verifyBackupCode: (o: {
        headers: Headers;
        body: { code: string };
        returnHeaders: true;
      }) => Promise<{ response: { token: string } }>;
    };
    try {
      const code = String(b.code ?? b.backup_code ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, "");
      const r = b.backup_code
        ? await api.verifyBackupCode({ headers, body: { code }, returnHeaders: true })
        : await api.verifyTOTP({ headers, body: { code, trustDevice: !!b.trust_device }, returnHeaders: true });
      return c.json({ data: { token: r.response.token } });
    } catch {
      return bad(
        c,
        401,
        "E-AUTH-004",
        b.backup_code
          ? "回復コードが違います。10 個のうち、まだ使っていないものを入れてください"
          : "6 桁が違います。認証アプリの今の数字を入れてください（時刻のずれにも注意）",
      );
    }
  });

  // 招待の下見（T-U-03）：会社名・役割・期限。無効ならその理由
  app.get("/invitations/:token", async (c) => {
    const r = await d.appPool.query<{
      tenant_name: string;
      role_id: string | null;
      email: string;
      expires_at: Date;
      revoked: boolean;
      accepted: boolean;
      expired: boolean;
    }>("select * from app.invitation_preview($1)", [hashToken(c.req.param("token"))]);
    const row = r.rows[0];
    if (!row) return bad(c, 404, "E-INV-001", "この招待は見つかりません。もう一度招待してもらってください");
    return c.json({
      data: {
        tenant_name: row.tenant_name,
        role_id: row.role_id ?? "member",
        email: row.email,
        expires_at: row.expires_at,
        valid: !(row.revoked || row.accepted || row.expired),
        reason: row.revoked ? "revoked" : row.accepted ? "accepted" : row.expired ? "expired" : null,
      },
    });
  });
  // 招待を受ける（T-U-03）：名前とパスワードだけ。メールは招待のもの。登録 → メンバーを作り層を結ぶ（app.accept_invitation）
  app.post("/invitations/:token/accept", async (c) => {
    const token = c.req.param("token");
    const b = (await c.req.json().catch(() => ({}))) as { name?: string; password?: string };
    const name = String(b.name ?? "")
      .normalize("NFKC")
      .trim();
    if (!name) return bad(c, 422, "E-VAL-007", "お名前を入れてください", { field: "name" });
    if (!b.password || b.password.length < 12)
      return bad(c, 422, "E-VAL-005", "パスワードは 12 文字以上にしてください", { field: "password" });
    const pv = await d.appPool.query<{ email: string; revoked: boolean; accepted: boolean; expired: boolean }>(
      "select email, revoked, accepted, expired from app.invitation_preview($1)",
      [hashToken(token)],
    );
    const inv = pv.rows[0];
    if (!inv || inv.revoked || inv.accepted || inv.expired)
      return bad(
        c,
        410,
        "E-INV-002",
        "この招待は取り消されています。招待した人が取り消したか、7 日の期限を過ぎました。もう一度招待してもらってください",
      );
    const u = await signUp(d.auth, { email: inv.email, password: b.password, name });
    const memberId = await acceptInvitation(d.appPool, token, u.userId, name);
    return c.json({ data: { token: u.token, member_id: memberId } }, 201);
  });

  // Bridge の接続コード（T-U-09）：ログイン済みの会員だけ。10 分で失効。Bridge 側の claim は T-I-*
  app.post("/bridge/pair", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ code: string }>("select app.bridge_pair_new($1, $2) as code", [
      s.ctx.tenantId,
      s.ctx.userId,
    ]);
    return c.json({ data: { code: r.rows[0]!.code, expires_in_sec: 600 } }, 201);
  });

  // 資格情報を預ける（T-U-10・関門 C8）：平文はここで暗号化して vault へ。表（credentials）には参照 ID だけ。AI には渡らない
  app.post("/vault/credentials", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as {
      service_name?: string;
      service_id?: string;
      kind_id?: string;
      login?: string;
      password?: string;
      totp_secret?: string;
    };
    const login = String(b.login ?? "")
      .normalize("NFKC")
      .trim();
    if (!login || !b.password) return bad(c, 422, "E-VAL-008", "ログイン名とパスワードを入れてください");
    const kind = b.kind_id ?? (b.totp_secret ? "password_totp" : "basic");
    const stored = await d.secrets.store(
      s.ctx,
      kind,
      JSON.stringify({ login, password: b.password, totp_secret: b.totp_secret?.replace(/\s+/g, "") || null }),
    );
    if (stored.status !== "done")
      return bad(c, 502, "E-SEC-001", "預かり先に保管できませんでした。もう一度試してください", {
        handoff: "reason" in stored ? stored.reason : null,
      });
    const ref = typeof stored.value === "string" ? stored.value : stored.value.ref;
    const me = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    const row = await d.repo.table("credentials").create(s.ctx, {
      service_id: b.service_id ?? null,
      kind_id: kind,
      vault_ref: ref,
      owner_member_id: s.ctx.userId,
      scope_id: me?.["scope_id"] ?? null,
    });
    return c.json({ data: { id: row["id"], vault_ref: ref, service_name: b.service_name ?? null } }, 201);
  });
  return app;
}
