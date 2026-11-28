// K-812「グループを移す・兼ねる口（updateMemberGroups：主の所属は 1 つ・兼務）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K812-API-…／K812-DB-…）は 11_tickets/K-812.md の表と 1 対 1。入力と答えの形は K-800 の契約（MemberGroupsInput・MemberGroupsChanged）：
//     updateMemberGroups PATCH /members/:id/groups ← { primary_scope_id?, add_scope_ids?, remove_scope_ids?, role_key? }（どれか 1 つは要る）
//       → 200 { data: { member_id, company_role, groups: [{ id, name, code, primary, role }] } }
//     primary_scope_id＝主の所属を移す（前の主のグループからは外れる）／add_scope_ids＝兼ねるグループを足す（役割は role_key・既定 member）／remove_scope_ids＝兼ねるグループを外す。
//     本人確認の取り直しが要る（入口）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const move = (p: P, who: { id: string }, body: Record<string, unknown>, o: { su?: number } = {}) =>
  h.call(p, "PATCH", `/members/${who.id}/groups`, { body, su: o.su ?? h.suNow() });
const seats = (memberId: string) =>
  h.rows<{ scope_id: string; role: string; is_primary: boolean }>(
    "select scope_id, role, is_primary from scope_memberships where member_id = $1 and deleted_at is null order by is_primary desc, scope_id",
    [memberId],
  );
const primaryOf = async (memberId: string) =>
  (await h.one<{ scope_id: string }>("select scope_id from members where id = $1", [memberId])).scope_id;
const names = (w: World, d: { groups: { id: string; primary: boolean; role: string | null }[] }) =>
  d.groups.map(
    (g) => `${g.id === w.eg ? "営業" : g.id === w.jd ? "受託開発" : "経理"}:${g.primary ? "主" : "兼"}:${g.role}`,
  );
const noAudit = async (w: World) => expect(await h.audits(w.tenantId, "member.groups_change")).toBe(0);

describe("K-812 グループを移す・兼ねる口（updateMemberGroups）", () => {
  it("K812-API-001 兼ねるグループを足す：200・鍵がちょうど 3・兼務の行（is_primary false・役割は role_key で既定 member）・主の所属は変わらない・証跡 member.groups_change 1 行（グループの id と数だけ）・相手のセッションが切れる（G-14）", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query("insert into sessions (tenant_id, member_id, kind_id) values ($1, $2, 'web')", [
      w.tenantId,
      w.member.id,
    ]);
    const r = await move(w.admin, w.member, { add_scope_ids: [w.jd] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as {
      member_id: string;
      company_role: string;
      groups: { id: string; primary: boolean; role: string | null }[];
    };
    expect(Object.keys(d).sort()).toEqual(["company_role", "groups", "member_id"]);
    expect(names(w, d)).toEqual(["営業:主:member", "受託開発:兼:member"]);
    expect(await primaryOf(w.member.id)).toBe(w.eg);
    expect(await seats(w.member.id)).toEqual(
      expect.arrayContaining([{ scope_id: w.jd, role: "member", is_primary: false }]),
    );
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'member.groups_change'",
      [w.tenantId],
    );
    expect(a.payload).toEqual({ from_primary: w.eg, to_primary: w.eg, added: [w.jd], removed: [] });
    expect(
      (await h.one<{ revoked_at: Date | null }>("select revoked_at from sessions where member_id = $1", [w.member.id]))
        .revoked_at,
    ).not.toBeNull();
  });

  it("K812-API-002 兼務を通す（D-154.15）：別の部署に作業員として入れ（role_key member）・違う層のグループのマネージャーを兼ねさせ（role_key manager）・1 つ外せる。グループごとに別の役割", async () => {
    await h.ready();
    const w = await h.world();
    expect((await move(w.admin, w.mgr, { add_scope_ids: [w.jd], role_key: "member" })).status).toBe(200);
    expect((await move(w.admin, w.mgr, { add_scope_ids: [w.ac], role_key: "manager" })).status).toBe(200);
    expect((await seats(w.mgr.id)).map((s) => `${s.role}:${s.is_primary}`).sort()).toEqual([
      "manager:false",
      "manager:true",
      "member:false",
    ]);
    const r = await move(w.admin, w.mgr, { remove_scope_ids: [w.jd] });
    expect(names(w, (await h.json(r)).data as never)).toEqual(["営業:主:manager", "経理:兼:manager"]);
  });

  it("K812-API-003 主の所属を移す：members.scope_id が新しいグループ・新しい行は is_primary true（役割は role_key）・前の主のグループの行は外れる・主の行はちょうど 1 つ・答えの groups は主が先", async () => {
    await h.ready();
    const w = await h.world();
    const r = await move(w.admin, w.member, { primary_scope_id: w.jd, role_key: "manager" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await primaryOf(w.member.id)).toBe(w.jd);
    expect(await seats(w.member.id)).toEqual([{ scope_id: w.jd, role: "manager", is_primary: true }]);
    expect(names(w, (await h.json(r)).data as never)).toEqual(["受託開発:主:manager"]);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'member.groups_change'",
      [w.tenantId],
    );
    expect(a.payload).toMatchObject({ from_primary: w.eg, to_primary: w.jd });
  });

  it("K812-API-004 移しても前のグループを兼務に残す（移すと足すを一緒に）・移す先が今の兼務ならその行の役割を保ったまま主にする", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [w.tenantId, w.jd, w.member.id],
    );
    const r = await move(w.admin, w.member, { primary_scope_id: w.jd, add_scope_ids: [w.eg] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(names(w, (await h.json(r)).data as never)).toEqual(["受託開発:主:manager", "営業:兼:member"]);
    expect(await primaryOf(w.member.id)).toBe(w.jd);
    expect((await seats(w.member.id)).filter((s) => s.is_primary).length).toBe(1);
  });

  it("K812-API-005 兼務を外す：外すと行が外れる・主の所属は外せない（409・E-MEM-008）・居ないグループを外す → 409・E-MEM-007・どれも欄・details なし", async () => {
    await h.ready();
    const w = await h.world();
    await move(w.admin, w.member, { add_scope_ids: [w.jd] });
    expect((await move(w.admin, w.member, { remove_scope_ids: [w.jd] })).status).toBe(200);
    expect((await seats(w.member.id)).map((s) => s.scope_id)).toEqual([w.eg]);
    for (const [b, code] of [
      [{ remove_scope_ids: [w.eg] }, "E-MEM-008"],
      [{ remove_scope_ids: [w.ac] }, "E-MEM-007"],
    ] as const) {
      const r = await move(w.admin, w.member, b);
      expect(r.status, code).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect((await seats(w.member.id)).length).toBe(1);
  });

  it("K812-API-006 外してまた足す：外した行は復活する（重ならない・行は 1 つ）・同じ体に足すと外すがあれば外してから足す（役割は role_key に入れ替わる）", async () => {
    await h.ready();
    const w = await h.world();
    await move(w.admin, w.member, { add_scope_ids: [w.jd], role_key: "manager" });
    await move(w.admin, w.member, { remove_scope_ids: [w.jd] });
    expect((await move(w.admin, w.member, { add_scope_ids: [w.jd], role_key: "viewer" })).status).toBe(200);
    expect((await seats(w.member.id)).filter((s) => s.scope_id === w.jd)).toEqual([
      { scope_id: w.jd, role: "viewer", is_primary: false },
    ]);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and scope_id = $2", [
        w.member.id,
        w.jd,
      ]),
    ).toBe(1);
    expect(
      (await move(w.admin, w.member, { add_scope_ids: [w.jd], remove_scope_ids: [w.jd], role_key: "manager" })).status,
    ).toBe(200);
    expect((await seats(w.member.id)).find((s) => s.scope_id === w.jd)!.role).toBe("manager");
  });

  it("K812-API-007 グループが無い（無い id・別の会社・消した）：どの欄でも 404・E-MEM-006（欄・details なし）・全部か無しか（良い指定が混じっていても何も変えない）", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.addScope(w.tenantId, "消した", "DD", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    const before = await seats(w.member.id);
    for (const bad of [randomUUID(), w.other.rootScope, gone])
      for (const b of [{ primary_scope_id: bad }, { add_scope_ids: [w.jd, bad] }, { remove_scope_ids: [bad] }]) {
        const r = await move(w.admin, w.member, b);
        expect(r.status, JSON.stringify(b)).toBe(404);
        const j = await h.json(r);
        expect(j.code).toBe("E-MEM-006");
        expect(j.field).toBeUndefined();
        expect(j.details).toBeUndefined();
      }
    expect(await seats(w.member.id)).toEqual(before);
    await noAudit(w);
  });

  it("K812-API-008 自分は変えられない（409・E-MEM-003）・相手が無い（無い id・別の会社・外した人・消した人・AI）は 404・E-MEM-002（欄・details なし）", async () => {
    await h.ready();
    const w = await h.world();
    const self = await move(w.admin, w.admin, { add_scope_ids: [w.jd] });
    expect(self.status).toBe(409);
    expect((await h.json(self)).code).toBe("E-MEM-003");
    const left = await h.make(w, "left", "外した人", { status: "left" });
    const gone = await h.make(w, "gone", "消した人");
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const ai = (
      await h.one<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'ai_employee', 'AI') returning id",
        [w.tenantId, w.eg],
      )
    ).id;
    for (const id of [randomUUID(), w.outsider.id, left.id, gone.id, ai]) {
      const r = await move(w.admin, { id }, { add_scope_ids: [w.jd] });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-002");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    await noAudit(w);
  });

  it("K812-API-009 何も変わらない指定（今の主を主に・居るグループを足す）：200・行も証跡も増えない・セッションも切れない", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query("insert into sessions (tenant_id, member_id, kind_id) values ($1, $2, 'web')", [
      w.tenantId,
      w.member.id,
    ]);
    expect((await move(w.admin, w.member, { primary_scope_id: w.eg })).status).toBe(200);
    await move(w.admin, w.member, { add_scope_ids: [w.jd] });
    const n = await h.audits(w.tenantId, "member.groups_change");
    await h.f.admin.query("update sessions set revoked_at = null where member_id = $1", [w.member.id]);
    expect((await move(w.admin, w.member, { add_scope_ids: [w.jd, w.eg] })).status).toBe(200);
    expect(await h.audits(w.tenantId, "member.groups_change")).toBe(n);
    expect(
      (await h.one<{ revoked_at: Date | null }>("select revoked_at from sessions where member_id = $1", [w.member.id]))
        .revoked_at,
    ).toBeNull();
  });

  it("K812-API-010 入力の形：体が空・役割が owner・admin・グループの数 21・uuid でない・知らない欄（scope_id・tenant_id）→ 422・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await seats(w.member.id);
    const bad: Record<string, unknown>[] = [
      {},
      { add_scope_ids: [w.jd], role_key: "owner" },
      { add_scope_ids: [w.jd], role_key: "admin" },
      { add_scope_ids: Array.from({ length: 21 }, () => randomUUID()) },
      { remove_scope_ids: Array.from({ length: 21 }, () => randomUUID()) },
      { primary_scope_id: "受託開発" },
      { add_scope_ids: ["x"] },
      { scope_id: w.jd },
      { add_scope_ids: [w.jd], tenant_id: w.other.tenantId },
    ];
    for (const b of bad) expect((await move(w.admin, w.member, b)).status, JSON.stringify(b).slice(0, 60)).toBe(422);
    expect(await seats(w.member.id)).toEqual(before);
    await noAudit(w);
  });

  it("K812-API-011 本人確認と権限：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・1 分前は通る。members の edit を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403・ログインしていない 401", async () => {
    await h.ready();
    const w = await h.world();
    for (const su of [undefined, h.suAgo(16)]) {
      const r = await h.call(w.admin, "PATCH", `/members/${w.member.id}/groups`, {
        body: { add_scope_ids: [w.jd] },
        ...(su === undefined ? {} : { su }),
      });
      expect(r.status).toBe(403);
      expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect((await move(w.admin, w.member, { add_scope_ids: [w.jd] }, { su: h.suAgo(1) })).status).toBe(200);
    const granted = await h.make(w, "granted", "所属を直す権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, granted.id],
    );
    expect((await move(granted, w.mgr, { add_scope_ids: [w.ac] })).status).toBe(200);
    for (const p of [w.mgr, w.viewer, w.stopped])
      expect((await move(p, w.member, { add_scope_ids: [w.ac] })).status, p.name).toBe(403);
    expect((await h.f.req("PATCH", `/members/${w.member.id}/groups`, { body: { add_scope_ids: [w.ac] } })).status).toBe(
      401,
    );
  });

  it("K812-API-012 操作の揺れ（G-16）：同じ人の主の所属を 2 人が同時に別のグループへ移す → どちらも 200・主の行はちょうど 1 つ・members.scope_id と主の行が同じグループ", async () => {
    await h.ready();
    const w = await h.world();
    const rs = await Promise.all([
      move(w.admin, w.member, { primary_scope_id: w.jd }),
      move(w.admin2, w.member, { primary_scope_id: w.ac }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const s = await seats(w.member.id);
    expect(s.filter((x) => x.is_primary).length).toBe(1);
    expect(s.find((x) => x.is_primary)!.scope_id).toBe(await primaryOf(w.member.id));
  });

  it("K812-API-013 失敗（手順 S1）：所属の行・members の主の更新・証跡で DB が落ちる → 503・E-PAGE-003・所属も主も証跡も前のまま。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const before = await seats(w.member.id);
    for (const [table, op, body] of [
      ["scope_memberships", "insert", { add_scope_ids: [w.jd] }],
      ["scope_memberships", "update", { primary_scope_id: w.jd }],
      ["members", "update", { primary_scope_id: w.ac }],
      ["audit_events", "insert", { add_scope_ids: [w.ac] }],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await move(w.admin, w.member, body);
        expect(r.status, `${table} ${op}`).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await seats(w.member.id)).toEqual(before);
    expect(await primaryOf(w.member.id)).toBe(w.eg);
    await noAudit(w);
    expect((await move(w.admin, w.member, { add_scope_ids: [w.jd] })).status).toBe(200);
  });

  it("K812-DB-014 守り：kaname_app から直に呼べるのは app.member_groups_change だけ。直す権限の無い人が直に呼ぶと forbidden・行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await seats(w.mgr.id);
    const v = (
      await h.asOwner<{ v: { error?: string } }>(
        w.member,
        "select app.member_groups_change($1::uuid, $2::jsonb) as v",
        [w.mgr.id, JSON.stringify({ add_scope_ids: [w.jd] })],
      )
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    expect(await seats(w.mgr.id)).toEqual(before);
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.member_groups_change($1::uuid, $2::jsonb) as v", [
        w.mgr.id,
        JSON.stringify({ add_scope_ids: [w.jd] }),
      ])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });

  it("K812-API-015 止めている人のグループを移す・足す：200・主の所属が受託開発・経理に兼務の行・止めている間は役割の束の権限の行が無い（0080 は status active の人にだけ束を作る）・戻す（status active）と束の行ができる", async () => {
    await h.ready();
    const w = await h.world();
    const bundles = () =>
      h.num("select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null", [
        w.stopped.id,
      ]);
    const r = await move(w.admin, w.stopped, { primary_scope_id: w.jd, add_scope_ids: [w.ac] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await primaryOf(w.stopped.id)).toBe(w.jd);
    expect(await seats(w.stopped.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope_id: w.jd, is_primary: true }),
        expect.objectContaining({ scope_id: w.ac, is_primary: false }),
      ]),
    );
    expect(await bundles()).toBe(0);
    await h.f.admin.query("update members set suspended_at = null, suspended_by = null where id = $1", [w.stopped.id]);
    await h.f.admin.query("update tenant_memberships set status = 'active' where member_id = $1 and tenant_id = $2", [
      w.stopped.id,
      w.tenantId,
    ]);
    expect(await bundles()).toBeGreaterThan(0);
  });
});
