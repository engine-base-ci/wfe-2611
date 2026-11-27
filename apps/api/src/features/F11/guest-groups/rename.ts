// ゲストのグループの名前を直す口（K-927）：updateGuestGroup（PATCH /api/v1/guest-groups/:id・D-155.51）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人（ゲストは 403）・上限・冪等・体の形（name だけ・知らない欄は 422）。
//   ① 名前の前後の空白を取る。空白だけ・81 字以上は 422・VALIDATION_ERROR（欄 name・K-876 の作る口と同じ）
//   ② 1 取引・文 1 つ（app.guest_group_rename）。権限（members の edit）・グループの確かめ・一意・証跡は DB の関数が持つ。
//      権限が無い → 403・FORBIDDEN／無い・消した・別の会社 → 404・E-GST-001／同じ名前（表記ゆらぎを含む）→ 409・E-GST-002（欄・details なし）／ほかは 503・E-PAGE-003
//   ③ 200 { data: { id, name } }。メール・お知らせは送らない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { badName, editRefused, NAME_MAX } from "./remove.js";

/** 名前は入れた字のまま（全角・（）を NFKC で崩さない・K927-API-001）。入口の a.input は表記ゆらぎをそろえた後なので、
 *  入口が確かめた体を読み直す（チケットの題名の createTicket と同じ形）。読めなければそろえた後の値 */
async function typedName(a: HookArgs): Promise<unknown> {
  try {
    const j: unknown = await a.c.req.json();
    if (
      typeof j === "object" &&
      j !== null &&
      !Array.isArray(j) &&
      typeof (j as Record<string, unknown>)["name"] === "string"
    )
      return (j as Record<string, unknown>)["name"];
  } catch {
    // 体を読み直せない（入口は読めている）ときは、そろえた後の値
  }
  return a.input["name"];
}

export function createRenameGuestGroup(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const raw = await typedName(a);
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name === "") return badName("ゲストのグループの名前を入れてください");
    if (Array.from(name).length > NAME_MAX) return badName(`${NAME_MAX} 文字まで`);
    try {
      const v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: { id: string; name: string } }>("select app.guest_group_rename($1::uuid, $2) as v", [
              a.id,
              name,
            ])
          ).rows[0]!.v,
      );
      return { status: 200, body: { data: { id: v.id, name: v.name } } };
    } catch (e) {
      return editRefused(e, "名前を直す");
    }
  };
}
