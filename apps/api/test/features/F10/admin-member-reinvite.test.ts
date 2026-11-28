// K-817「招き直しで戻すグループの役割の上限（app.restore_group_role・K-852 が使う）」の試験（本物の DB・土台 admin.harness.ts）。
//   行 ID（K817-DB-…）は 11_tickets/K-817.md の表と 1 対 1。規則は K-817.md の「前提と制約」：
//     戻すグループの役割＝「外す前のグループの役割」と「招いた役割（招待の role_id）が許す上限」の低いほう。
//     上限は admin・manager → manager／member → member／viewer・requester ほか → viewer。順は viewer < member < manager。外す前の役割が無ければ上限。
//   戻す振る舞い（外して 30 日のあいだに招き直すとグループと役割だけ戻る）は、実際に通る道の K-852（参加の関数 app.join_invitation の戻し）の試験が受ける。
//   この葉は引き金を作らない（F11 の案 x・PM の決め：新しいアカウントの道は受ける口が 409・E-INV-006 で止まり、引き金に届かない）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { setupAdmin } from "./admin.harness.js";

const h = setupAdmin();
const cap = async (old: string | null, invited: string) =>
  (await h.one<{ v: string }>("select app.restore_group_role($1, $2) as v", [old, invited])).v;

describe("K-817 招き直しで戻すグループの役割の上限（app.restore_group_role）", () => {
  it("K817-DB-001 上限の表：外す前の役割（manager・member・viewer・無し）× 招いた役割（admin・manager・member・viewer・requester）の 20 通りが、外す前と上限の低いほう（無しなら上限）", async () => {
    await h.ready();
    const want: Record<string, Record<string, string>> = {
      admin: { manager: "manager", member: "member", viewer: "viewer", none: "manager" },
      manager: { manager: "manager", member: "member", viewer: "viewer", none: "manager" },
      member: { manager: "member", member: "member", viewer: "viewer", none: "member" },
      viewer: { manager: "viewer", member: "viewer", viewer: "viewer", none: "viewer" },
      requester: { manager: "viewer", member: "viewer", viewer: "viewer", none: "viewer" },
    };
    for (const [invited, row] of Object.entries(want))
      for (const [old, v] of Object.entries(row))
        expect(await cap(old === "none" ? null : old, invited), `${old} × ${invited}`).toBe(v);
  });

  it("K817-DB-002 関数の形：引数 (text, text) で text を返す・immutable・public と kaname_app には execute を渡さない（K-852 の security definer の参加の関数の中からだけ呼ぶ）", async () => {
    await h.ready();
    const f = await h.one<{ vol: string; ret: string; pub: boolean; app: boolean }>(
      `select p.provolatile as vol, pg_get_function_result(p.oid) as ret,
              has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = 'restore_group_role' and pg_get_function_identity_arguments(p.oid) = 'p_old text, p_invited text'`,
    );
    expect(f).toEqual({ vol: "i", ret: "text", pub: false, app: false });
  });

  it("K817-DB-003 引き金は作らない（案 x）：招待の表に引き金 invitations_restore_member が無く、関数 app.member_restore_after_join も無い（受ける関数 app.accept_invitation の動きは今までと同じ）", async () => {
    await h.ready();
    expect(
      await h.num(
        "select count(*) as n from pg_trigger where tgname = 'invitations_restore_member' and not tgisinternal",
      ),
    ).toBe(0);
    expect(
      await h.num(
        "select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'member_restore_after_join'",
      ),
    ).toBe(0);
  });
});
