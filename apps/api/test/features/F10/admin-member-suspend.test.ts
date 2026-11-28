// K-814「一時的に止める・戻す口（suspendMember・resumeMember：止めた瞬間に画面と PC のセッションを切る）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・
//   偽の画面のログイン。土台 admin.harness.ts）。行 ID（K814-API-…／K814-DB-…）は 11_tickets/K-814.md の表と 1 対 1。入力と答えの形は K-800 の契約（体なし・MemberStateChanged）：
//     suspendMember POST /members/:id/suspend → 200 { data: { member_id, suspended: true,  suspended_at } }
//     resumeMember  POST /members/:id/resume  → 200 { data: { member_id, suspended: false, suspended_at: null } }
//     どちらも本人確認の取り直しが要る（入口）。止めると、その人の画面・PC・API のセッションをすぐ全部切り（G-14・D-154.20）、動いている・待っている PC の仕事をやめる。担当はそのまま。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const stop = (p: P, who: { id: string }, o: { su?: number; key?: string } = {}) =>
  h.call(p, "POST", `/members/${who.id}/suspend`, {
    body: {},
    su: o.su ?? h.suNow(),
    ...(o.key ? { key: o.key } : {}),
  });
const back = (p: P, who: { id: string }, o: { su?: number } = {}) =>
  h.call(p, "POST", `/members/${who.id}/resume`, { body: {}, su: o.su ?? h.suNow() });
const state = (id: string) =>
  h.one<{ suspended_at: Date | null; suspended_by: string | null; status: string }>(
    `select m.suspended_at, m.suspended_by, tm.status from members m join tenant_memberships tm on tm.member_id = m.id where m.id = $1`,
    [id],
  );
const live = async (id: string) =>
  h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [id]);
const session = async (w: World, id: string, kind: string) => {
  const auth = `k814-${randomUUID()}`;
  await h.f.admin.query(
    "insert into sessions (tenant_id, member_id, kind_id, auth_session_id, device_label) values ($1, $2, $3, $4, 'テスト')",
    [w.tenantId, id, kind, auth],
  );
  return auth;
};
const alive = async (auth: string) =>
  (await h.f.admin.query("select * from app.session_alive($1)", [auth])).rows.length;
const job = async (w: World, id: string, st: string) =>
  (
    await h.one<{ id: string }>(
      "insert into bridge_jobs (tenant_id, member_id, state_id, prompt) values ($1, $2, $3, 'テスト') returning id",
      [w.tenantId, id, st],
    )
  ).id;
const grantEdit = async (w: World, key: string) => {
  const p = await h.make(w, key, `${key} の権限の人`);
  await h.f.admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
    [w.tenantId, p.id],
  );
  return p;
};

describe("K-814 一時的に止める（suspendMember）", () => {
  it("K814-API-001 止める：200・no-store・鍵がちょうど 3・suspended true・suspended_at が入る・members の止めた時刻と止めた人（呼んだ人）・所属の status が suspended・証跡 member.suspend 1 行・メンバーの並び（K-419）で suspended true", async () => {
    await h.ready();
    const w = await h.world();
    const r = await stop(w.admin, w.member);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["member_id", "suspended", "suspended_at"]);
    expect(d).toMatchObject({ member_id: w.member.id, suspended: true });
    expect(String(d["suspended_at"])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await state(w.member.id)).toMatchObject({ suspended_by: w.admin.id, status: "suspended" });
    expect((await state(w.member.id)).suspended_at).not.toBeNull();
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(1);
    const list = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      groups: { members: Record<string, unknown>[] }[];
    };
    expect(list.groups.flatMap((g) => g.members).find((m) => m["id"] === w.member.id)).toMatchObject({
      suspended: true,
    });
  });

  it("K814-API-002 止めた瞬間に全部切れる（G-14・D-154.20）：画面・PC・API のセッションが全部 revoked（理由 suspended）・app.session_alive が空・動いている・待っている・確認待ちの PC の仕事は cancelled（止めた理由の字・代表の答え 29536ded573d・b9c92c9eccf3）・終わった仕事とほかの人の分は変わらない・証跡の payload は切った数だけ", async () => {
    await h.ready();
    const w = await h.world();
    const auths = [
      await session(w, w.member.id, "web"),
      await session(w, w.member.id, "bridge"),
      await session(w, w.member.id, "api"),
    ];
    const other = await session(w, w.mgr.id, "web");
    const q = await job(w, w.member.id, "queued");
    const run = await job(w, w.member.id, "running");
    const ask = await job(w, w.member.id, "asking");
    const done = await job(w, w.member.id, "done");
    const theirs = await job(w, w.mgr.id, "queued");
    for (const a of auths) expect(await alive(a)).toBe(1);
    expect((await stop(w.admin, w.member)).status).toBe(200);
    for (const a of auths) expect(await alive(a)).toBe(0);
    expect(await alive(other)).toBe(1);
    expect(await live(w.member.id)).toBe(0);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoke_reason_id = 'suspended'", [
        w.member.id,
      ]),
    ).toBe(3);
    const js = await h.rows<{ id: string; state_id: string; stopped_reason: string | null }>(
      "select id, state_id, stopped_reason from bridge_jobs where id = any($1::uuid[])",
      [[q, run, ask, done, theirs]],
    );
    const by = (id: string) => js.find((x) => x.id === id)!;
    expect(by(q)).toMatchObject({ state_id: "cancelled" });
    expect(by(run)).toMatchObject({ state_id: "cancelled" });
    expect(by(ask)).toMatchObject({ state_id: "cancelled" });
    for (const j of [q, run, ask])
      expect(by(j).stopped_reason).toBe("担当の人が一時的に止められたので、この仕事はやめました");
    expect(by(done).state_id).toBe("done");
    expect(by(theirs).state_id).toBe("queued");
    const a = await h.one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'member.suspend'",
      [w.tenantId],
    );
    expect(a.payload).toEqual({ sessions_cut: 3, jobs_cancelled: 3 });
  });

  it("K814-API-003 担当はそのまま：止めた人が担当のチケットの担当者は変わらない（AI の動きだけ止まる）・グループの所属も残る", async () => {
    await h.ready();
    const w = await h.world();
    const t = await h.ticket(w, { assignee: w.member });
    await stop(w.admin, w.member);
    expect((await h.one<{ a: string }>("select assignee_member_id as a from tickets where id = $1", [t])).a).toBe(
      w.member.id,
    );
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [
        w.member.id,
      ]),
    ).toBe(1);
  });

  it("K814-API-004 止められない：自分 → 409・E-MEM-005・最後の管理者（止めた管理者は数えない）→ 409・E-MEM-004・もう止まっている人 → 409・E-MEM-009（どれも欄・details なし・何も変わらない）", async () => {
    await h.ready();
    const w = await h.world();
    const granted = await grantEdit(w, "granted");
    const self = await stop(w.admin, w.admin);
    expect(self.status).toBe(409);
    expect((await h.json(self)).code).toBe("E-MEM-005");
    await h.f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [w.admin2.id]);
    const last = await stop(granted, w.admin);
    expect(last.status).toBe(409);
    const j = await h.json(last);
    expect(j.code).toBe("E-MEM-004");
    expect(j.field).toBeUndefined();
    expect(j.details).toBeUndefined();
    const twice = await stop(w.admin, w.stopped);
    expect(twice.status).toBe(409);
    expect((await h.json(twice)).code).toBe("E-MEM-009");
    expect((await state(w.admin.id)).status).toBe("active");
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(0);
  });

  it("K814-API-005 相手が無い：無い id・別の会社の人・外した人・消した人・AI → 404・E-MEM-002（欄・details なし）。別の会社の人は止まらない", async () => {
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
      for (const call of [stop, back]) {
        const r = await call(w.admin, { id });
        expect(r.status, id).toBe(404);
        const j = await h.json(r);
        expect(j.code).toBe("E-MEM-002");
        expect(j.field).toBeUndefined();
        expect(j.details).toBeUndefined();
      }
    }
    expect((await state(w.outsider.id)).status).toBe("active");
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(0);
  });

  it("K814-API-006 操作の揺れ（G-16）：同じ人を 2 人が同時に止める → 200 と 409（E-MEM-009）・証跡は 1 行。二度押し（同じ冪等キー）は同じ 200", async () => {
    await h.ready();
    const w = await h.world();
    const rs = await Promise.all([stop(w.admin, w.member), stop(w.admin2, w.member)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(1);
    const w2 = await h.world();
    const key = randomUUID();
    const [a, b] = [await stop(w2.admin, w2.mgr, { key }), await stop(w2.admin, w2.mgr, { key })];
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await h.audits(w2.tenantId, "member.suspend")).toBe(1);
  });

  it("K814-API-007 失敗（手順 S1）：members の更新・所属の更新・証跡で DB が落ちる → 503・E-PAGE-003・止まらない・証跡 0・セッションも仕事も切れない。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const auth = await session(w, w.member.id, "web");
    const j = await job(w, w.member.id, "queued");
    for (const [table, op] of [
      ["members", "update"],
      ["tenant_memberships", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await stop(w.admin, w.member);
        expect(r.status, `${table} ${op}`).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect((await state(w.member.id)).status).toBe("active");
    expect(await alive(auth)).toBe(1);
    expect((await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [j])).s).toBe("queued");
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(0);
    expect((await stop(w.admin, w.member)).status).toBe(200);
  });

  it("K814-API-013 失敗（手順 S2・セッションを切る）：セッションの失効で DB が落ちる → 503・E-PAGE-003・止めたことも全部戻る（止まらない・セッションは生きている・PC の仕事も残る・証跡 0）。やり直すと全部切れる", async () => {
    await h.ready();
    const w = await h.world();
    const auths = [await session(w, w.member.id, "web"), await session(w, w.member.id, "bridge")];
    const j = await job(w, w.member.id, "running");
    await h.breakOn("sessions", w.tenantId, "update", async () => {
      const r = await stop(w.admin, w.member);
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
    expect((await state(w.member.id)).status).toBe("active");
    for (const a of auths) expect(await alive(a)).toBe(1);
    expect((await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [j])).s).toBe("running");
    expect(await h.audits(w.tenantId, "member.suspend")).toBe(0);
    expect((await stop(w.admin, w.member)).status).toBe(200);
    for (const a of auths) expect(await alive(a)).toBe(0);
  });

  it("K814-API-014 失敗（手順 S3・PC の仕事をやめる）：PC の仕事の更新で DB が落ちる → 503・E-PAGE-003・止まらない・セッションも切れない（止めるは全部か無しか）。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    const auth = await session(w, w.member.id, "web");
    const j = await job(w, w.member.id, "queued");
    await h.breakOn("bridge_jobs", w.tenantId, "update", async () => {
      const r = await stop(w.admin, w.member);
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
    expect((await state(w.member.id)).status).toBe("active");
    expect(await alive(auth)).toBe(1);
    expect((await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [j])).s).toBe("queued");
    expect((await stop(w.admin, w.member)).status).toBe(200);
    expect((await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [j])).s).toBe(
      "cancelled",
    );
  });
});

describe("K-814 戻す（resumeMember）", () => {
  it("K814-API-008 戻す：200・鍵がちょうど 3・suspended false・suspended_at null・members と所属の止めが解ける・証跡 member.resume 1 行・切ったセッションは戻らない（入り直し）・担当・所属はそのまま・役割の束の権限の行は止めている間は無く、戻すと作り直される（また操作できる）", async () => {
    await h.ready();
    const w = await h.world();
    const auth = await session(w, w.member.id, "web");
    const bundles = () =>
      h.num("select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null", [
        w.member.id,
      ]);
    expect(await bundles()).toBeGreaterThan(0);
    await stop(w.admin, w.member);
    expect(await bundles()).toBe(0);
    const r = await back(w.admin, w.member);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["member_id", "suspended", "suspended_at"]);
    expect(d).toMatchObject({ member_id: w.member.id, suspended: false, suspended_at: null });
    expect(await state(w.member.id)).toEqual({ suspended_at: null, suspended_by: null, status: "active" });
    expect(await alive(auth)).toBe(0);
    expect(await h.audits(w.tenantId, "member.resume")).toBe(1);
    expect(await bundles()).toBeGreaterThan(0);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [
        w.member.id,
      ]),
    ).toBe(1);
    const stopAgain = await stop(w.admin, w.member);
    expect(stopAgain.status).toBe(200);
  });

  it("K814-API-009 戻せない：止まっていない人 → 409・E-MEM-010（欄・details なし・証跡 0）。戻した後にもう一度戻す（二度押し）も 409", async () => {
    await h.ready();
    const w = await h.world();
    const r = await back(w.admin, w.member);
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect(j.code).toBe("E-MEM-010");
    expect(j.field).toBeUndefined();
    expect(j.details).toBeUndefined();
    expect((await back(w.admin, w.stopped)).status).toBe(200);
    expect((await back(w.admin, w.stopped)).status).toBe(409);
    expect(await h.audits(w.tenantId, "member.resume")).toBe(1);
  });

  it("K814-API-010 失敗（手順 S1）：members の更新・所属の更新・証跡で DB が落ちる → 503・E-PAGE-003・止まったまま・証跡 0。やり直すと 200", async () => {
    await h.ready();
    const w = await h.world();
    for (const [table, op] of [
      ["members", "update"],
      ["tenant_memberships", "update"],
      ["audit_events", "insert"],
    ] as const)
      await h.breakOn(table, w.tenantId, op, async () => {
        const r = await back(w.admin, w.stopped);
        expect(r.status, `${table} ${op}`).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    expect((await state(w.stopped.id)).status).toBe("suspended");
    expect(await h.audits(w.tenantId, "member.resume")).toBe(0);
    expect((await back(w.admin, w.stopped)).status).toBe(200);
  });
});

describe("K-814 入口の守り（止める・戻す）", () => {
  it("K814-API-011 本人確認と権限：取り直し無し・16 分前は 403・STEP_UP_REQUIRED（止める・戻す）・1 分前は通る。members の edit を付けた人は 200・マネージャー・メンバー・閲覧のみ・止めた人は 403・ログインしていない 401", async () => {
    await h.ready();
    const w = await h.world();
    for (const path of [`/members/${w.member.id}/suspend`, `/members/${w.stopped.id}/resume`])
      for (const su of [undefined, h.suAgo(16)]) {
        const r = await h.call(w.admin, "POST", path, { body: {}, ...(su === undefined ? {} : { su }) });
        expect(r.status, path).toBe(403);
        expect((await h.json(r)).code).toBe("STEP_UP_REQUIRED");
      }
    expect((await stop(w.admin, w.member, { su: h.suAgo(1) })).status).toBe(200);
    const granted = await grantEdit(w, "granted");
    expect((await stop(granted, w.mgr)).status).toBe(200);
    expect((await back(granted, w.mgr)).status).toBe(200);
    for (const p of [w.mgr, w.viewer, w.stopped]) {
      expect((await stop(p, w.admin2)).status, p.name).toBe(403);
      expect((await back(p, w.stopped)).status, p.name).toBe(403);
    }
    expect((await h.f.req("POST", `/members/${w.member.id}/suspend`, { body: {} })).status).toBe(401);
    expect((await h.f.req("POST", `/members/${w.member.id}/resume`, { body: {} })).status).toBe(401);
  });

  it("K814-API-012 止めた直後（G-12）：止めた次の瞬間に、その人の画面のセッションは生きていない（app.session_alive が空）。管理者を止めて残る管理者が戻せる", async () => {
    await h.ready();
    const w = await h.world();
    const auth = await session(w, w.admin2.id, "web");
    expect(await alive(auth)).toBe(1);
    expect((await stop(w.admin, w.admin2)).status).toBe(200);
    expect(await alive(auth)).toBe(0);
    expect((await back(w.admin, w.admin2)).status).toBe(200);
  });

  it("K814-DB-015 守り：kaname_app から直に呼べるのは app.member_suspend・app.member_resume だけ（app.admin_cut_sessions は permission denied）。権限の無い人が直に呼ぶと forbidden・行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await expect(h.f.pool.query("select app.admin_cut_sessions($1::uuid, 'suspended')", [w.member.id])).rejects.toThrow(
      /permission denied/,
    );
    const call = (fn: string, p: P, id: string) =>
      h.asOwner<{ v: { error?: string; ok?: boolean } }>(p, `select app.${fn}($1::uuid) as v`, [id]);
    expect((await call("member_suspend", w.member, w.mgr.id))[0]!.v).toMatchObject({ error: "forbidden" });
    expect((await call("member_resume", w.member, w.stopped.id))[0]!.v).toMatchObject({ error: "forbidden" });
    expect((await state(w.mgr.id)).status).toBe("active");
    expect((await call("member_suspend", w.admin, w.mgr.id))[0]!.v.ok).toBe(true);
  });

  it("K814-DB-016 外す・抜けるで理由の字を分ける（代表の答え b9c92c9eccf3・e0920e503c99）：app.admin_cut_sessions を 'member_removed'（外す）と 'member_left'（抜ける）で直に呼ぶ → 待っている・確認待ちの仕事が cancelled・字はそれぞれ・答えの件数・セッションの理由はどちらも member_left。知らない理由は 22023・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const cases = [
      { who: w.member, key: "member_removed", text: "担当の人がワークスペースから外されたので、この仕事はやめました" },
      { who: w.viewer, key: "member_left", text: "担当の人がワークスペースを抜けたので、この仕事はやめました" },
    ];
    for (const c of cases) {
      const auth = await session(w, c.who.id, "web");
      const jobs = [await job(w, c.who.id, "queued"), await job(w, c.who.id, "asking")];
      const r = await h.one<{ v: { sessions_cut: number; jobs_cancelled: number } }>(
        "select app.admin_cut_sessions($1::uuid, $2) as v",
        [c.who.id, c.key],
      );
      expect(r.v, c.key).toEqual({ sessions_cut: 1, jobs_cancelled: 2 });
      const js = await h.rows<{ state_id: string; stopped_reason: string | null }>(
        "select state_id, stopped_reason from bridge_jobs where id = any($1::uuid[])",
        [jobs],
      );
      expect(js, c.key).toEqual([
        { state_id: "cancelled", stopped_reason: c.text },
        { state_id: "cancelled", stopped_reason: c.text },
      ]);
      expect(await alive(auth), c.key).toBe(0);
      expect(
        await h.num("select count(*) as n from sessions where member_id = $1 and revoke_reason_id = 'member_left'", [
          c.who.id,
        ]),
        c.key,
      ).toBe(1);
    }
    const auth = await session(w, w.mgr.id, "web");
    const j = await job(w, w.mgr.id, "queued");
    await expect(h.one("select app.admin_cut_sessions($1::uuid, 'oops') as v", [w.mgr.id])).rejects.toMatchObject({
      code: "22023",
    });
    expect(await alive(auth)).toBe(1);
    expect((await h.one<{ s: string }>("select state_id as s from bridge_jobs where id = $1", [j])).s).toBe("queued");
  });
});
