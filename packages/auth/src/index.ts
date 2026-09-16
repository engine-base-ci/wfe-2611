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
}

/** 型は core の Auth（plugin の endpoint 型は使わない＝zod の内部型を .d.ts に出さない） */
export type Auth = ReturnType<typeof betterAuth<BetterAuthOptions>>;

export function createAuth(o: AuthOptions): { auth: Auth; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: o.authDatabaseUrl, max: 5 });
  const auth = betterAuth({
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", casing: "snake", schemaName: "kaname_auth" },
    secret: o.secret,
    baseURL: o.baseURL,
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 },
    advanced: { database: { generateId: () => uuidv7() } },
    plugins: [twoFactor({ issuer: o.issuer ?? "Kaname" }), bearer()],
    databaseHooks: {
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
