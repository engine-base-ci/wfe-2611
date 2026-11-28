// K-811「役割を変える口（updateMemberRole：グループごとの役割と管理者）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K811-API-…／K811-DB-…）は 11_tickets/K-811.md の表と 1 対 1。入力と答えの形は K-800 の契約（MemberRoleInput・MemberRoleChanged）：
//     updateMemberRole PATCH /members/:id/role ← { role_key: "manager" | "member" | "viewer" | "admin", scope_id? }
//       → 200 { data: { member_id, company_role, groups: [{ id, name, code, primary, role }] } }
//     role_key が admin なら会社全体の管理者（scope_id は見ない）。ほかは scope_id のグループ（無ければ主の所属）での役割。本人確認の取り直しが要る（入口）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const role = (w: World, p: P, who: { id: string }, body: Record<string, unknown>, o: { su?: number } = {}) =>
  h.call(p, "PATCH", `/members/${who.id}/role`, { body, su: o.su ?? h.suNow() });
const seat = (scopeId: string, memberId: string) =>
  h.rows<{ role: string; is_primary: boolean }>(
    "select role, is_primary from scope_memberships where scope_id = $1 and member_id = $2 and deleted_at is null",
    [scopeId, memberId],
  );
const company = async (id: string) =>
  (await h.one<{ role: string }>("select role from tenant_memberships where member_id = $1", [id])).role;
const adminCount = (w: World) =>
  h.num("select count(*) as n from tenant_memberships where tenant_id = $1 and role = 'admin' and status = 'active'", [
    w.tenantId,
  ]);
const nothing = async (w: World, id: string) => {
  expect(await h.audits(w.tenantId, "member.role_change")).toBe(0);
  return company(id);
};

describe("K-811 役割を変える口（updateMemberRole）", () => {
  it("K811-API-001 管理者にする（role_key admin）：200・鍵がちょうど 3・company_role admin・DB の会社の役割が admin・グループの行は変わらない・証跡 member.role_change 1 行（payload は scope_id null・from・to だけ）・その人の画面のセッションは切れる（G-14）", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query("insert into sessions (tenant_id, member_id, kind_id) values ($1, $2, 'web')", [
      w.tenantId,
      w.member.id,
    ]);
    const r = await role(w, w.admin, w.member, { role_key: "admin" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["company_role", "groups", "member_id"]);
    expect(d).toMatchObject({ member_id: w.member.id, company_role: "admin" });
    expect(await company(w.member.id)).toBe("admin");
    expect(await seat(w.eg, w.member.id)).toEqual([{ role: "member", is_primary: true }]);
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'member.role_change'",
      [w.tenantId],
    );
    expect(a.payload).toEqual({ scope_id: null, from: "member", to: "admin" });
    const s = await h.one<{ revoked_at: Date | null }>("select revoked_at from sessions where member_id = $1", [
      w.member.id,
    ]);
    expect(s.revoked_at).not.toBeNull();
  });

  it("K811-API-002 管理者を下げる（2 人いるうち 1 人）：company_role が member・主のグループの役割が member の行になる・管理者の数は 1 になる", async () => {
    await h.ready();
    const w = await h.world();
    const r = await role(w, w.admin, w.admin2, { role_key: "member" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ company_role: "member" });
    expect(await company(w.admin2.id)).toBe("member");
    expect(await seat(w.eg, w.admin2.id)).toEqual([{ role: "member", is_primary: true }]);
    expect(await adminCount(w)).toBe(1);
  });

  it("K811-API-003 グループの役割を変える：scope_id を送らなければ主の所属・メンバー → マネージャー → 閲覧のみ。証跡の payload に scope_id・from・to。答えの groups に新しい役割", async () => {
    await h.ready();
    const w = await h.world();
    const r = await role(w, w.admin, w.member, { role_key: "manager" });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as { company_role: string; groups: Record<string, unknown>[] };
    expect(d.company_role).toBe("member");
    expect(d.groups).toEqual([{ id: w.eg, name: "営業", code: "EG", primary: true, role: "manager" }]);
    expect((await role(w, w.admin, w.member, { role_key: "viewer", scope_id: w.eg })).status).toBe(200);
    expect(await seat(w.eg, w.member.id)).toEqual([{ role: "viewer", is_primary: true }]);
    const a = await h.rows<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'member.role_change' order by occurred_at",
      [w.tenantId],
    );
    expect(a.map((x) => x.payload)).toEqual([
      { scope_id: w.eg, from: "member", to: "manager" },
      { scope_id: w.eg, from: "manager", to: "viewer" },
    ]);
  });

  it("K811-API-004 兼務を通す（D-154.15）：兼ねているグループごとに別の役割にできる（営業はメンバーのまま受託開発のマネージャー）・別のグループの役割は変わらない・同じ人が複数のグループのマネージャーになれる", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'member'), ($1, $4, $3, 'member')",
      [w.tenantId, w.jd, w.member.id, w.ac],
    );
    expect((await role(w, w.admin, w.member, { role_key: "manager", scope_id: w.jd })).status).toBe(200);
    expect((await role(w, w.admin, w.member, { role_key: "manager", scope_id: w.ac })).status).toBe(200);
    expect(await seat(w.eg, w.member.id)).toEqual([{ role: "member", is_primary: true }]);
    expect(await seat(w.jd, w.member.id)).toEqual([{ role: "manager", is_primary: false }]);
    expect(await seat(w.ac, w.member.id)).toEqual([{ role: "manager", is_primary: false }]);
    const g = (
      (await h.json(await role(w, w.admin, w.member, { role_key: "viewer", scope_id: w.ac }))).data as {
        groups: { id: string; role: string }[];
      }
    ).groups;
    expect(g.map((x) => `${x.id === w.eg ? "営業" : x.id === w.jd ? "受託開発" : "経理"}:${x.role}`)).toEqual([
      "営業:member",
      "受託開発:manager",
      "経理:viewer",
    ]);
  });

  it("K811-API-005 そのグループに居ない人 → 409・E-MEM-007（欄・details なし）・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const r = await role(w, w.admin, w.member, { role_key: "manager", scope_id: w.jd });
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j.code).toBe("E-MEM-007");
    expect(j.field).toBeUndefined();
    expect(j.details).toBeUndefined();
    expect(await seat(w.jd, w.member.id)).toEqual([]);
    expect(await nothing(w, w.member.id)).toBe("member");
  });

  it("K811-API-006 グループが無い：無い id・別の会社のグループ・消したグループ → 404・E-MEM-006（欄・details なし）・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.addScope(w.tenantId, "消した", "DD", w.eg);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [gone]);
    for (const id of [randomUUID(), w.other.rootScope, gone]) {
      const r = await role(w, w.admin, w.member, { role_key: "manager", scope_id: id });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-006");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect(await nothing(w, w.member.id)).toBe("member");
  });

  it("K811-API-007 自分の役割は自分で変えられない（D-154.19）：管理者が自分を member にも admin にも・グループの役割にも → 409・E-MEM-003・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const b of [{ role_key: "member" }, { role_key: "admin" }, { role_key: "manager", scope_id: w.eg }]) {
      const r = await role(w, w.admin, w.admin, b);
      expect(r.status, JSON.stringify(b)).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-003");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect(await nothing(w, w.admin.id)).toBe("admin");
  });

  it("K811-API-008 最後の管理者は下げられない（D-154.19）：止めた管理者は数えない・個別の権限の人が最後の管理者を下げようとすると 409・E-MEM-004・何も変わらない。管理者を足してから下げると通る", async () => {
    await h.ready();
    const w = await h.world();
    const granted = await h.make(w, "granted", "役割を直す権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, granted.id],
    );
    await h.f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [w.admin2.id]);
    const r = await role(w, granted, w.admin, { role_key: "member" });
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await h.json(r);
    expect(j.code).toBe("E-MEM-004");
    expect(j.details).toBeUndefined();
    expect(await nothing(w, w.admin.id)).toBe("admin");
    await h.f.admin.query("update tenant_memberships set status = 'active' where member_id = $1", [w.admin2.id]);
    expect((await role(w, granted, w.admin, { role_key: "member" })).status).toBe(200);
    expect(await adminCount(w)).toBe(1);
  });

  it("K811-API-009 相手が無い：無い id・別の会社の人・外した人・消した人・AI → 404・E-MEM-002（欄・details なし）・どれも変わらない", async () => {
    await h.ready();
    const w = await h.world();
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
      const r = await role(w, w.admin, { id }, { role_key: "manager" });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-002");
      expect(j.field).toBeUndefined();
      expect(j.details).toBeUndefined();
    }
    expect(await h.audits(w.tenantId, "member.role_change")).toBe(0);
    expect(await company(w.outsider.id)).toBe("admin");
  });

  it("K811-API-010 同じ役割を選び直す：200・何も変わらない・証跡を増やさない（二度押し）", async () => {
    await h.ready();
    const w = await h.world();
    expect((await role(w, w.admin, w.mgr, { role_key: "manager" })).status).toBe(200);
    expect((await role(w, w.admin, w.admin2, { role_key: "admin" })).status).toBe(200);
    expect(await h.audits(w.tenantId, "member.role_change")).toBe(0);
    expect(await seat(w.eg, w.mgr.id)).toEqual([{ role: "manager", is_primary: true }]);
  });

  it("K811-API-011 入力の形：role_key が無い・知らない役割・scope_id が uuid でない・知らない欄（role_id・tenant_id）→ 422・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const bad: Record<string, unknown>[] = [
      {},
      { role_key: "owner" },
      { role_key: "requester" },
      { role_key: "manager", scope_id: "営業" },
      { role_key: "manager", role_id: "admin" },
      { role_key: "manager", tenant_id: w.other.tenantId },
    ];
    for (const b of bad) expect((await role(w, w.admin, w.member, b)).status, JSON.stringify(b)).toBe(422);
    expect(await nothing(w, w.member.id)).toBe("member");
  });

  it("K811-API-012 本人確認と権限：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・1 分前は通る。members の edit を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403・ログインしていない 401。1 分の上限を超えたら 429 と retry_after_sec（1〜60 の整数）・役割は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const su of [undefined, h.suAgo(16)]) {
      const r = await h.call(w.admin, "PATCH", `/members/${w.member.id}/role`, {
        body: { role_key: "manager" },
        ...(su === undefined ? {} : { su }),
      });
      expect(r.status).toBe(403);
      expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect((await role(w, w.admin, w.member, { role_key: "manager" }, { su: h.suAgo(1) })).status).toBe(200);
    const granted = await h.make(w, "granted", "役割を直す権限の人");
    await h.f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, granted.id],
    );
    expect((await role(w, granted, w.mgr, { role_key: "viewer" })).status).toBe(200);
    for (const p of [w.mgr, w.viewer, w.stopped])
      expect((await role(w, p, w.member, { role_key: "viewer" })).status, p.name).toBe(403);
    expect((await h.f.req("PATCH", `/members/${w.member.id}/role`, { body: { role_key: "viewer" } })).status).toBe(401);
    const w2 = await h.world();
    h.limits["updateMemberRole"] = 2;
    try {
      expect((await role(w2, w2.admin, w2.member, { role_key: "manager" })).status).toBe(200);
      expect((await role(w2, w2.admin, w2.member, { role_key: "viewer" })).status).toBe(200);
      const r = await role(w2, w2.admin, w2.member, { role_key: "manager" });
      expect(r.status).toBe(429);
      const s = Number((await h.json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      expect(await seat(w2.eg, w2.member.id)).toEqual([{ role: "viewer", is_primary: true }]);
    } finally {
      h.limits["updateMemberRole"] = 10_000;
    }
  });

  it("K811-API-013 操作の揺れ（G-16）：2 人の管理者が同時に互いを下げる → 片方だけが通る・管理者が 0 人にならない。同じ人の役割を同時に 2 つ変えても行は 1 つのまま", async () => {
    await h.ready();
    const w = await h.world();
    const rs = await Promise.all([
      role(w, w.admin, w.admin2, { role_key: "member" }),
      role(w, w.admin2, w.admin, { role_key: "member" }),
    ]);
    expect(rs.map((r) => r.status).filter((s) => s === 200).length).toBe(1);
    expect(await adminCount(w)).toBeGreaterThanOrEqual(1);
    const w2 = await h.world();
    const both = await Promise.all([
      role(w2, w2.admin, w2.member, { role_key: "manager" }),
      role(w2, w2.admin2, w2.member, { role_key: "viewer" }),
    ]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect((await seat(w2.eg, w2.member.id)).length).toBe(1);
  });

  it("K811-API-014 失敗（手順 S1）：会社の役割の update・所属の行・証跡で DB が落ちる → 503・E-PAGE-003・役割も所属も証跡も前のまま。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    for (const [table, op, body] of [
      ["tenant_memberships", "update", { role_key: "admin" }],
      ["scope_memberships", "update", { role_key: "viewer" }],
      ["audit_events", "insert", { role_key: "manager" }],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await role(w, w.admin, w.member, body);
        expect(r.status, table).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect(await seat(w.eg, w.member.id)).toEqual([{ role: "member", is_primary: true }]);
    expect(await nothing(w, w.member.id)).toBe("member");
    expect((await role(w, w.admin, w.member, { role_key: "manager" })).status).toBe(200);
  });

  it("K811-DB-015 守り：kaname_app から直に呼べるのは app.member_role_change だけ。直す権限の無い人が直に呼ぶと forbidden・行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const v = (
      await h.asOwner<{ v: { error?: string } }>(w.member, "select app.member_role_change($1::uuid, $2::jsonb) as v", [
        w.mgr.id,
        JSON.stringify({ role_key: "viewer" }),
      ])
    )[0]!.v;
    expect(v).toMatchObject({ error: "forbidden" });
    expect(await nothing(w, w.mgr.id)).toBe("manager");
    const ok = (
      await h.asOwner<{ v: { ok?: boolean } }>(w.admin, "select app.member_role_change($1::uuid, $2::jsonb) as v", [
        w.mgr.id,
        JSON.stringify({ role_key: "viewer" }),
      ])
    )[0]!.v;
    expect(ok.ok).toBe(true);
  });

  it("K811-API-016 止めている人の役割を変える：200・company_role は member のまま・主のグループの役割が manager・止めている間は役割の束の権限の行が無い（0080 は status active の人にだけ束を作る）・戻す（status active）と束の行ができる", async () => {
    await h.ready();
    const w = await h.world();
    const bundles = () =>
      h.num("select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null", [
        w.stopped.id,
      ]);
    const r = await role(w, w.admin, w.stopped, { role_key: "manager" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ member_id: w.stopped.id, company_role: "member" });
    expect(await seat(w.eg, w.stopped.id)).toEqual([{ role: "manager", is_primary: true }]);
    expect(await bundles()).toBe(0);
    await h.f.admin.query("update members set suspended_at = null, suspended_by = null where id = $1", [w.stopped.id]);
    await h.f.admin.query("update tenant_memberships set status = 'active' where member_id = $1 and tenant_id = $2", [
      w.stopped.id,
      w.tenantId,
    ]);
    expect(await bundles()).toBeGreaterThan(0);
  });
});
