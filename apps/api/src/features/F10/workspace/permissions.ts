// 誰ができるかを変える口（K-829）：updateWorkspacePermissions（PATCH /api/v1/workspace/permissions・D-154.83）。
//   入口（op.ts）が先に確かめる：ログイン（401）・権限（管理者の束・403）・本人確認の取り直し（契約の step_up が always・403 STEP_UP_REQUIRED）・
//   上限・体の形（strict・知らない欄と文字でない値・null は 422）。口の中で本人確認をもう一度は見ない。順：
//   ⓪ 前処理（input）：送る欄が 1 つも無い・値が admin／admin_manager の外は 422・VALIDATION_ERROR（契約の anyOf・enum と同じ形）
//   ① 1 つの取引（app.workspace_permissions_set）で、会社ごとの錠 → 管理者か → 違う欄だけ書く → 変わったら記録 workspace.permissions_changed。
//      管理者でない → 403／DB が落ちた → 503・E-PAGE-003（何も残らない）
//   ② 200 { data: { permissions: [{ key, value }] } }（今の 2 つの値。同じ値への変更も 200・記録は書かない）
//   ログには場所と例外の種類だけを書く
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import type { Row } from "@kaname/db/repository";

/** 変えられる 2 つの欄と、取れる 2 つの値（書き出し export は作らない・D-154.4） */
export const PERMISSION_KEYS = ["billing", "delete_workspace"] as const;
export const PERMISSION_VALUES = ["admin", "admin_manager"] as const;

type Detail = { field: string; message: string };
const invalid = (details: Detail[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** 口の前処理：1 つ以上・値は 2 つだけ。形（strict・型）の確かめは入口が続けて契約の形でする */
export function checkPermissionsInput(raw: unknown): { input: Row } | { reply: HookReply } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Row };
  const body = raw as Record<string, unknown>;
  const sent = PERMISSION_KEYS.filter((k) => has(body, k));
  if (sent.length === 0)
    return { reply: invalid([{ field: "body", message: "billing か delete_workspace のどちらかを送ってください" }]) };
  const bad = sent.filter(
    (k) => typeof body[k] !== "string" || !(PERMISSION_VALUES as readonly string[]).includes(body[k] as string),
  );
  if (bad.length > 0) return { reply: invalid(bad.map((field) => ({ field, message: PERMISSION_VALUES.join("／") }))) };
  return { input: body as Row };
}

/** DB の関数が断った例外 → 答え。分からない例外は 503（何も残らない） */
function refused(e: unknown): HookReply {
  const code = kindOf(e);
  if (code === "42501") return FORBIDDEN;
  if (code === "22023") return invalid([{ field: "body", message: PERMISSION_VALUES.join("／") }]);
  console.error(`[workspace-permissions] 誰ができるかを変える取引が落ちた（${code}）`);
  return unavailable();
}

export function createUpdateWorkspacePermissions(d: Pick<HookDeps, "appPool">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const change = Object.fromEntries(
      PERMISSION_KEYS.filter((k) => typeof a.input[k] === "string").map((k) => [k, a.input[k]]),
    );
    try {
      const v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { permissions: { key: string; value: string }[] } }>(
          "select app.workspace_permissions_set($1::jsonb) as v",
          [JSON.stringify(change)],
        );
        return r.rows[0]!.v;
      });
      return { status: 200, body: { data: { permissions: v.permissions } } };
    } catch (e) {
      return refused(e);
    }
  };
}
