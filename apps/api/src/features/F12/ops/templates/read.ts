// K-992 運営がひな形を読む口（listOpsTemplates・getOpsTemplate）（関門 C2・D-156.20・D-156.21・D-156.12・D-156.17）。
//   どちらも opsTx（運営の文脈の 1 つの取引）で関数を呼ぶだけ：一覧 app.ops_templates()・1 つ app.ops_template(id)。
//   distribute を持つ運営の人かは入口（契約の ops:distribute）と関数の頭（app.ops_require）の 2 層で確かめる。
//   DB の断りは opsErrorReply（42501 → 403／P0002 → 404 欄なし／ほか → 503 E-PAGE-003）。答えは Cache-Control: private, no-store
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

export interface OpsTemplatesDeps {
  appPool: pg.Pool;
}

const noStore = (a: HookArgs): void => {
  a.c.header("Cache-Control", "private, no-store");
};

export function createListOpsTemplates(d: OpsTemplatesDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const r = await opsTx(d.appPool, a.ctx, (c) =>
        c.query<{ r: { data: unknown[] } }>("select app.ops_templates() as r"),
      );
      noStore(a);
      return { status: 200, body: { data: r.rows[0]?.r.data ?? [] } };
    } catch (e) {
      return opsErrorReply(e, "templates");
    }
  };
}

export function createGetOpsTemplate(d: OpsTemplatesDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const r = await opsTx(d.appPool, a.ctx, (c) =>
        c.query<{ r: { data: unknown } }>("select app.ops_template($1::uuid) as r", [a.id]),
      );
      noStore(a);
      return { status: 200, body: { data: r.rows[0]?.r.data ?? null } };
    } catch (e) {
      return opsErrorReply(e, "templates");
    }
  };
}
