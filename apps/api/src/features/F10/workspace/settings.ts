// 設定を読む口（K-827）：getWorkspaceSettings（GET /api/v1/workspace・D-154.4・D-154.5・D-154.16・D-154.22・D-154.83）。読むだけ。
//   入口（op.ts）は write の言葉（ログインした会社の人だけ・運営は通さない）だけを見る。開けるかは口の中で決める：
//   DB の関数 app.workspace_settings() が、管理者か app.workspace_can('billing'／'delete_workspace') が可の人だけに答え、
//   どちらでもなければ 42501 → 403（data なし）。取引は 1 つ・関数は 1 つ。
//   答え：{ workspace: { id, name, logo }, permissions, fixed_rules, deletion, access }。
//   プランと支払い・取引先の見える人の既定・依頼の届け先・書き出しは読まない（段 13 の口・D-154.22・D-154.4）。
//   ロゴは置き場（関門 C4）の期限つき URL。作れなければ文字（頭文字）に落とす。Cache-Control: private, no-store は入口が付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { TenantContext } from "@kaname/db/context";
import type { ObjectStore } from "@kaname/storage";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { kanameError } from "@kaname/errors";

/** 例外の DB の番号（無ければ空）。文や値はログに出さない */
export const pgCode = (e: unknown): string => {
  const x = e as { code?: unknown } | null;
  return typeof x?.code === "string" ? x.code : "";
};
/** 権限が無い（403・data なし） */
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
/** DB が落ちた（503・E-PAGE-003） */
export const dbFailed = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

/** ロゴの期限つき URL の長さ（秒） */
const LOGO_TTL_SEC = 600;
/** 「誰ができるか」の値（管理者／管理者とマネージャー）。画面の字は画面が値から作る */
export const WHO_OPTIONS = ["admin", "admin_manager"] as const;
/** 「誰ができるか」の 2 つ（書き出しは作らない・D-154.4）。字は下絵 st-view の字が正 */
const WHO_ROWS = [
  { key: "billing", name: "プランと支払い", detail: "プランを変える・請求書を見る" },
  { key: "delete_workspace", name: "ワークスペースを消す", detail: "消す手続きを始める" },
] as const;
/** 決まっている物（画面の SettingNote の元・D-128.98・D-127.9）。字は下絵 st-view の字が正 */
const FIXED_RULES = [
  { key: "passkey", text: "ログインはパスキーを勧めます。" },
  {
    key: "two_factor",
    text: "2 段階認証はそれぞれが自分の設定で付けられ、パスキーを持たずパスワードだけで入る人は必須です。",
  },
  { key: "idle_timeout", text: "操作がないと 12 時間で切れます。" },
  {
    key: "reconfirm",
    text: "PC が閉じている間に承認した仕事は、承認から 24 時間を過ぎると実行の前にもう一度聞きます（どちらも決まっていて、変えられません）",
  },
] as const;

export interface WorkspaceRow {
  id: string;
  name: string;
  logo_ref: string | null;
}
export type Logo = { kind: "text"; url: null } | { kind: "image"; url: string };

interface SettingsRow {
  workspace: WorkspaceRow;
  who: { billing: string; delete_workspace: string };
  deletion: Record<string, unknown>;
  access: { admin: boolean; billing: boolean; delete_workspace: boolean };
}

/** ロゴ：ref が無ければ文字。在れば置き場の期限つき URL（作れなければ文字に落とす） */
export async function logoOf(objects: ObjectStore, ctx: TenantContext, ref: string | null): Promise<Logo> {
  if (!ref) return { kind: "text", url: null };
  try {
    const r = await objects.signUrl(ctx, ref, LOGO_TTL_SEC);
    if (r.status === "done") return { kind: "image", url: r.value.url };
  } catch {
    console.error("[workspace] ロゴの URL を作れなかった");
  }
  return { kind: "text", url: null };
}

export const workspaceOf = async (objects: ObjectStore, ctx: TenantContext, w: WorkspaceRow) => ({
  id: w.id,
  name: w.name,
  logo: await logoOf(objects, ctx, w.logo_ref),
});

export function createGetWorkspaceSettings(d: { appPool: pg.Pool; objects: ObjectStore }) {
  return async (a: HookArgs): Promise<HookReply> => {
    let row: SettingsRow;
    try {
      row = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: SettingsRow }>("select app.workspace_settings() as v");
        return r.rows[0]!.v;
      });
    } catch (e) {
      if (pgCode(e) === "42501") return forbidden();
      console.error(`[workspace] 設定を読めなかった（${pgCode(e) || "Error"}）`);
      return dbFailed();
    }
    const permissions = WHO_ROWS.map((w) => ({
      key: w.key,
      name: w.name,
      detail: w.detail,
      value: row.who[w.key],
      options: [...WHO_OPTIONS],
    }));
    return {
      status: 200,
      body: {
        data: {
          workspace: await workspaceOf(d.objects, a.ctx, row.workspace),
          permissions,
          fixed_rules: FIXED_RULES.map((f) => ({ ...f })),
          deletion: row.deletion,
          access: row.access,
        },
      },
    };
  };
}
