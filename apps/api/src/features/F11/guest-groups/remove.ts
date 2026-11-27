// ゲストのグループを消す口（K-927）：deleteGuestGroup（DELETE /api/v1/guest-groups/:id・D-155.46）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人（ゲストは 403）・上限・道の :id の uuid。
//   1 取引・文 1 つ（app.guest_group_delete）：見せる相手を外す・中のゲストを会社から抜けた扱い（セッションを切る）・受けていない招待を取り消す・
//   グループに deleted_at・証跡。チケット・依頼・やり取りは残る。メール・お知らせは送らない。
//   権限が無い → 403・FORBIDDEN／無い・消した（2 回目）・別の会社 → 404・E-GST-001（欄・details なし）／ほかは 503・E-PAGE-003（何も残らない）
//   200 { data: { id } }。直す口（rename.ts）と断りの読み替えを分け合う
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 名前の長さ（DB の check と契約の maxLength と同じ 80 字） */
export const NAME_MAX = 80;

/** 正本のエラーを、欄なし・detail なしの形で */
const bare = (status: number, code: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 名前の形の誤り（422・欄 name） */
export const badName = (message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "name", message }] },
});

/** DB の関数の断り → 答え。分からない例外は 503（何も残らない・ログは例外の種類だけ） */
export function editRefused(e: unknown, where: string): HookReply {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  const code = str(x.code);
  const hint = str(x.hint);
  if (code === "42501" && hint === "E-GST-001") return bare(404, "E-GST-001");
  if (code === "22023" && hint === "E-GST-002") return bare(409, "E-GST-002");
  if (code === "42501") return forbidden();
  console.error(`[guest-groups] ゲストのグループを${where}：例外（${kindOf(e)}）なので止める側に倒した`);
  return bare(503, "E-PAGE-003");
}

export function createDeleteGuestGroup(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    if (!a.id) return bare(404, "E-GST-001");
    try {
      const v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: { id: string } }>("select app.guest_group_delete($1::uuid) as v", [a.id])).rows[0]!.v,
      );
      return { status: 200, body: { data: { id: v.id } } };
    } catch (e) {
      return editRefused(e, "消す");
    }
  };
}
