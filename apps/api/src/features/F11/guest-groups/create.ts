// ゲストのグループを作る口（K-876）：createGuestGroup（POST /api/v1/guest-groups・D-155.40・D-155.51）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人（ゲストは 403）・上限・冪等・体の形（name・request_scope_id。知らない欄は 422）。順：
//   ① 名前は入れた字のまま（NFKC で崩さない・K-927 の直す口と同じ）で、前後の空白を取る。空白だけは 422・VALIDATION_ERROR（欄 name）。届け先が無い・文字でないも 422（欄 request_scope_id）
//   ② 1 つの取引（app.guest_group_create）で、グループの行と証跡 guest_group.created を書く。権限（members の invite か edit）は関数が確かめる。
//      権限が無い → 403・FORBIDDEN／届け先の社内のグループが無い・消した・別の会社 → 404・E-GST-003／同じ名前（表記ゆらぎを含む）→ 409・E-GST-002。
//      404・409 は欄・details を付けない（在る名前・在るグループを漏らさない）。ほかは 503・E-PAGE-003（何も残らない・ログは例外の種類だけ）
//   ③ 201 { group: { id, name, request_scope: { id, name } } }
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { typedName } from "./rename.js";

// DB の断りの読み方（一覧の口 list.ts も使う）

/** DB の例外の番号（42501・22023 など）。無ければ空 */
export const pgCode = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "";
};
/** DB の例外の hint（E-GST-002 など）。無ければ空 */
export const pgHint = (e: unknown): string => {
  const h = (e as { hint?: unknown } | null)?.hint;
  return typeof h === "string" ? h : "";
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** 名前の長さ（DB の check と契約の maxLength と同じ 80 字） */
const NAME_MAX = 80;

const badField = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** DB の関数が断った例外 → 答え。分からない例外は 503（何も残らない） */
function refused(e: unknown): HookReply {
  const code = pgCode(e);
  const hint = pgHint(e);
  if (code === "22023" && hint === "E-GST-002") return { status: 409, body: kanameError("E-GST-002").toJSON() };
  if (code === "42501" && hint === "E-GST-003") return { status: 404, body: kanameError("E-GST-003").toJSON() };
  if (code === "42501") return forbidden();
  console.error(`[guest-groups] ゲストのグループを作れなかった（${kindOf(e)}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}

export function createCreateGuestGroup(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    // 名前は入れた字のまま（全角・（）を NFKC で崩さない）。直す口 renameGuestGroup と同じ読み方（K927-API-001）
    const raw = await typedName(a);
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name === "") return badField("name", "ゲストのグループの名前を入れてください");
    if (Array.from(name).length > NAME_MAX) return badField("name", `${NAME_MAX} 文字まで`);
    const scope = a.input["request_scope_id"];
    if (typeof scope !== "string" || scope === "")
      return badField("request_scope_id", "依頼が届くグループを選んでください");
    try {
      const group = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.guest_group_create($1, $2::uuid) as v", [name, scope]);
        return r.rows[0]!.v;
      });
      return { status: 201, body: { data: { group } } };
    } catch (e) {
      return refused(e);
    }
  };
}
