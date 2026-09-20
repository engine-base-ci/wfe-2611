// 認証（Better Auth 1.7）。境界 B2：better-auth を import してよいのはこのパッケージだけ（CI G7）。
// 表は Postgres の schema "kaname_auth"（RLS の対象の public とは分ける。Supabase は schema auth を自社の認証に使うので同じ名前にしない：T-F-18）。失効の正は public.sessions（app.session_alive）。トークンの期限には頼らない。
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { PostgresDialect } from "kysely";
import pg from "pg";
import { uuidv7 } from "@kaname/db/id";

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
}
export interface Mail {
  to: string;
  subject: string;
  text: string;
  url: string;
  kind: "verify" | "reset";
}
export type Mailer = (m: Mail) => Promise<void>;

/** 型は core の Auth（plugin の endpoint 型は使わない＝zod の内部型を .d.ts に出さない） */
export type Auth = ReturnType<typeof betterAuth<BetterAuthOptions>>;

export function createAuth(o: AuthOptions): { auth: Auth; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: o.authDatabaseUrl, max: 5 });
  // 送出先が無ければリンクをログに出す（開発）。送出先があっても、本番以外はリンクを残す
  // （実際に送っていても、確かめる人が受信箱を開かずに先へ進めるように）
  const dev = process.env["NODE_ENV"] !== "production";
  const mail: Mailer = o.mailer
    ? async (m) => {
        if (dev) console.warn(`[auth] リンク（${m.kind} → ${m.to}）: ${m.url}`);
        await o.mailer!(m);
      }
    : async (m) => console.warn(`[auth] メールの送出先が無い（${m.kind} → ${m.to}）: ${m.url}`);
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
    },
    emailVerification: {
      sendOnSignUp: true,
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
    advanced: { database: { generateId: () => uuidv7() } },
    plugins: [twoFactor({ issuer: o.issuer ?? "Kaname" }), bearer()],
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
          after: async (session) => {
            const ua = session.userAgent ?? "";
            const kind = /Kaname-Bridge/i.test(ua) ? "bridge" : /Kaname-API/i.test(ua) ? "api" : "web";
            await o.appPool.query("select app.open_session($1, $2, $3, $4, $5)", [
              session.id,
              session.userId,
              kind,
              ua.slice(0, 200) || null,
              null,
            ]);
          },
        },
      },
    },
  });
  return { auth: auth as unknown as Auth, pool };
}
