// 認証の拡張ルート（/api/auth-ext/*・境界 B2 の外側の口）。Better Auth の /api/auth/* に無い「Kaname としての段取り」：
//   登録（会社を作る hook はパッケージ側）・ロック付きログイン・招待の下見と受諾・Bridge の接続コード・資格情報を預ける（関門 C8）
// 契約（08_api）の外なのは、認証の操作が Better Auth の口に属するため（T-F-05）。画面のタスク T-U-01〜05／09／10 が使う
import { agentToolRoutes, issueToolToken } from "./agent-tools.js";
import { AGENT_CONVENTIONS, BROWSER_CHECK_PROMPT, BROWSERS, ONBOARD_REMEMBER, type Browser } from "./conventions.js";
import { isListed, legacyInstaller, pickInstaller, pickUpdate, readManifest, releaseFileResponse } from "./bridge-release.js";
import { Hono } from "hono";
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { acceptInvitation, hashToken } from "@kaname/auth/invitations";
import { createSessionResolver, signOut } from "@kaname/auth/resolver";
import { EMAIL_RE, normalizeEmail, signInWithLock, signUp } from "@kaname/auth/signup";
import { sendPendingVerification } from "@kaname/auth";
import { classifyMailError } from "@kaname/notify/resend";
import {
  consumePending,
  getPendingByEmail,
  markPendingSent,
  putPending,
  takePendingByToken,
} from "@kaname/auth/pending";
import type { Repository } from "@kaname/db/repository";
import { withTenant } from "@kaname/db/context";
import type { SecretsGateway } from "@kaname/secrets";
import type { ObjectStore } from "@kaname/storage";
import { agentRoutes, jobOptions } from "./agent.js";
import { agentStreamRoutes } from "./agent-stream.js";
import type { MemberHub } from "@kaname/db/listen";
import { parseDigest, takeRemember } from "./memory.js";

export interface AuthExtDeps {
  auth: Auth;
  appPool: pg.Pool;
  authPool: pg.Pool;
  repo: Repository;
  secrets: SecretsGateway;
  /** 資料の置き場（関門 C4）。無ければ資料は付けられない（E-CHAT-002） */
  objects?: ObjectStore;
  config: {
    secretsMasterKey: string;
    baseUrl: string;
    webBaseUrl: string | null;
    opsEmail: string;
    env: "development" | "staging" | "production" | "test";
    /** Bridge の配布物の置き場（Kaname のサーバー）。空なら「まだ配布していません」 */
    bridgeReleaseBase?: string;
    /** 手元のフォルダから配る（署名と置き場が決まる前の橋渡し） */
    bridgeReleaseDir?: string;
  };
  mailer?: (m: { to: string; subject: string; text: string; url: string; kind: "verify" | "reset" }) => Promise<void>;
  /** 会話が変わった知らせ（D-113）。無ければ /agent/stream は 503 で、画面は見に行く形のまま */
  hub?: MemberHub | null;
}
/** 届かなかった答えを、自分のAI への指示に添える文にする（問い：答え）。無ければ空 */
export function carriedAnswers(v: unknown): string {
  const list = Array.isArray(v) ? (v as { tool?: string; questions?: { question?: string }[]; answers?: Record<string, string>; allow?: boolean; note?: string | null }[]) : [];
  const lines: string[] = [];
  for (const a of list) {
    if (a.tool === "AskUserQuestion" || (a.answers && Object.keys(a.answers).length)) {
      const qs = (a.questions ?? []).map((q) => String(q.question ?? "")).filter(Boolean);
      const ans = a.answers ?? {};
      for (const q of qs.length ? qs : Object.keys(ans)) lines.push(`- ${q}：${ans[q] ?? "（答えなし）"}`);
    } else if (a.tool) {
      lines.push(`- ${a.tool} の実行：${a.allow ? "許可した" : "許可しなかった"}`);
    }
    if (a.note) lines.push(`  （一言：${String(a.note).slice(0, 400)}）`);
  }
  if (!lines.length) return "";
  return `（前に出した問い合わせに、本人はもう答えています。途中で止まってあなたに届いていなかったので、ここで渡します。同じことを聞き直さず、これを踏まえて続けてください）\n${lines.join("\n")}`;
}
const bad = (
  c: { json: (b: unknown, s: number) => Response },
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) => c.json({ error: code.toLowerCase(), code, message, ...extra }, status);

/** 入れた文字（サービス名か URL）から宛先のドメインを取る。取れなければ null */
export function hostOf(v: string): string | null {
  const m = /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9-])/i.exec(v.trim());
  return m ? m[1]!.toLowerCase() : null;
}
/** この版より古い Bridge には仕事を渡さない（apps/bridge/src/loop.ts の BRIDGE_PROTOCOL と揃える） */
export const BRIDGE_PROTOCOL_MIN = 4;
/** 古い Bridge のとき、自己診断に足す 1 行（画面は fix=update を見て入れ直しを案内する） */
const OUTDATED_CHECK = {
  name: "Bridge が新しい",
  ok: false,
  detail: "この PC の Bridge が古いので、自分のAI に仕事を渡せません。Bridge を入れ直してください",
  fix: "update",
};
export function authExt(d: AuthExtDeps): Hono {
  const app = new Hono();
  const resolve = createSessionResolver(d.auth, d.appPool);

  // 登録（T-U-01・D-088）：**ここでは何も作らない**。保留の申し込みを 1 行置いて、確認のリンクを送るだけ。
  // 利用者・会社・層・代表・自分のAI は、リンクを押した時点（/verify-signup）で作る。
  // 送れたかどうかを返す。送れていないのに画面が「送りました」と言わないため（D-088.5・G-15）
  const already = async (email: string) =>
    (await d.authPool.query('select 1 from kaname_auth."user" where email = $1', [email])).rowCount ?? 0;
  const sendPending = async (email: string, token: string) => {
    const r = await sendPendingVerification(
      {
        ...(d.mailer ? { mailer: d.mailer } : {}),
        baseURL: d.config.baseUrl,
        ...(d.config.webBaseUrl ? { webBaseURL: d.config.webBaseUrl } : {}),
      },
      { email, token },
    );
    await markPendingSent(d.authPool, email, r.error);
    return { ...r, kind: r.error ? classifyMailError(r.error) : null };
  };
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
    // 既に登録が済んでいる人だけ 409。確認していない人は何度来てもやり直せる（D-088.3）
    if (await already(email))
      return bad(
        c,
        409,
        "E-CONF-001",
        "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
      );
    const { token } = await putPending(d.authPool, d.config.secretsMasterKey, {
      email,
      name: String(b.name ?? company),
      companyName: company,
      password: b.password,
    });
    const r = await sendPending(email, token);
    return c.json({ data: { email, sent: r.sent, mail_error: r.error, mail_error_kind: r.kind } }, 201);
  });

  // この申し込みがいまどうなっているか（T-U-02・D-088.3）。待つ画面が「ずっと待つだけ」にならないように、
  // 開いた時点で 登録済み／まだ有効／もう無い を返し、画面が行き先を変える。
  // 登録の有無は sign-up が 409 で既に返すので、ここで新たに漏れるものは無い
  app.get("/signup-status", async (c) => {
    const email = normalizeEmail(String(c.req.query("email") ?? ""));
    if (!EMAIL_RE.test(email)) return bad(c, 422, "E-VAL-004", "メールアドレスの形式が違います", { field: "email" });
    if (await already(email)) return c.json({ data: { state: "registered", expires_at: null } });
    const p = await getPendingByEmail(d.authPool, email);
    return c.json({
      data: p ? { state: "pending", expires_at: p.expiresAt } : { state: "none", expires_at: null },
    });
  });

  // 確認のリンクを送り直す（T-U-02）。保留が無ければ「送った」と嘘をつかず、登録の有無も漏らさない
  app.post("/resend-signup", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = normalizeEmail(String(b.email ?? ""));
    if (!EMAIL_RE.test(email)) return bad(c, 422, "E-VAL-004", "メールアドレスの形式が違います", { field: "email" });
    const p = await getPendingByEmail(d.authPool, email, d.config.secretsMasterKey);
    // 確認まで終わった人が戻ってきて押した（D-088.9）。「残っていません」ではなく「終わっています」と言う
    if (!p && (await already(email))) return c.json({ data: { email, sent: false, mail_error: null, pending: false, registered: true } }, 200);
    if (!p) return c.json({ data: { email, sent: false, mail_error: null, pending: false, registered: false } }, 200);
    const { token } = await putPending(d.authPool, d.config.secretsMasterKey, {
      email,
      name: p.name,
      companyName: p.companyName,
      password: p.password,
    });
    const r = await sendPending(email, token);
    return c.json({ data: { email, sent: r.sent, mail_error: r.error, mail_error_kind: r.kind, pending: true } }, 200);
  });

  // 確認（T-U-02・D-088.2）：ここで初めて 利用者・会社・層・代表・自分のAI ができ、そのままログインする
  app.post("/verify-signup", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { token?: string };
    const token = String(b.token ?? "");
    if (!token) return bad(c, 422, "E-VAL-004", "リンクが正しくありません");
    const found = await takePendingByToken(d.authPool, d.config.secretsMasterKey, token);
    // もう確認した人（二度押し・リロード）は詰まらせず、入る画面へ送る
    if (found.kind === "done")
      return bad(c, 409, "E-CONF-011", "このメールアドレスの登録は確認まで終わっています。ログインしてください");
    if (found.kind === "gone")
      return bad(c, 410, "E-AUTH-003", "このリンクは期限が切れています。新しい確認メールを送ります", {
        expired: true,
      });
    const p = found.pending;
    if (await already(p.email)) {
      await consumePending(d.authPool, p.email);
      return bad(
        c,
        409,
        "E-CONF-001",
        "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
      );
    }
    const r = await signUp(d.auth, {
      email: p.email,
      password: p.password,
      name: p.name,
      companyName: p.companyName,
    });
    // 確認を経て作ったので、この時点で確認済み
    await d.authPool.query('update kaname_auth."user" set "emailVerified" = true where id = $1', [r.userId]);
    await consumePending(d.authPool, p.email);
    return c.json({ data: { token: r.token, user_id: r.userId, email: p.email } }, 201);
  });

  // ログイン（T-U-05）：5 回で 15 分ロック（E-AUTH-001／002）。2 段階なら token 無しで twoFactor=true
  app.post("/sign-in", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = normalizeEmail(String(b.email ?? ""));
    if (!EMAIL_RE.test(email) || !b.password)
      return bad(c, 422, "E-VAL-004", "メールアドレスとパスワードを入れてください");
    const r = await signInWithLock(d.auth, d.appPool, email, b.password, c.req.header("user-agent"));
    if (r.ok && !r.twoFactor && r.token) {
      // 入れたのに会社の人（member）が無い（会社が消えた・登録の途中で壊れた）。ログインだけ通して先で空白にしない（E-AUTH-007）。
      // その場で閉じ、理由と次の一手を返す
      const h = new Headers({ authorization: `Bearer ${r.token}` });
      if (!(await resolve(h))) {
        await signOut(d.auth, d.appPool, h).catch(() => undefined);
        return bad(
          c,
          403,
          "E-AUTH-007",
          "このアカウントは、会社の登録が見つからないため使えません。もう一度アカウントを作るか、運営に連絡してください",
          { ops_email: d.config.opsEmail },
        );
      }
    }
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
    // メンバーができた後にセッションを写す。先に認証の利用者を作るので、セッションの hook の時点ではまだメンバーが無い
    // （写さないと、参加した直後は何を押しても「ログインしてください」になる）
    await d.appPool.query("select app.open_sessions_for_user($1)", [u.userId]);
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

  // はじめの設定の進み具合（T-U-09〜・D-089）。1 PCをつなぐ → 6 本番へ。0 は「まだ何もしていない」。
  // 画面はこれを見て、通していない人を今いる段へ戻す（入口・アプリの枠の両方）
  app.get("/setup-state", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // 生の SQL だと行レベルの制御に弾かれ、黙って 0（＝まだ何もしていない）になる。/me と同じく文脈つきで読む
    const m = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    if (!m) return bad(c, 404, "MEMBER_NOT_FOUND", "あなたの会員の行が見つかりません");
    return c.json({ data: { step: Number(m["setup_step"] ?? 0), total: 6 } });
  });

  // その段を通した、と記録する（進み具合は戻らない。小さい値では上書きしない）
  app.post("/setup-step", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { step?: number };
    if (!Number.isInteger(b.step) || b.step! < 1 || b.step! > 6)
      return bad(c, 422, "VALIDATION_FAILED", "段は 1〜6 で指定してください", { field: "step" });
    const r = await d.appPool.query<{ v: number }>("select app.setup_step_done($1, $2::smallint) as v", [
      s.ctx.userId,
      b.step,
    ]);
    return c.json({ data: { step: r.rows[0]!.v, total: 6 } });
  });

  // Bridge が接続コードを引き取る（T-B-02）。Bridge 本体から呼ぶ本番の口。
  // 引き取れたら、その人の端末として sessions に 1 行つき、はじめの設定の段 1 が通る（D-089）
  app.post("/bridge/claim", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { code?: string; device_label?: string };
    const code = (b.code ?? "").trim().toUpperCase();
    if (!/^KNM-\d{4}$/.test(code))
      return bad(c, 422, "VALIDATION_FAILED", "接続コードの形が違います（KNM-0000 の形）", { field: "code" });
    const label = (b.device_label ?? "").slice(0, 80) || "この PC";
    const r = await d.appPool.query<{ session_id: string | null }>("select app.bridge_claim($1, $2) as session_id", [
      code,
      label,
    ]);
    const sid = r.rows[0]?.session_id ?? null;
    if (!sid)
      return bad(c, 410, "PAIR_CODE_INVALID", "その接続コードは使えません（10 分で失効します。画面を開き直すと新しい番号が出ます）");
    // Bridge はこの session の id を鍵に、この後の 生存の知らせ／仕事の受け取り／結末 を話す（D-090）
    return c.json({ data: { connected: true, device_label: label, session_id: sid } }, 201);
  });

  // ---- 画面が話す口（自分のAIに言う・止まったものを選び直す・D-090）
  // 会話は 1 本（D-062）。開いている会話が無ければ作る。文脈の本体は Claude の session（Kaname は id だけ持つ）
  app.post("/agent/say", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as {
      text?: string; conversation_id?: string; branch_from?: string;
      context?: { screen?: unknown; screen_name?: unknown; selected?: unknown };
    } & Record<string, unknown>;
    const text = (b.text ?? "").trim();
    if (!text) return bad(c, 422, "VALIDATION_FAILED", "言うことが空です", { field: "text" });
    // どこで話しかけられたか（D-103）：会話は同じ 1 本で、自分のAI に渡す指示にだけ前置きする。会話に出す言葉は本人が書いたまま
    const one = (v: unknown, n: number): string => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
    const screenId = /^[a-z0-9-]{1,40}$/.test(one(b.context?.screen, 40)) ? one(b.context?.screen, 40) : "";
    const screenName = one(b.context?.screen_name, 40);
    const selected = one(b.context?.selected, 120);
    const where =
      screenId || selected
        ? `（Kaname の画面から話しかけています。いま見ている画面：${screenName || screenId || "不明"}${selected ? `／選んでいる 1 件：${selected}` : ""}）`
        : "";
    // 引用して続ける（D-104.17）：吹き出しには引用として出し、自分のAI への指示には引用した文を添える（添えないと何の話か伝わらない）
    const q = (b["quote"] ?? null) as { text?: unknown } | null;
    const quoted = q && typeof q.text === "string" && q.text.trim() ? `（あなたの返事のこの部分について）\n> ${q.text.trim().slice(0, 2000).replace(/\n/g, "\n> ")}` : "";
    // はじめの設定の聞き取り（D-114）：分かった事実はその場で覚える。決まりだけだと効かなかったので、毎回の依頼にも添える（2026-09-29 実例）
    const interview = screenId === "onboard-interview" ? ONBOARD_REMEMBER : "";
    const context = [where, interview, quoted].filter(Boolean).join("\n");
    const conv = await d.appPool.query<{ conv_id: string; agent_session: string | null }>(
      "select * from app.agent_open_conversation($1, $2, $3, $4)",
      [ses.ctx.userId, b.conversation_id ?? null, b.branch_from ?? null, text.slice(0, 40)],
    );
    const cv = conv.rows[0];
    if (!cv) return bad(c, 404, "CONVERSATION_NOT_FOUND", "この会話はありません（消したか、あなたの会話ではありません）");
    const convId = cv.conv_id;
    // 直して送り直す（D-104.17）：新しいセッションなので、写したやりとりを短くまとめて自分のAI に添える（無いと何の続きか分からない）
    let earlier = "";
    if (b.branch_from) {
      const st = await d.appPool.query<{ s: { messages?: { who: string; text: string }[] } }>("select app.agent_state($1, $2) as s", [ses.ctx.userId, convId]);
      const past = (st.rows[0]?.s.messages ?? []).filter((m) => m.who === "me" || m.who === "ai").slice(-20);
      if (past.length)
        earlier = `（前の会話の途中から、この文を直して送り直しています。ここまでのやりとり）\n${past
          .map((m) => `${m.who === "me" ? "本人" : "あなた"}：${m.text.replace(/\s+/g, " ").slice(0, 400)}`)
          .join("\n")}`;
    }
    // 本人が答えたのに届かないまま止まった問い合わせの答え（Bridge が途中で止まった等）。聞き直させずに渡す（2026-09-28 実例）
    const carried = b.branch_from ? "" : carriedAnswers((await d.appPool.query<{ v: unknown }>("select app.agent_carry_answers($1, $2) as v", [ses.ctx.userId, convId])).rows[0]?.v);
    // モード・モデル・使うもの・資料・引用（D-104.10〜D-104.14）。全部許可は本人が選んだときだけ画面から来る
    const job = await d.appPool.query<{ id: string | null }>("select app.agent_enqueue($1, $2, $3, $4, $5::jsonb) as id", [
      ses.ctx.userId,
      convId,
      text,
      [earlier, carried, context].filter(Boolean).join("\n\n") || null,
      JSON.stringify(jobOptions(b)),
    ]);
    // つながっているかは定義の中で見る（読む側で生の select をすると行レベルの制御に弾かれて黙って 0 になる）
    if (!job.rows[0]?.id)
      return bad(c, 409, "BRIDGE_NOT_CONNECTED", "このPCがつながっていません。自分のPCをつなぐ から先に登録してください");
    return c.json({ data: { conversation_id: convId, job_id: job.rows[0].id } }, 201);
  });

  // 止まった仕事を、人が選び直す（続きから／やり直す／やめる）
  app.post("/agent/resume", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: string; how?: string };
    if (!b.job_id || !["continue", "restart", "cancel"].includes(b.how ?? ""))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と 続きから／やり直す／やめる が要ります");
    const r = await d.appPool.query<{ id: string | null }>("select app.bridge_resume_job($1, $2, $3) as id", [
      ses.ctx.userId,
      b.job_id,
      b.how,
    ]);
    if (!r.rows[0]?.id) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は止まっていません");
    return c.json({ data: { job_id: r.rows[0].id } }, 201);
  });

  // 会話のいま（D-090）。言ったこと・返ってきたこと・止まりました・動いている仕事 を 1 回で返す。
  // 画面はこれを繰り返し読むだけ。止まったものは止まったまま出し、人が選ぶ（自動で再開しない）
  app.get("/agent/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const conv = c.req.query("conversation_id") ?? null;
    if (conv !== null && !/^[0-9a-f-]{36}$/i.test(conv))
      return bad(c, 422, "VALIDATION_FAILED", "会話の id の形が違います", { field: "conversation_id" });
    const r = await d.appPool.query<{ s: unknown }>("select app.agent_state($1, $2) as s", [ses.ctx.userId, conv]);
    return c.json({ data: r.rows[0]!.s });
  });

  // Bridge の配布（T-B-06・D-015.6）。**Kaname のサーバーから配る**。顧客に外のサービスを見せない。
  // 実物がまだ無いときは、そう言う（押しても何も起きない・嘘の「ダウンロード中」を作らない）
  const RELEASE = { mac: "Kaname-Bridge.dmg", win: "Kaname-Bridge-Setup.exe" } as const;
  const releaseCfg = () => ({ dir: d.config.bridgeReleaseDir ?? "", base: d.config.bridgeReleaseBase ?? "" });
  app.get("/bridge/download", async (c) => {
    const os = (c.req.query("os") ?? "") as keyof typeof RELEASE;
    if (!RELEASE[os]) return bad(c, 422, "VALIDATION_FAILED", "mac か win を指定してください", { field: "os" });
    // 目録（D-109）があれば、そこに載ったインストーラを配る
    const rel = await readManifest(releaseCfg());
    const inst = rel ? pickInstaller(rel.m, os) : null;
    if (rel && inst) {
      if (rel.from === "dir") {
        const r = releaseFileResponse(d.config.bridgeReleaseDir ?? "", inst.name);
        if (r) return r; // 目録にあるのに実物が無い → 下の従来の探し方に落とす
      } else return c.redirect(`${(d.config.bridgeReleaseBase ?? "").replace(/\/$/, "")}/${inst.name}`, 302);
    }
    // 手元のフォルダに置いてあれば、そこから配る（署名と置き場が決まる前でも人は入れられる）
    const pick = legacyInstaller(d.config.bridgeReleaseDir ?? "", os);
    if (pick) {
      const r = releaseFileResponse(d.config.bridgeReleaseDir ?? "", pick);
      if (r) return r;
    }
    const base = d.config.bridgeReleaseBase ?? "";
    if (!base)
      return bad(
        c,
        404,
        "BRIDGE_NOT_RELEASED",
        "まだ配布していません。署名と置き場の用意ができたら、ここから入れられるようになります",
      );
    return c.redirect(`${base}/${RELEASE[os]}`, 302);
  });
  // 新しい版を Bridge が自分で見に来る先（D-109）。いまの版と、その OS・CPU の中身の場所・指紋（sha256）・大きさを返す。
  // 目録が無ければ released: false（Bridge は何もしない）
  app.get("/bridge/latest", async (c) => {
    const rel = await readManifest(releaseCfg());
    if (!rel) return c.json({ data: { released: false } });
    const os = c.req.query("os");
    const arch = c.req.query("arch");
    const f = (os === "mac" || os === "win") && (arch === "arm64" || arch === "x64") ? pickUpdate(rel.m, os, arch) : null;
    const url = !f
      ? null
      : rel.from === "dir"
        ? `/api/auth-ext/bridge/file/${encodeURIComponent(f.name)}`
        : `${(d.config.bridgeReleaseBase ?? "").replace(/\/$/, "")}/${f.name}`;
    return c.json({
      data: {
        released: true,
        version: rel.m.version,
        released_at: rel.m.released_at,
        update: f && url ? { name: f.name, url, sha256: f.sha256, size: f.size } : null,
      },
    });
  });
  // 目録に載ったファイルだけ手元のフォルダから流す（名前で置き場の外を指させない・D-109）
  app.get("/bridge/file/:name", async (c) => {
    const dir = d.config.bridgeReleaseDir ?? "";
    const rel = dir ? await readManifest({ dir }) : null;
    const name = c.req.param("name");
    const f = rel ? isListed(rel.m, name) : null;
    if (!f) return bad(c, 404, "NOT_FOUND", "その配布物はありません");
    return releaseFileResponse(dir, f.name) ?? bad(c, 404, "NOT_FOUND", "その配布物はありません");
  });

  // 「新しい会話」（D-062）。いまの 1 本を閉じる。次に言ったことが新しい 1 本になる（前のやりとりは残る）
  app.post("/agent/new", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { conversation_id?: string };
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_close_conversation($1, $2) as ok", [
      ses.ctx.userId,
      b.conversation_id ?? null,
    ]);
    return c.json({ data: { closed: r.rows[0]?.ok ?? false } }, 201);
  });

  // この PC のいま（T-B-04・G-12）。つながっているか／本当に生きているか（最後の知らせからの経過）／自己診断の報告
  app.get("/bridge/state", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ s: unknown }>("select app.bridge_state($1) as s", [ses.ctx.userId]);
    return c.json({ data: r.rows[0]!.s });
  });

  // AI が使うブラウザを、いまの端末について選ぶ（D-120.1）。次の仕事から効く
  app.post("/agent/browser", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { browser?: unknown };
    if (!BROWSERS.includes(b.browser as Browser)) return bad(c, 422, "VALIDATION_FAILED", "ブラウザは chrome／dedicated／off のどれかです");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_set_browser($1, $2) as ok", [ses.ctx.userId, b.browser]);
    if (!r.rows[0]?.ok) return bad(c, 404, "BRIDGE_NOT_FOUND", "つないだ PC がありません");
    return c.json({ data: { browser: b.browser } });
  });
  // この端末を外す（2026-10-01 QA：モックにあって実装に無かった）。自分の Bridge の端末だけ。外した鍵は次の要求で 410 になり、
  // Bridge は鍵を捨てて仕事を取りに来なくなる（G-14）。画面の Web ログインのセッションはここでは外さない（kind_id = 'bridge' だけ）
  app.post("/agent/bridge-revoke", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { session_id?: unknown };
    if (typeof b.session_id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.session_id))
      return bad(c, 422, "VALIDATION_FAILED", "外す端末の id が要ります");
    const n = await withTenant(d.appPool, ses.ctx, async (cl) =>
      (
        await cl.query<{ n: number }>(
          "select coalesce(sum(app.revoke_own_session(s.id, 'logout')), 0)::int as n from sessions s where s.id = $1 and s.kind_id = 'bridge' and s.revoked_at is null",
          [b.session_id],
        )
      ).rows[0]!.n,
    );
    if (!n) return bad(c, 404, "BRIDGE_NOT_FOUND", "その端末はありません（もう外したか、つないでいない端末です）");
    return c.json({ data: { revoked: true } });
  });
  // もう一度確かめる（D-120.3）：Bridge が小さな仕事で Chrome を本当に使えるか試す。結果は PC の状態（自己診断）に出る
  app.post("/agent/browser-check", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ id: string | null }>("select app.agent_browser_check($1, $2) as id", [ses.ctx.userId, BROWSER_CHECK_PROMPT]);
    const id = r.rows[0]?.id ?? null;
    if (!id) return bad(c, 409, "BRIDGE_ASLEEP", "PC の Bridge が動いていないので確かめられません。Bridge を起こしてから押してください");
    return c.json({ data: { job_id: id } }, 201);
  });

  // ---- Bridge が話す口（T-B-03・D-090）。鍵は claim で受け取った bridge の session id
  const bridgeSession = async (c: { req: { raw: Request } }) => {
    const h = c.req.raw.headers.get("x-bridge-session") ?? "";
    return /^[0-9a-f-]{36}$/i.test(h) ? h : null;
  };
  /** 鍵が生きているか。切れた・退会した・つなぎ直した鍵は 410（Bridge はこれで鍵を捨てる・G-14）。
   *  「仕事が無い（404）」と混ぜない：混ぜると古い仕事 id の 404 で鍵まで捨ててしまう */
  const bridgeAlive = async (sid: string): Promise<boolean> =>
    // 生の select は行レベルの制御に弾かれて 0 件になる。判定は関数の中で（0036）
    (await d.appPool.query<{ ok: boolean }>("select app.bridge_session_alive($1) as ok", [sid])).rows[0]?.ok === true;
  /** 仕事の問い合わせ（D-097）。待ち受けは最長 20 秒（関数の上限より十分短く）・中で 1 秒ごとに見る・動いていないときは 5 秒あける */
  const TAKE_WAIT_MAX_SEC = 20;
  const TAKE_TICK_MS = 1_000;
  const TAKE_IDLE_MS = 5_000;
  const GONE = (c: Parameters<typeof bad>[0]) => bad(c, 410, "SESSION_GONE", "この端末の接続は切れています。つなぎ直してください");

  // 生きている、と知らせる（最後の応答が本当に動く）＋ 自己診断の結果を返す
  app.post("/bridge/heartbeat", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { health?: unknown; protocol?: unknown };
    // 古い Bridge（約束の版を送らない・古い）は、自己診断に「古い」を足して画面に出す（E-CONN-012）
    const old = !(Number(b.protocol) >= BRIDGE_PROTOCOL_MIN);
    const health = Array.isArray(b.health) ? (b.health as unknown[]) : [];
    const withVersion = old ? [...health, OUTDATED_CHECK] : health;
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_heartbeat($1, $2::jsonb) as ok", [
      sid,
      b.health === undefined && !old ? null : JSON.stringify(withVersion),
    ]);
    if (!r.rows[0]?.ok) return bad(c, 410, "SESSION_GONE", "この端末の接続は切れています。つなぎ直してください");
    // この端末で AI が使うブラウザ（D-120.1）。Bridge の窓に同じ値を出す
    const br = await d.appPool.query<{ b: string | null }>("select app.bridge_browser($1) as b", [sid]);
    return c.json({ data: { ok: true, browser: br.rows[0]?.b ?? null } });
  });
  // Bridge の窓から選び直す（Kaname の画面で変えたのと同じ・D-120.1）
  app.post("/bridge/browser", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { browser?: unknown };
    if (!BROWSERS.includes(b.browser as Browser)) return bad(c, 422, "VALIDATION_FAILED", "ブラウザは chrome／dedicated／off のどれかです");
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_set_browser($1, $2) as ok", [sid, b.browser]);
    if (!r.rows[0]?.ok) return GONE(c);
    return c.json({ data: { browser: b.browser } });
  });

  // 仕事を 1 件もらう（無ければ空）。1 回の問い合わせで「生きている」も知らせる（D-097）。
  // 仕事が動いている最中（直近 5 分に入った・終わった）だけ、wait_sec まで待ち受けて、入ったらすぐ返す。
  // それ以外はすぐ返し、次に聞くまでの間（next_ms）を伝える。画面も API も Vercel なので、回数と長さがそのまま費用になる
  const takeJob = async (sid: string) =>
    (
      await d.appPool.query<{
        job_id: string; prompt: string; agent_session_id: string | null; conversation_id: string | null;
        permission_mode: string; model: string | null; effort: string | null; tools: string[] | null; allowed_tools: string[] | null;
        attachments: { id: string; name: string; mime: string; size: number }[];
        kind: "chat" | "login_check"; credential_id: string | null;
      }>("select * from app.bridge_take_job($1)", [sid])
    ).rows[0] ?? null;
  app.post("/bridge/take", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    const b = (await c.req.json().catch(() => ({}))) as { wait_sec?: unknown; protocol?: unknown; idle?: unknown };
    const wait = Math.max(0, Math.min(TAKE_WAIT_MAX_SEC, Number(b.wait_sec) || 0));
    const poll = await d.appPool.query<{ hot: boolean | null }>("select app.bridge_poll($1) as hot", [sid]);
    const hot = poll.rows[0]?.hot;
    if (hot === null || hot === undefined) return GONE(c);
    // 古い Bridge には仕事を渡さない（答えを落とす・関門が無い）。生きている知らせだけ受ける（E-CONN-012）
    if (!(Number(b.protocol) >= BRIDGE_PROTOCOL_MIN)) return c.json({ data: null, next_ms: TAKE_IDLE_MS, outdated: true });
    // Bridge が「いま何も動かしていない」と言って来たら、動いたまま残った仕事（途中で止まった Bridge の残り）を理由つきで止める
    if (b.idle === true) await d.appPool.query("select app.bridge_sweep_orphans($1)", [sid]);
    const until = Date.now() + (hot ? wait * 1000 : 0);
    for (;;) {
      const job = await takeJob(sid);
      if (job) {
        // 会話の仕事には、効かせる記憶（上の層の決まり → 本人の好み）を一緒に渡す（D-105.7・D-105.8）
        const mem = job.conversation_id
          ? ((await d.appPool.query<{ v: unknown }>("select app.bridge_job_memories($1, $2) as v", [sid, job.job_id])).rows[0]?.v ?? [])
          : [];
        // 台帳で禁止・銀行のドメイン（D-107.1）。どの仕事にも渡す（全部許可でも PC の上で止める）。資格情報は渡さない（D-107.7）
        const blocked = (await d.appPool.query<{ v: unknown }>("select app.bridge_blocked_domains() as v")).rows[0]?.v ?? [];
        // 会話の仕事には Kaname の道具の鍵を付ける（D-110.3）。その仕事の間だけ・本人の会社にだけ書ける
        const tool_token = job.conversation_id ? await issueToolToken(d.appPool, sid, job.job_id) : null;
        // 会話の決まりも一緒に渡す（Kaname が正本。Bridge を配り直さずに直せる）
        const conventions = job.conversation_id ? AGENT_CONVENTIONS : null;
        // AI が使うブラウザ（D-120.1）：仕事の指定 → 会話の仕事なら端末の選択 → それ以外は使わない
        const browser = (await d.appPool.query<{ b: string | null }>("select app.bridge_job_browser($1, $2) as b", [sid, job.job_id])).rows[0]?.b ?? "off";
        return c.json({ data: { ...job, memories: mem, blocked, tool_token, conventions, browser }, next_ms: 0 });
      }
      if (Date.now() >= until) break;
      await new Promise((r) => setTimeout(r, TAKE_TICK_MS));
    }
    // 待ち受けた後は間をあけずに聞き直してもらう。動いていないときは間をあける（最初の 1 件は最大この間だけ遅れる）
    return c.json({ data: null, next_ms: hot && wait > 0 ? 0 : TAKE_IDLE_MS });
  });

  // 結末を返す。止まったものは stopped のまま置く（自動で戻さない・D-090）
  app.post("/bridge/finish", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      job_id?: string; state?: string; result?: string; reason?: string; agent_session_id?: string;
    };
    if (!b.job_id || !b.state) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と結末が要ります");
    // 記憶の毎朝のまとめの仕事なら、答え（JSON）を読んで記憶に入れる（D-105.4）。会話には出さない
    const dg = await d.appPool.query<{ id: string | null }>("select app.digest_of_job($1, $2) as id", [sid, b.job_id]);
    const digestId = dg.rows[0]?.id ?? null;
    // 「覚えて」の印は返事から消し、個人の記憶に入れる（D-105.1）
    const rem = b.state === "done" && b.result && !digestId ? takeRemember(b.result) : { text: b.result ?? null, items: [] as string[] };
    const r = await d.appPool.query<{ ok: boolean }>(
      "select app.bridge_finish_job($1, $2, $3, $4, $5, $6) as ok",
      [sid, b.job_id, b.state, rem.text ?? null, b.reason ?? null, b.agent_session_id ?? null],
    );
    if (!r.rows[0]?.ok) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は見つかりません");
    if (rem.items.length) await d.appPool.query("select app.agent_remember($1, $2, $3)", [sid, b.job_id, rem.items]);
    if (digestId) {
      const parsed = b.state === "done" && b.result ? parseDigest(b.result) : null;
      await d.appPool.query("select app.agent_digest_apply($1, $2, $3, $4::jsonb, $5)", [
        sid, digestId, !!parsed, parsed ? JSON.stringify(parsed) : null,
        parsed ? null : b.state === "done" ? "自分のAI の答えが決まった形（JSON）ではありませんでした。もう一度押してください" : (b.reason ?? "止まりました"),
      ]);
    }
    return c.json({ data: { ok: true } });
  });

  // ---- 1 行 1 イベント（D-093）：途中経過・会話の id・確認 を Bridge が流し、本人が答える
  /** 道具の呼び出し 1 回（D-100.2）：名前・対象・成功／失敗・時間だけ。入力や返り値の全文は持たない */
  const toolRecord = (v: unknown) => {
    const t = (v ?? {}) as Record<string, unknown>;
    const ms = Number(t["ms"]);
    return {
      name: String(t["name"] ?? "").slice(0, 60),
      target: String(t["target"] ?? "").slice(0, 160),
      ok: t["ok"] === true,
      ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null,
    };
  };
  /** 使った量（D-100.1）：数だけ。知らない欄は捨てる */
  const usageRecord = (v: unknown) => {
    const u = (v ?? {}) as Record<string, unknown>;
    const n = (k: string) => (Number.isFinite(Number(u[k])) && u[k] !== null && u[k] !== "" ? Number(u[k]) : null);
    return {
      turns: n("turns"), duration_ms: n("duration_ms"), api_ms: n("api_ms"),
      input_tokens: n("input_tokens"), output_tokens: n("output_tokens"),
      cache_read_tokens: n("cache_read_tokens"), cache_write_tokens: n("cache_write_tokens"), cost_usd: n("cost_usd"),
    };
  };
  /** 手順のチェックリスト（D-104.8）：中身・済んだか だけ */
  const planRecord = (v: unknown) => ({
    todos: (Array.isArray(v) ? v : []).slice(0, 30).map((x) => {
      const t = (x ?? {}) as Record<string, unknown>;
      const s = String(t["status"] ?? "pending");
      return { content: String(t["content"] ?? t["activeForm"] ?? "").slice(0, 200), status: ["pending", "in_progress", "completed"].includes(s) ? s : "pending" };
    }),
  });
  /** 台帳で止めた道具（D-107.4・D-107.5）：道具の名前・宛先のドメイン・サービス・対象（切る） */
  const blockedRecord = (v: unknown) => {
    const x = (v ?? {}) as Record<string, unknown>;
    return { tool: String(x["tool"] ?? "").slice(0, 80), domain: String(x["domain"] ?? "").slice(0, 200), service: String(x["service"] ?? "").slice(0, 120), target: String(x["target"] ?? "").slice(0, 300) };
  };
  /** 使用量（D-104.16）：枠・割合・戻る時刻 だけ */
  const limitRecord = (v: unknown) => ({
    windows: (Array.isArray(v) ? v : []).slice(0, 4).flatMap((x) => {
      const w = (x ?? {}) as Record<string, unknown>;
      const win = String(w["window"] ?? "");
      const u = Number(w["utilization"]);
      const r = Number(w["resets_at"]);
      return ["five_hour", "week"].includes(win) && Number.isFinite(u) && Number.isFinite(r) ? [{ window: win, utilization: Math.max(0, Math.min(1, u)), resets_at: r }] : [];
    }),
  });
  // 途中経過（D-093.7）と会話の id（D-093.4）。届かなくても Bridge は仕事を続ける
  app.post("/bridge/progress", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as {
      job_id?: string; seq?: number; kind?: string; text?: string; agent_session_id?: string; model?: unknown; tool?: unknown; usage?: unknown; todos?: unknown; windows?: unknown;
      blocked?: unknown;
    };
    if (!b.job_id || !["init", "progress", "tool", "usage", "status", "plan", "limit", "reply", "blocked", "notice"].includes(b.kind ?? ""))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と kind（init／progress／tool／usage／status／plan／limit／reply／blocked／notice）が要ります");
    // 中身の全文は受け取らない（D-100.3）。決めた欄だけを取り出し、長さも切る
    const payload =
      b.kind === "init" ? { agent_session_id: b.agent_session_id ?? null, model: typeof b.model === "string" && /^[a-z0-9.-]{1,60}$/i.test(b.model) ? b.model : null }
      : b.kind === "tool" ? toolRecord(b.tool)
      : b.kind === "usage" ? usageRecord(b.usage)
      : b.kind === "plan" ? planRecord(b.todos)
      : b.kind === "limit" ? limitRecord(b.windows)
      : b.kind === "reply" ? { text: String(b.text ?? "").slice(0, 200000) }
      : b.kind === "blocked" ? blockedRecord(b.blocked)
      : { text: String(b.text ?? "").slice(0, 400) };
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_progress($1, $2, $3, $4, $5::jsonb) as ok", [
      sid, b.job_id, Number(b.seq ?? 0), b.kind, JSON.stringify(payload),
    ]);
    if (!r.rows[0]?.ok) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は動いていません");
    return c.json({ data: { ok: true } });
  });
  // 確認（D-093.3）：CLI が「これを実行していいか」と聞いた。画面に出して本人の答えを待つ
  app.post("/bridge/ask", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: string; request_id?: string; tool?: string; input?: unknown; summary?: string };
    if (!b.job_id || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const payload = { tool: String(b.tool ?? "道具").slice(0, 80), input: b.input ?? null, summary: String(b.summary ?? "").slice(0, 300) };
    const r = await d.appPool.query<{ ok: boolean }>("select app.bridge_ask($1, $2, $3, $4::jsonb) as ok", [sid, b.job_id, b.request_id, JSON.stringify(payload)]);
    if (!r.rows[0]?.ok) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は動いていません");
    return c.json({ data: { ok: true } }, 201);
  });
  // Bridge が答えを取りに来る（無ければ null。勝手に許可しない）
  app.post("/bridge/answer", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: string; request_id?: string };
    if (!b.job_id || !b.request_id) return bad(c, 422, "VALIDATION_FAILED", "仕事の id と request_id が要ります");
    const r = await d.appPool.query<{ a: string | null }>("select app.bridge_take_answer($1, $2, $3) as a", [sid, b.job_id, b.request_id]);
    return c.json({ data: { answer: r.rows[0]?.a ?? null } });
  });
  // 本人が答える（許可する／許可しない）。答えは 出来事・会話・証跡 に残る（D-093.8）
  app.post("/agent/answer", async (c) => {
    const ses = await resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: string; request_id?: string; allow?: boolean };
    if (!b.job_id || !b.request_id || typeof b.allow !== "boolean") return bad(c, 422, "VALIDATION_FAILED", "仕事の id・request_id・許可するか が要ります");
    const r = await d.appPool.query<{ ok: boolean }>("select app.agent_answer($1, $2, $3, $4) as ok", [ses.ctx.userId, b.job_id, b.request_id, b.allow]);
    if (!r.rows[0]?.ok) return bad(c, 404, "ASK_NOT_FOUND", "その確認は見つかりません（もう答えたか、仕事が終わっています）");
    return c.json({ data: { ok: true } }, 201);
  });

  // 会話の作り込み（D-104・D-105）の口は agent.ts
  app.route("/", agentStreamRoutes({ resolve, hub: d.hub ?? null }));
  app.route("/", agentRoutes({ appPool: d.appPool, resolve, ...(d.objects ? { objects: d.objects } : {}), baseUrl: d.config.baseUrl }));

  // 自分のこと（D-086）：画面が「この権限で見えるか」を判定するのに要る。
  // 一覧（GET /members）は行レベルの制御で自分の行すら返らないことがある。自分の役割はここから引く
  app.get("/me", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const m = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    return c.json({
      data: {
        member_id: s.ctx.userId,
        tenant_id: s.ctx.tenantId,
        display_name: m?.["display_name"] ?? null,
        role_id: (m?.["role_id"] as string | null) ?? null,
        scope_id: m?.["scope_id"] ?? null,
      },
    });
  });

  // 資格情報を預ける（T-U-10・関門 C8）：平文はここで暗号化して vault へ。表（credentials）には参照 ID だけ。AI には渡らない
  const UUID_RE_CRED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  app.post("/vault/credentials", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    // 預かり先が決まっていない（段階 1・D-097.8）間は、staging／本番で預からない。メモリに置くと再起動・別の実体で消える
    if ((d.config.env === "staging" || d.config.env === "production") && !d.secrets.durable)
      return bad(c, 503, "E-SEC-002", "いまはログイン情報を預かれません。預かり先の用意ができたら使えるようになります");
    const b = (await c.req.json().catch(() => ({}))) as {
      service_name?: string;
      service_domain?: string;
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
    // 2 段階認証の秘密鍵は Base32（A〜Z・2〜7）。空白と小文字は直して通す。それ以外は E-VAL-003（G-08：出せるエラー）
    const totpSecret = b.totp_secret ? b.totp_secret.normalize("NFKC").replace(/\s+/g, "").toUpperCase() : null;
    if (totpSecret !== null && !/^[A-Z2-7]{16,}=*$/.test(totpSecret))
      return bad(
        c,
        422,
        "E-VAL-003",
        "秘密鍵の形式が違います。認証アプリの登録時に出る文字列（英字と 2〜7 の数字・16 文字以上）を貼ってください",
        { field: "totp_secret" },
      );
    const stored = await d.secrets.store(
      s.ctx,
      kind,
      JSON.stringify({ login, password: b.password, totp_secret: totpSecret }),
    );
    if (stored.status !== "done") {
      // 上限に当たった（D-102.5）：待つ秒数を添えて断る。預かったことにしない
      if ("retryAfterSec" in stored && stored.retryAfterSec)
        return bad(c, 503, "E-SEC-003", `いま混み合っています。${stored.retryAfterSec} 秒ほど待ってからもう一度保存してください`, {
          retry_after_sec: stored.retryAfterSec,
        });
      return bad(c, 502, "E-SEC-001", "預かり先に保管できませんでした。もう一度試してください", {
        handoff: "reason" in stored ? stored.reason : null,
      });
    }
    const ref = typeof stored.value === "string" ? stored.value : stored.value.ref;
    const me = await d.repo.table("members").get(s.ctx, s.ctx.userId);
    // 入れたサービス名と宛先を残し、台帳に同じサービスがあれば結ぶ（D-108.4）
    const name = String(b.service_name ?? "").normalize("NFKC").trim().slice(0, 120);
    const domain = hostOf(name) ?? hostOf(String(b.service_domain ?? ""));
    const svc = b.service_id
      ?? (await d.appPool.query<{ id: string | null }>("select app.credential_service($1, $2) as id", [name, domain])).rows[0]?.id
      ?? null;
    const row = await d.repo.table("credentials").create(s.ctx, {
      service_id: svc,
      service_name: name || null,
      service_domain: domain,
      kind_id: kind,
      vault_ref: ref,
      owner_member_id: s.ctx.userId,
      scope_id: me?.["scope_id"] ?? null,
    });
    // 預けたらその場で 1 回だけログインを試す（D-117.1）。禁止・銀行は試さない。Bridge の端末が無ければ積まない
    const check = (await d.appPool.query<{ id: string | null }>("select app.credential_login_check_enqueue($1, $2) as id", [s.ctx.userId, row["id"]])).rows[0]?.id ?? null;
    return c.json({ data: { id: row["id"], vault_ref: ref, service_name: name || null, login_check_job_id: check } }, 201);
  });
  // Bridge が 1 回のログインの結果を返す（T-B-38・D-117.1）。本人の Bridge が取った動いている仕事に対してだけ。値は無い（結果の種類と理由だけ）
  app.post("/bridge/credentials/check-result", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; state?: unknown; detail?: unknown };
    const states = ["ok", "bad_password", "needs_2fa", "captcha", "unreachable", "no_form", "stopped"];
    if (typeof b.job_id !== "string" || !UUID_RE_CRED.test(b.job_id) || typeof b.state !== "string" || !states.includes(b.state))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と結果（ok／bad_password／needs_2fa／captcha／unreachable／no_form／stopped）が要ります");
    const detail = typeof b.detail === "string" ? b.detail.slice(0, 400) : "";
    const r = (await d.appPool.query<{ v: { tenant_id: string; member_id: string; credential_id: string } | null }>(
      "select app.bridge_login_check_result($1, $2, $3, $4) as v", [sid, b.job_id, b.state, detail],
    )).rows[0]?.v ?? null;
    if (!r) return bad(c, 404, "JOB_NOT_FOUND", "その仕事は見つかりません");
    await d.repo.audit({ tenantId: r.tenant_id, userId: r.member_id, role: "member" }, "credential.login_check", "credentials", r.credential_id, "C1", { job_id: b.job_id, state: b.state });
    return c.json({ data: { ok: true } });
  });
  // Bridge が「いま動いている仕事」のために資格情報 1 件を受け取る（T-B-05・D-102.2・D-017.1・関門 C8）。
  //   本人の Bridge の鍵・本人の動いている仕事・本人の資格情報、の 3 つがそろったときだけ。解くのは関門（caller=executor）で、証跡に残す。
  //   値はこの応答にだけ載る（表・ログ・AI の道具には載らない）
  app.post("/bridge/credentials/resolve", async (c) => {
    const sid = await bridgeSession(c);
    if (!sid) return bad(c, 401, "UNAUTHENTICATED", "この Bridge は分かりません");
    if (!(await bridgeAlive(sid))) return GONE(c);
    const b = (await c.req.json().catch(() => ({}))) as { job_id?: unknown; credential_id?: unknown };
    if (typeof b.job_id !== "string" || !UUID_RE_CRED.test(b.job_id) || typeof b.credential_id !== "string" || !UUID_RE_CRED.test(b.credential_id))
      return bad(c, 422, "VALIDATION_FAILED", "仕事の id と資格情報の id が要ります");
    const row = (
      await d.appPool.query<{ tenant_id: string; member_id: string; vault_ref: string | null; service_name: string | null; service_domain: string | null; revoked: boolean; job_ok: boolean }>(
        "select * from app.bridge_credential($1, $2, $3)",
        [sid, b.job_id, b.credential_id],
      )
    ).rows[0];
    if (!row || !row.vault_ref) return bad(c, 404, "CREDENTIAL_NOT_FOUND", "預けたログイン情報が見つかりません");
    const ctx = { tenantId: row.tenant_id, userId: row.member_id, role: "member" as const };
    if (!row.job_ok) {
      await d.repo.audit(ctx, "credential.bridge_denied", "credentials", b.credential_id, "C8", { job_id: b.job_id, reason: "job_not_running" });
      return bad(c, 403, "JOB_NOT_RUNNING", "動いている仕事のためにだけ受け取れます", { handoff: "仕事を始めてから" });
    }
    if (row.revoked) {
      await d.repo.audit(ctx, "credential.bridge_denied", "credentials", b.credential_id, "C8", { job_id: b.job_id, reason: "revoked" });
      return bad(c, 403, "CREDENTIAL_REVOKED", "このログイン情報は失効しています。預け直してください", { handoff: "預け直す" });
    }
    const o = await d.secrets.resolve(row.vault_ref, { ...ctx, caller: "executor" });
    if (o.status !== "done") {
      // 届かない・混んでいる・読めない：成功にしない。理由に値は無い
      return bad(c, o.status === "denied" ? 403 : 502, o.status === "denied" ? "CREDENTIAL_DENIED" : "E-SEC-001", o.reason, {
        handoff: o.handoff,
        ...("retryAfterSec" in o && o.retryAfterSec ? { retry_after_sec: o.retryAfterSec } : {}),
      });
    }
    let v: { login?: unknown; password?: unknown; totp_secret?: unknown };
    try {
      v = JSON.parse(o.value) as typeof v;
    } catch {
      return bad(c, 502, "E-SEC-001", "預かった情報が読めません。安全のため、もう一度預け直してください", { handoff: "預け直す" });
    }
    // 受け取った仕事と資格情報の結びつきだけを証跡に（値は書かない）
    await d.repo.audit(ctx, "credential.bridge_resolve", "credentials", b.credential_id, "C8", { job_id: b.job_id, service_name: row.service_name });
    return c.json({
      data: {
        login: typeof v.login === "string" ? v.login : "",
        password: typeof v.password === "string" ? v.password : "",
        totp_secret: typeof v.totp_secret === "string" ? v.totp_secret : null,
        service_name: row.service_name,
        service_domain: row.service_domain,
      },
    });
  });
  // 預けたものの一覧（D-108.3）：サービス名・台帳の可否・状態・預かり先の番号の頭だけ。中身は返さない
  app.get("/vault/credentials", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.my_credentials($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? [] });
  });
  // たたき台（D-108.5）：目標（今の版の名前）・台帳・担当業務とAI社員を 1 回で
  app.get("/onboard/draft", async (c) => {
    const s = await resolve(c.req.raw.headers);
    if (!s?.ctx.tenantId || !s.ctx.userId) return bad(c, 401, "UNAUTHENTICATED", "ログインしてください");
    const r = await d.appPool.query<{ v: unknown }>("select app.onboard_draft($1) as v", [s.ctx.userId]);
    return c.json({ data: r.rows[0]?.v ?? { goals: [], ledgers: [], duties: [] } });
  });
  // 自分のAI が Kaname の道具でたたき台に置く（D-110）
  app.route("/", agentToolRoutes({ appPool: d.appPool }));
  return app;
}
