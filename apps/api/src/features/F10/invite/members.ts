// メンバーの並びを読む口（K-419）：getWorkspaceMembers。読むだけ（DB に書かない・外も呼ばない）。
//   入口の権限（members の view・会社全体）は契約の入口（op.ts）が先に確かめる。中身は DB の関数 app.workspace_members() が
//   呼んだ人の会社だけで作る（グループごとの人・兼ねる所属・招待中・PC の様子）。取引は 1 つ・文は 1 つ。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。ログインに使うメールの全体は、この会社の人の並びにしか出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export function createGetWorkspaceMembers(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const data = await withTenant(appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: unknown }>("select app.workspace_members() as v");
      return r.rows[0]!.v;
    });
    return { status: 200, body: { data } };
  };
}
