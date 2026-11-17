// K-308 自分の安全の設定を読む（契約の口 getMySecurity・GET /api/v1/me/security）。
//   上限（1 分に 120 回・人ごと）・認証（ログインしていなければ 401）・同意し直しの止めは契約の入口（op.ts）が先に確かめる。本人だけの口で役を見ない。
//   入り方の数とこのセッションの印は DB の関数 1 回（app.login_methods・app.session_mfa_pending。認証の表は security definer の中だけで読む・D-128.119）。
//   パスキーの一覧は認証の接続で読み、決めた 5 つの欄だけを返す。バックアップコードは部品（viewBackupCodes・サーバーだけ）で数え、中身は返さない（関門 C8）。
//   last_used_at は部品の表に列が無いので null（段 2・PM が決めた作り方 2026-11-17）。
//   返さないもの：公開鍵・credential_id・TOTP の鍵・バックアップコードの中身・端末の一覧・安全の記録（ログにも出さない）
import type pg from "pg";
import { listPasskeysOf, type Auth } from "@kaname/auth";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface MySecurityDeps {
  auth: Auth;
  /** 業務の接続（kaname_app）。入り方を数える関数と印を読む */
  appPool: pg.Pool;
  /** 認証の接続（kaname_auth）。パスキーの一覧を読む */
  authPool: pg.Pool;
}
export interface MySecurityPasskey {
  id: string;
  name: string;
  created_at: string | null;
  last_used_at: string | null;
  synced: boolean;
}
export interface MySecurity {
  passkeys: MySecurityPasskey[];
  has_password: boolean;
  two_factor: boolean;
  two_factor_required: boolean;
  backup_codes_left: number;
  mfa_pending: boolean;
}

/** 入口（op.ts）の 401 と同じ形 */
const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

/** 2 段階を使うと決めなければならない人か：パスワードがあり、パスキーが 0 本で、2 段階が無い（D-128.61） */
export const twoFactorRequired = (s: { has_password: boolean; passkeys: number; two_factor: boolean }): boolean =>
  s.has_password && s.passkeys === 0 && !s.two_factor;

export function mySecurityFeature(d: MySecurityDeps) {
  /** 残っているバックアップコードの数（部品がサーバーの中だけで開く。中身はここで捨てる） */
  const backupCodesLeft = async (userId: string): Promise<number> => {
    const api = d.auth.api as unknown as {
      viewBackupCodes: (x: { body: { userId: string } }) => Promise<{ backupCodes?: unknown }>;
    };
    const r = await api.viewBackupCodes({ body: { userId } });
    return Array.isArray(r.backupCodes) ? r.backupCodes.length : 0;
  };

  const read = async (a: HookArgs): Promise<HookReply> => {
    try {
      const s = await d.auth.api.getSession({ headers: a.c.req.raw.headers });
      if (!s) return unauthenticated;
      const userId = s.user.id;
      const r = await d.appPool.query<{
        passkeys: number;
        has_password: boolean;
        two_factor: boolean;
        mfa: boolean | null;
      }>(
        `select m.passkeys, m.has_password, m.two_factor,
                (select app.session_mfa_pending(x.session_id) from app.session_alive($2) x) as mfa
           from app.login_methods($1) m`,
        [userId, s.session.id],
      );
      const m = r.rows[0];
      if (!m) return unauthenticated;
      const passkeys = await listPasskeysOf(d.authPool, userId);
      const data: MySecurity = {
        passkeys: passkeys.map((p) => ({
          id: p.id,
          name: p.name ?? "",
          created_at: iso(p.createdAt),
          last_used_at: null,
          synced: p.backedUp,
        })),
        has_password: m.has_password,
        two_factor: m.two_factor,
        two_factor_required: twoFactorRequired({ ...m, passkeys: passkeys.length }),
        backup_codes_left: m.two_factor ? await backupCodesLeft(userId) : 0,
        mfa_pending: m.mfa === true,
      };
      return { status: 200, body: { data } };
    } catch (e) {
      console.error(`[security] 安全の設定を読めなかった（${kindOf(e)}）`);
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };

  return { read };
}
