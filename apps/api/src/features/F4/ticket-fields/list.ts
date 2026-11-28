// 会社が足す項目を読む口（K-563）：listTicketFields。読むだけ（DB に書かない・外も呼ばない）。
//   入力は問い合わせ kind_id（uuid・任意）だけ。cursor・limit は入口の共通の形の確かめだけで、全部を返す。
//   kind_id がある：その種別の行（custom_field_kinds・消していない）がある項目と、種別の行が 1 つも無い項目（全部の種別）。消した行も数える：消した行しか無い項目はどの種別にも出ない（自分で外した項目が出直さない）。
//   kind_id が無い：消していない項目を全部。並びは position の昇順・同じなら作った順・id。
//   種別が無い・消された・別の会社は 404（行の守りで見えない。field・details を付けない）。
//   取引は 1 つ（withTenant）・文は 1〜2 つ。ログに項目の名前・説明を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { toTicketField, type CustomFieldRow } from "./shape.js";

const KIND_SQL = "select 1 from ticket_kinds where id = $1::uuid and deleted_at is null";

const LIST_SQL = `select f.id, f.name, f.field_type, f.required, f.description, f.options, f.position
  from custom_fields f
 where f.tenant_id = app.tenant_id() and f.deleted_at is null
   and ($1::uuid is null
        or not exists (select 1 from custom_field_kinds k where k.field_id = f.id)
        or exists (select 1 from custom_field_kinds k where k.field_id = f.id and k.kind_id = $1::uuid and k.deleted_at is null))
 order by f.position, f.created_at, f.id`;

const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };

export function createListTicketFields(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const kindId = a.c.req.query("kind_id") || null;
    const rows = await withTenant(appPool, a.ctx, async (cl) => {
      if (kindId !== null && (await cl.query(KIND_SQL, [kindId])).rowCount === 0) return null;
      return (await cl.query<CustomFieldRow>(LIST_SQL, [kindId])).rows;
    });
    if (rows === null) return NOT_FOUND;
    return { status: 200, body: { data: rows.map(toTicketField) } };
  };
}
