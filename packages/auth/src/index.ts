// 認証（Better Auth 1.7）。境界 B2：better-auth を import してよいのはこのパッケージだけ（CI G7）。
// 表は Postgres の schema "kaname_auth"（RLS の対象の public とは分ける。Supabase は schema auth を自社の認証に使うので同じ名前にしない：T-F-18）。失効の正は public.sessions（app.session_alive）。トークンの期限には頼らない。
import { deviceOf } from "./device.js";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { PostgresDialect } from "kysely";
import pg from "pg";
import { uuidv7 } from "@kaname/db/id";
import { countQueries, markDbSession } from "@kaname/db/pool";
import { optionalEnv } from "@kaname/config";
import { mailTag } from "./signup.js";
import { RESET_PREFIX, resetHash } from "./reset.js";
import { CODE_LOCK, generateBackupCodes } from "./two_factor.js";

export interface AuthOptions {
  /** 認証ロール（kaname_auth）で接続する URL。schema auth に読み書きする */
  authDatabaseUrl: string;
  /** public.sessions を開く／閉じる関数を呼ぶための接続（kaname_app でよい） */
  appPool: pg.Pool;
  secret: string;
  baseURL: string;
  issuer?: string;
  /** メールの送出（関門 C6・packages/notify の transport）。無ければ送らない（開発：ログに出す） */
  mailer?: Mailer;
  /** 画面の URL（メールのリンクの先）。無ければ baseURL */
  webBaseURL?: string;
  /** 認証のプールの本数（既定 5。Vercel の関数は 1 つにつき 2・G-16） */
  poolMax?: number;
}
export interface Mail {
  to: string;
  subject: string;
  text: string;
  url: string;
  kind: "verify" | "reset" | "new_device";
}
export type Mailer = (m: Mail) => Promise<void>;
/** 2 段階の待ちの印の長さ（秒・K-301） */
export const TWO_FACTOR_PENDING_SEC = 300;
/** 閉じる部品の道（ロックと止めを通らない道・K-301） */
export const DISABLED_PATHS = ["/sign-in/email"] as const;
/** 部品のパスワードの段の道（2 段階を付けた人はここではセッションを写さない） */
const PASSWORD_STEP_PATHS = new Set(["/sign-in/email"]);

/** 型は core の Auth（plugin の endpoint 型は使わない＝zod の内部型を .d.ts に出さない） */
export type Auth = ReturnType<typeof betterAuth<BetterAuthOptions>>;

export function createAuth(o: AuthOptions): { auth: Auth; pool: pg.Pool } {
  // 要求ごとの文の数と時間を数える（K-237・口の答えの Server-Timing）。流す文と接続の取り方は変えない
  const pool = countQueries(new pg.Pool({ connectionString: o.authDatabaseUrl, max: o.poolMax ?? 5 }));
  // 送出先が無ければリンクをログに出す（開発）。送出先があっても、本番以外はリンクを残す
  // （実際に送っていても、確かめる人が受信箱を開かずに先へ進めるように）
  const dev = optionalEnv("NODE_ENV") !== "production";
  const mail: Mailer = o.mailer
    ? async (m) => {
        if (dev) console.warn(`[auth] リンク（${m.kind} → ${mailTag(m.to)}）: ${m.url}`);
        await o.mailer!(m);
      }
    : async (m) =>
        // 本番では手がかり入りのリンクをログに残さない（K-313 のレビュー）
        console.warn(`[auth] メールの送出先が無い（${m.kind} → ${mailTag(m.to)}）${dev ? `: ${m.url}` : ""}`);
  const auth = betterAuth({
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", casing: "snake", schemaName: "kaname_auth" },
    secret: o.secret,
    baseURL: o.baseURL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      autoSignIn: true,
      // 入り直す（password-reset）：登録の有無は漏らさない（Better Auth が 200 を返す）。リンクは 30 分
      sendResetPassword: async ({ user, token }) => {
        const url = `${o.webBaseURL ?? o.baseURL}/password-reset?token=${encodeURIComponent(token)}`;
        await mail({
          to: user.email,
          subject: "Kaname のパスワードを再設定する",
          text: `次のリンクから新しいパスワードを設定してください（30 分で失効）。\n${url}`,
          url,
          kind: "reset",
        });
      },
      resetPasswordTokenExpiresIn: 60 * 30,
      // 再設定したら、認証側のほかのセッションも、Kaname の端末（画面・Bridge）も全部切る（G-14・変更と同じ。2026-10-01 QA で抜けていた）
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await o.appPool.query("select app.revoke_sessions_for_auth_user($1, 'password_changed')", [user.id]);
      },
    },
    emailVerification: {
      sendOnSignUp: false, // 保留の申し込みから自分で送る（D-088.1）。登録の時点では利用者がまだ無い
      autoSignInAfterVerification: true,
      expiresIn: 60 * 30,
      sendVerificationEmail: async ({ user, token }) => {
        const url = `${o.webBaseURL ?? o.baseURL}/verify-email?token=${encodeURIComponent(token)}`;
        await mail({
          to: user.email,
          subject: "Kaname のメールアドレスを確認する",
          text: `次のリンクを押すと本人であることが記録されます（30 分で失効）。\n${url}`,
          url,
          kind: "verify",
        });
      },
    },
    user: {
      additionalFields: {
        company_name: { type: "string", required: false, input: true },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 },
    // 再設定のリンクの手がかりは DB に平文で置かない（K-313）。頭（reset-password:）を残したハッシュにし、自分の送る関数
    //   （reset.ts の resetKey）と同じ形にする。部品はこの { default, overrides } と { hash } の形だけを読む
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: {
          [RESET_PREFIX]: { hash: async (id: string) => RESET_PREFIX + resetHash(id.slice(RESET_PREFIX.length)) },
        },
      },
    },
    advanced: { database: { generateId: () => uuidv7(), joins: true } }, // session と user を 1 本で引く（K-233）
    // 2 段階の待ちの印（パスワードを通った後・6 けたの前）は 5 分（部品の既定 10 分を直す・K-301）
    // 6 けた（とバックアップコード）は 5 回続けて違えたら 15 分止める（人ごと・D-128.141・K-302）。バックアップコードは小文字と数字だけ（answer=6bdcb125e8f7）
    plugins: [
      twoFactor({
        issuer: o.issuer ?? "Kaname",
        twoFactorCookieMaxAge: TWO_FACTOR_PENDING_SEC,
        accountLockout: { ...CODE_LOCK },
        backupCodeOptions: { customBackupCodesGenerate: generateBackupCodes },
      }),
      bearer(),
    ],
    // ロック（app.login_attempts）を通らない部品のログインの道は閉じる（404・K-301）。サーバーの中の auth.api.signInEmail は道を通らないので動く
    disabledPaths: [...DISABLED_PATHS],
    databaseHooks: {
      user: {
        create: {
          // 登録の直後：会社名があれば会社・根の層・代表・全権限・自分のAI を作る（app.create_company・T-U-01）。招待で入る人は会社名を持たない
          after: async (user) => {
            const company = (user as { company_name?: string | null }).company_name?.trim();
            if (!company) return;
            await o.appPool.query("select app.create_company($1, $2, $3)", [user.id, company, user.name || company]);
          },
        },
      },
      session: {
        create: {
          // 認証のセッションができたら public.sessions に写す（失効の正はこちら）。会社に属していない利用者は null（登録の途中）
          after: async (session, ctx) => {
            // 2 段階を付けた人のパスワードの段：部品は一度ふつうにセッションを作ってから消し、待ちの印に替える。
            //   その間は写さない・規約の印も新しい端末の知らせも出さない（6 けたで入ったときのセッションで出す・K-301）
            if (PASSWORD_STEP_PATHS.has((ctx as { path?: string } | null)?.path ?? "")) {
              const u = await pool.query<{ on: boolean | null }>(
                'select "twoFactorEnabled" as on from kaname_auth."user" where id = $1',
                [session.userId],
              );
              if (u.rows[0]?.on) return;
            }
            const ua = session.userAgent ?? "";
            const kind = /Kaname-Bridge/i.test(ua) ? "bridge" : /Kaname-API/i.test(ua) ? "api" : "web";
            try {
              await o.appPool.query("select app.open_session($1, $2, $3, $4, $5)", [
                session.id,
                session.userId,
                kind,
                ua.slice(0, 200) || null,
                null,
              ]);
            } catch (e) {
              // 写せなかったら認証側のセッションも消してから上げる（半分だけ入った状態を残さない・K-301・G-15）
              await pool.query("delete from kaname_auth.session where id = $1", [session.id]).catch(() => undefined);
              throw e;
            }
            // 同意し直しの印（K-53・D-125.162）：今の版の利用規約かプライバシーポリシーにまだ同意していなければ、このセッションに立てる。
            //   パスワード・パスキー・2 段階の後・確認のメールで確定した直後のどれもこの hook を通る。Bridge のセッションには立てない（D-128.137）
            await o.appPool.query("select app.mark_session_terms($1)", [session.id]);
            // 新しい端末でのログインは本人に知らせる（画面の知らせは DB の関数が作る・メールはここ・D-125.140）
            const nd = await o.appPool.query<{ is_new: boolean }>(
              "select is_new from app.session_first_on_device($1, null, $2, $3)",
              [session.id, deviceOf(ua), (session as { ipAddress?: string | null }).ipAddress ?? null],
            );
            if (nd.rows[0]?.is_new && o.mailer) {
              const u = await pool.query<{ email: string }>('select email from kaname_auth."user" where id = $1', [
                session.userId,
              ]);
              const to = u.rows[0]?.email;
              const url = `${o.webBaseURL ?? o.baseURL}/settings/security`;
              if (to)
                await o
                  .mailer({
                    to,
                    subject: "Kaname に新しい端末からログインしました",
                    text: `新しい端末（${deviceOf(ua) ?? "不明"}）から Kaname にログインしました。心当たりが無ければ、すぐにパスワードを変えて、端末の一覧からこの端末を外してください。`,
                    url,
                    kind: "new_device",
                  })
                  .catch(() => undefined); // 知らせのメールが送れなくてもログインは止めない（画面の知らせは残る）
            }
          },
        },
      },
    },
  });
  // セッションが解けた要求に印を立てる（K-237）。口の答えの Server-Timing は印の立った要求にだけ付く（ログイン・登録・再設定の答えに文の数を出さない）
  const api = auth.api as unknown as { getSession: (...a: unknown[]) => Promise<unknown> };
  const getSession = api.getSession.bind(auth.api);
  api.getSession = async (...a: unknown[]) => {
    const s = await getSession(...a);
    if (s) markDbSession();
    return s;
  };
  return { auth: auth as unknown as Auth, pool };
}

/** 保留の申し込みに確認のリンクを送る（D-088）。文面はここだけに持つ。
 *  送れたかどうかを返す。呼ぶ側はそれを画面と保留の行に反映する（「送りました」と嘘をつかない・G-15） */
export async function sendPendingVerification(
  o: { mailer?: Mailer; baseURL: string; webBaseURL?: string },
  p: { email: string; token: string },
): Promise<{ sent: boolean; error: string | null; url: string }> {
  const url = `${o.webBaseURL ?? o.baseURL}/verify-email?token=${encodeURIComponent(p.token)}`;
  // ログにメールアドレスを出さない（宛先は印にする・K-51・TP-REG-14）。リンクは手元の開発の受信箱（/dev/mail）の代わりにだけ出し、
  // 試験（NODE_ENV=test）と本番には出さない
  const env = optionalEnv("NODE_ENV");
  if (env !== "production" && env !== "test") console.warn(`[auth] リンク（verify → ${mailTag(p.email)}）: ${url}`);
  if (!o.mailer) return { sent: false, error: "メールの送出先が設定されていない", url };
  try {
    await o.mailer({
      to: p.email,
      subject: "Kaname｜メールアドレスの確認（登録を確定する）",
      text: `Kaname の登録を確定するには、次のリンクを押してください。押した時点で登録が終わります。\n${url}\nこのリンクは 30 分で失効します。心当たりが無ければ、このメールは無視してください。`,
      url,
      kind: "verify",
    });
    return { sent: true, error: null, url };
  } catch (e) {
    return { sent: false, error: (e as Error).message || "送れませんでした", url };
  }
}
