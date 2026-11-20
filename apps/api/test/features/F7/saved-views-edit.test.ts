// K-476「検索条件を直す・消す」の単体の試験（口・本物の DB）。名前の頭の行 ID（K476-API-…）は 11_tickets/K-476.md の行の表と 1 対 1。
// 口：PATCH /api/v1/saved_views/:id（updateSavedView）／DELETE /api/v1/saved_views/:id（deleteSavedView・消した印を付けるだけ）。
//   直せる人・消せる人：作った人と、そのグループのマネージャー（入口の行の確かめ app.manages_scope と、行の守りの has_permission の edit の 2 層）。
//   見せる相手（share・scope_id）を変えられるのは作った人だけ（E-VWS-020）。答えの 1 件は K-475 と同じ 13 個の鍵。
// 土台 saved-views.harness.ts（K-475 が運ぶ）。口の振る舞いは apps/api/src/hooks/saved-views-edit.ts。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TEXT,
  VIEW_KEYS,
  VWS_BAD_SHAPE,
  VWS_KEEP_GROUP,
  VWS_CONTROL,
  VWS_NAME_LONG,
  VWS_NEED_SCOPE,
  VWS_NO_NAME,
  VWS_NO_SCOPE,
  VWS_OWNER_ONLY,
  VWS_SAME_NAME,
  W,
  asMember,
  captureLogs,
  deleteView,
  f,
  failsAs,
  fields,
  freshPerson,
  json,
  num,
  one,
  patchView,
  rowOf,
  seedView,
  setupSavedViews,
  viewRow,
} from "./saved-views.harness.js";

setupSavedViews(["saved-views-edit"]);

/** この人が作った・見えるグループの席に居る「作る人」を 1 人（席は営業 g1） */
const maker = (name = "作る人") => freshPerson(name, W.g1);
const gView = (by: Awaited<ReturnType<typeof maker>>, name: string, extra: Record<string, unknown> = {}) =>
  seedView({ by, name, share: "group", scope: W.g1, ...extra });
const audits = (action: string, target: string) =>
  num("select count(*) as n from audit_events where action = $1 and target_id = $2", [action, target]);
const code = async (r: Response) => String((await json(r))["code"]);

describe("K-476 検索条件を直す（updateSavedView・本物の DB）", () => {
  it("K476-API-001 名前を直す（作った人）：200・13 個の鍵・名前だけ変わる・updated_by と updated_at が動く・証跡 saved_views.update（中身は直した欄の名前だけ）・Cache-Control に no-store", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "OLD", filters: { q: "a" }, columns: ["x"], density: "compact" });
    const before = await viewRow(id);
    const r = await patchView(c, id, { name: "NEW" });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = rowOf(await json(r));
    expect(Object.keys(d).sort()).toEqual([...VIEW_KEYS]);
    expect([d["name"], d["mine"], d["can_edit"]]).toEqual(["NEW", true, true]);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const after = await viewRow(id);
    expect([after["name"], after["member_id"], after["updated_by"]]).toEqual(["NEW", c.id, c.id]);
    expect([after["filters"], after["columns"], after["density"], after["share"]]).toEqual([
      before["filters"],
      before["columns"],
      before["density"],
      before["share"],
    ]);
    expect(new Date(String(after["updated_at"])).getTime()).toBeGreaterThan(
      new Date(String(before["updated_at"])).getTime(),
    );
    const a = (
      await f.admin.query(
        "select payload, choke_point_id from audit_events where action = 'saved_views.update' and target_id = $1",
        [id],
      )
    ).rows as Record<string, unknown>[];
    expect(a).toHaveLength(1);
    expect(a[0]!["payload"]).toEqual({ fields: ["name"] });
    expect(a[0]!["choke_point_id"]).toBe("C2");
  });

  it("K476-API-002 条件・列・詰め方を直す：送った欄だけ変わり、送らない欄はそのまま。証跡の欄の名前は決まった順（name・share・scope_id・filters・columns・density）", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "FIELDS", filters: { q: "a" }, columns: ["x"], density: "normal" });
    const r = await patchView(c, id, {
      density: "compact",
      filters: { view: "all", sort: "due" },
      columns: ["title", "due_on"],
    });
    expect(r.status).toBe(200);
    const row = await viewRow(id);
    expect([row["name"], row["filters"], row["columns"], row["density"]]).toEqual([
      "FIELDS",
      { view: "all", sort: "due" },
      ["title", "due_on"],
      "compact",
    ]);
    const a = await one<{ payload: { fields: string[] } }>(
      "select payload from audit_events where action = 'saved_views.update' and target_id = $1",
      [id],
    );
    expect(a.payload.fields).toEqual(["filters", "columns", "density"]);
  });

  it("K476-API-003 自分だけ → グループの全員（作った人）：200・同じグループの同僚に見えるようになる", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "TO-GROUP", share: "self", scope: null });
    expect((await asMember(W.mate, "select 1 from saved_views where id = $1", [id])).length).toBe(0);
    const r = await patchView(c, id, { share: "group", scope_id: W.g1 });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = rowOf(await json(r));
    expect([d["share"], d["scope_id"]]).toEqual(["group", W.g1]);
    expect((await asMember(W.mate, "select 1 from saved_views where id = $1", [id])).length).toBe(1);
    expect((await asMember(W.other, "select 1 from saved_views where id = $1", [id])).length).toBe(0);
  });

  it("K476-API-004 グループの全員 → 自分だけ（作った人）：200・同僚には見えなくなる（作った人には見える）", async () => {
    const c = await maker();
    const id = await gView(c, "TO-SELF");
    expect((await asMember(W.mate, "select 1 from saved_views where id = $1", [id])).length).toBe(1);
    const r = await patchView(c, id, { share: "self" });
    expect(r.status).toBe(200);
    expect(rowOf(await json(r))["share"]).toBe("self");
    expect((await asMember(W.mate, "select 1 from saved_views where id = $1", [id])).length).toBe(0);
    expect((await asMember(c, "select 1 from saved_views where id = $1", [id])).length).toBe(1);
  });

  it("K476-API-005 見せるグループを変える（作った人）：見える下のグループへは 200。見えないグループ（g2）・別の会社のグループ・無い uuid は 404 E-VWS-004（欄 scope_id）で何も変わらない", async () => {
    const c = await maker();
    const sub = (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name) values ($1, $2, '営業の下') returning id",
        [W.tenantId, W.g1],
      )
    ).id;
    const id = await gView(c, "MOVE");
    for (const scope_id of [W.g2, W.rootB, randomUUID()]) {
      const r = await patchView(c, id, { scope_id });
      expect(r.status, scope_id).toBe(404);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([VWS_NO_SCOPE, TEXT[VWS_NO_SCOPE]]);
      expect(fields(j)).toEqual(["scope_id"]);
    }
    expect((await viewRow(id))["scope_id"]).toBe(W.g1);
    const ok = await patchView(c, id, { scope_id: sub });
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect((await viewRow(id))["scope_id"]).toBe(sub);
  });

  it("K476-API-006 マネージャーが直す：グループの全員向けの物の名前・条件・列・詰め方は直せる（作った人は変わらない・updated_by はマネージャー・mine false・can_edit true）。作った人の別の名前と重なる名前へは 409 E-VWS-005", async () => {
    const c = await maker();
    const id = await gView(c, "BY-MANAGER");
    await seedView({ by: c, name: "TAKEN" });
    const r = await patchView(W.manager, id, {
      name: "MANAGER-RENAMED",
      filters: { q: "x" },
      columns: ["a"],
      density: "compact",
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = rowOf(await json(r));
    expect([d["name"], d["mine"], d["can_edit"], d["member_id"]]).toEqual(["MANAGER-RENAMED", false, true, c.id]);
    const row = await viewRow(id);
    expect([row["member_id"], row["updated_by"], row["density"]]).toEqual([c.id, W.manager.id, "compact"]);
    const dup = await patchView(W.manager, id, { name: "taken" });
    expect(dup.status).toBe(409);
    expect(await code(dup)).toBe(VWS_SAME_NAME);
    expect((await viewRow(id))["name"]).toBe("MANAGER-RENAMED");
  });

  it("K476-API-007 見せる相手を変えられるのは作った人だけ：マネージャーが share・scope_id を変えると 403 E-VWS-020 で何も変わらない。同じ値を添えただけなら無視して 200", async () => {
    const c = await maker();
    const id = await gView(c, "OWNER-ONLY");
    const sub = (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name) values ($1, $2, '別の下') returning id",
        [W.tenantId, W.g1],
      )
    ).id;
    for (const body of [{ share: "self" }, { scope_id: sub }]) {
      const r = await patchView(W.manager, id, body);
      expect(r.status, JSON.stringify(body)).toBe(403);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([VWS_OWNER_ONLY, TEXT[VWS_OWNER_ONLY]]);
    }
    const row = await viewRow(id);
    expect([row["share"], row["scope_id"]]).toEqual(["group", W.g1]);
    const same = await patchView(W.manager, id, { share: "group", scope_id: W.g1, name: "SAME-VALUES" });
    expect(same.status, await same.clone().text()).toBe(200);
    expect((await viewRow(id))["name"]).toBe("SAME-VALUES");
  });

  it("K476-API-008 マネージャーでない同僚：グループの全員向けの物を直す・消すと 403（行の確かめ）。何も変わらない", async () => {
    const c = await maker();
    const id = await gView(c, "MATE-CANNOT");
    const r1 = await patchView(W.mate, id, { name: "x" });
    const r2 = await deleteView(W.mate, id);
    expect([r1.status, r2.status]).toEqual([403, 403]);
    const row = await viewRow(id);
    expect([row["name"], row["deleted_at"]]).toEqual(["MATE-CANNOT", null]);
  });

  it("K476-API-009 見えない物は 404：他人の自分だけの条件（同僚・マネージャー・root の席）・別のグループの席から見たグループの物・別の会社の人・無い uuid・消した物。直すも消すも同じ。何も変わらない", async () => {
    const c = await maker();
    const self = await seedView({ by: c, name: "HIDDEN-SELF" });
    const grp = await gView(c, "HIDDEN-GROUP");
    const gone = await seedView({ by: c, name: "HIDDEN-GONE", deleted: true });
    const cases: [typeof c, string][] = [
      [W.mate, self],
      [W.manager, self],
      [W.top, self],
      [W.other, grp],
      [W.outsider, grp],
      [c, randomUUID()],
      [c, gone],
    ];
    for (const [who, id] of cases) {
      const p = await patchView(who, id, { name: "見えない" });
      const d = await deleteView(who, id);
      expect([p.status, d.status], id).toEqual([404, 404]);
    }
    expect((await viewRow(self))["name"]).toBe("HIDDEN-SELF");
    expect((await viewRow(grp))["deleted_at"]).toBeNull();
  });

  it("K476-API-010 行の確かめは通るが edit の無いマネージャー（g1 の manager・saved_views の edit が無い）：直す・消すは 403（行の守りの 2 層目）。何も変わらない", async () => {
    const c = await maker();
    const id = await gView(c, "ROW-ONLY");
    const rowOnly = await maker("行だけのマネージャー");
    await f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
      [W.tenantId, W.g1, rowOnly.id],
    );
    const r1 = await patchView(rowOnly, id, { name: "x" });
    const r2 = await deleteView(rowOnly, id);
    expect([r1.status, r2.status]).toEqual([403, 403]);
    const row = await viewRow(id);
    expect([row["name"], row["deleted_at"]]).toEqual(["ROW-ONLY", null]);
  });

  it("K476-API-011 名前が足りない・長い・制御文字：空・空白だけは 422 E-VWS-001／61 文字は 422 E-VWS-002／途中の改行・タブは 422 E-VWS-008（欄 name）。何も変わらない", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "NAME-RULES" });
    const cases: [string, string][] = [
      ["", VWS_NO_NAME],
      ["　 ", VWS_NO_NAME],
      ["あ".repeat(61), VWS_NAME_LONG],
      ["前\n後", VWS_CONTROL],
      ["前\t後", VWS_CONTROL],
    ];
    for (const [name, c2] of cases) {
      const r = await patchView(c, id, { name });
      expect(r.status, JSON.stringify(name)).toBe(422);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([c2, TEXT[c2]]);
      expect(fields(j)).toEqual(["name"]);
    }
    expect((await viewRow(id))["name"]).toBe("NAME-RULES");
    expect((await patchView(c, id, { name: "あ".repeat(60) })).status).toBe(200);
  });

  it("K476-API-012 同じ名前：自分の別の条件と重なる名前（大文字小文字・全角半角の違いも）は 409 E-VWS-005。自分の今の名前の大文字小文字だけを変えるのは 200。ほかの人の同じ名前とは重ならない", async () => {
    const c = await maker();
    const a = await seedView({ by: c, name: "Alpha" });
    await seedView({ by: c, name: "Beta" });
    const mate = await maker("同じ名前の同僚");
    await seedView({ by: mate, name: "Gamma" });
    for (const name of ["Beta", "beta", "ＢＥＴＡ"]) {
      const r = await patchView(c, a, { name });
      expect(r.status, name).toBe(409);
      expect(fields(await json(r))).toEqual(["name"]);
    }
    expect((await viewRow(a))["name"]).toBe("Alpha");
    expect((await patchView(c, a, { name: "ALPHA" })).status).toBe(200);
    expect((await patchView(c, a, { name: "Gamma" })).status).toBe(200);
  });

  it("K476-API-013 形の誤り：share・density が決めた言葉の外は 422（その欄）／share を group にして scope_id が無い・null は 422 E-VWS-003／filters・columns の形と大きさは 422 E-VWS-007。何も変わらない", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "SHAPES" });
    const cases: [Record<string, unknown>, string, string | null][] = [
      [{ share: "everyone" }, "share", null],
      [{ density: "wide" }, "density", null],
      [{ share: "group" }, "scope_id", VWS_NEED_SCOPE],
      [{ share: "group", scope_id: null }, "scope_id", VWS_NEED_SCOPE],
      [{ filters: [] }, "filters", VWS_BAD_SHAPE],
      [{ filters: null }, "filters", VWS_BAD_SHAPE],
      [{ columns: { a: 1 } }, "columns", VWS_BAD_SHAPE],
      [{ columns: Array.from({ length: 51 }, (_, i) => `c${i}`) }, "columns", VWS_BAD_SHAPE],
      [{ filters: { memo: "x".repeat(501) } }, "filters", VWS_BAD_SHAPE],
      [{ filters: { memo: ["x"] } }, "filters", VWS_BAD_SHAPE],
      [{ filters: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, "v"])) }, "filters", VWS_BAD_SHAPE],
    ];
    for (const [body, field, c2] of cases) {
      const r = await patchView(c, id, body);
      expect(r.status, JSON.stringify(body).slice(0, 60)).toBe(422);
      const j = await json(r);
      expect(fields(j)).toContain(field);
      if (c2) expect(j["code"]).toBe(c2);
    }
    const row = await viewRow(id);
    expect([row["share"], row["density"], row["filters"], row["columns"]]).toEqual(["self", "normal", {}, []]);
  });

  it("K476-API-014 グループに見せたままグループを外す（share は送らず scope_id を null）：409 E-VWS-021（自分だけに変えてから）。何も変わらない", async () => {
    const c = await maker();
    const id = await gView(c, "KEEP-GROUP");
    const r = await patchView(c, id, { scope_id: null });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(VWS_KEEP_GROUP);
    expect((await viewRow(id))["scope_id"]).toBe(W.g1);
    expect((await patchView(c, id, { share: "self", scope_id: null })).status).toBe(200);
  });

  it("K476-API-015 体：空の体は 422（欄 body）／member_id・tenant_id・created_by・deleted_at など知らない欄は 422。何も変わらない（作った人・会社は変えられない）", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "BODY" });
    const empty = await patchView(c, id, {});
    expect(empty.status).toBe(422);
    expect(fields(await json(empty))).toContain("body");
    for (const extra of [
      { member_id: W.mate.id },
      { tenant_id: W.tenantB },
      { created_by: W.mate.id },
      { deleted_at: "2026-01-01" },
    ]) {
      const r = await patchView(c, id, { name: "BODY-2", ...extra });
      expect(r.status, JSON.stringify(extra)).toBe(422);
    }
    const row = await viewRow(id);
    expect([row["name"], row["member_id"], row["deleted_at"]]).toEqual(["BODY", c.id, null]);
  });

  it("K476-API-016 変わらない直し：今と同じ値を送ると 200・updated_at も証跡も増えない", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "NOOP", filters: { q: "a" }, density: "compact" });
    const before = await viewRow(id);
    const r = await patchView(c, id, { name: "NOOP", filters: { q: "a" }, density: "compact" });
    expect(r.status).toBe(200);
    const after = await viewRow(id);
    expect(new Date(String(after["updated_at"])).getTime()).toBe(new Date(String(before["updated_at"])).getTime());
    expect(await audits("saved_views.update", id)).toBe(0);
  });
});

describe("K-476 検索条件を消す（deleteSavedView・本物の DB）", () => {
  it("K476-API-017 作った人が消す：200 {data:{id}}・消した印が付く（行は残る）・一覧に出ない・証跡 saved_views.delete が 1 つ（中身は空）・同じ名前で作り直せる・2 回目は 404", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "TO-DELETE" });
    const r = await deleteView(c, id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(rowOf(await json(r))).toEqual({ id });
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const row = await viewRow(id);
    expect(row["deleted_at"]).not.toBeNull();
    expect(row["updated_by"]).toBe(c.id);
    expect((await asMember(c, "select 1 from saved_views where id = $1 and deleted_at is null", [id])).length).toBe(0);
    const a = (
      await f.admin.query(
        "select payload, choke_point_id from audit_events where action = 'saved_views.delete' and target_id = $1",
        [id],
      )
    ).rows as Record<string, unknown>[];
    expect(a).toHaveLength(1);
    expect(a[0]!["payload"]).toEqual({});
    expect(a[0]!["choke_point_id"]).toBe("C2");
    expect((await deleteView(c, id)).status).toBe(404);
    expect(await audits("saved_views.delete", id)).toBe(1);
    await seedView({ by: c, name: "TO-DELETE" }); // 消した物は名前をふさがない
    expect((await patchView(c, id, { name: "AFTER" })).status).toBe(404);
  });

  it("K476-API-018 マネージャーが消す：グループの全員向けの物は 200・消した印が付く（作った人は変わらない・updated_by はマネージャー）。自分だけの物は 404", async () => {
    const c = await maker();
    const id = await gView(c, "MANAGER-DELETES");
    const self = await seedView({ by: c, name: "SELF-SAFE" });
    expect((await deleteView(W.manager, id)).status).toBe(200);
    const row = await viewRow(id);
    expect([row["member_id"], row["updated_by"]]).toEqual([c.id, W.manager.id]);
    expect(row["deleted_at"]).not.toBeNull();
    expect((await deleteView(W.manager, self)).status).toBe(404);
    expect((await viewRow(self))["deleted_at"]).toBeNull();
  });

  it("K476-API-019 グループの全員向けの物を消すと、同じグループの同僚の一覧からも消える（口を通さず行の守りの中で読んで確かめる）", async () => {
    const c = await maker();
    const id = await gView(c, "VANISH");
    expect(
      (await asMember(W.mate, "select 1 from saved_views where id = $1 and deleted_at is null", [id])).length,
    ).toBe(1);
    expect((await deleteView(c, id)).status).toBe(200);
    expect(
      (await asMember(W.mate, "select 1 from saved_views where id = $1 and deleted_at is null", [id])).length,
    ).toBe(0);
  });
});

describe("K-476 DB の守り・失敗・揺れ・入口（本物の DB）", () => {
  it("K476-API-020 DB の 2 層目（口を通さず直に）：作った人と会社は書き換えられない／マネージャーは見せる相手を変えられない／作った人も見えないグループには見せられない。名前・条件の直しは通る", async () => {
    const c = await maker();
    const id = await gView(c, "GUARD");
    expect(await failsAs(W.manager, "update saved_views set member_id = $2 where id = $1", [id, W.manager.id])).toMatch(
      /作った人と会社は変えられません/,
    );
    expect(await failsAs(W.manager, "update saved_views set tenant_id = $2 where id = $1", [id, W.tenantB])).toMatch(
      /作った人と会社は変えられません|row-level security/,
    );
    expect(await failsAs(W.manager, "update saved_views set share = 'self' where id = $1", [id])).toMatch(
      /作った人だけです|row-level security/,
    );
    expect(await failsAs(c, "update saved_views set scope_id = $2 where id = $1", [id, W.g2])).toMatch(
      /見えないグループには見せられません/,
    );
    expect(
      await failsAs(W.manager, "update saved_views set name = 'GUARD-OK', density = 'compact' where id = $1", [id]),
    ).toBeNull();
    const row = await viewRow(id);
    expect([row["member_id"], row["share"], row["scope_id"], row["name"]]).toEqual([c.id, "group", W.g1, "GUARD-OK"]);
  });

  it("K476-API-021 DB の 2 層目：同じ人の別の条件と同じ名前へ直に直すと一意の索引で断られる（大文字小文字違いも）。消した物の名前へは直せる", async () => {
    const c = await maker();
    const a = await seedView({ by: c, name: "Index-A" });
    await seedView({ by: c, name: "Index-B" });
    await seedView({ by: c, name: "Index-GONE", deleted: true });
    expect(await failsAs(c, "update saved_views set name = 'index-b' where id = $1", [a])).toMatch(
      /duplicate key|saved_views_name_uq/,
    );
    expect(await failsAs(c, "update saved_views set name = 'index-gone' where id = $1", [a])).toBeNull();
  });

  it("K476-API-022 ログインしていない：直す・消すは 401（何も変わらない）", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "NO-LOGIN" });
    const p = await f.req("PATCH", `/saved_views/${id}`, { body: { name: "x" } });
    const d = await f.req("DELETE", `/saved_views/${id}`);
    expect([p.status, d.status]).toEqual([401, 401]);
    const row = await viewRow(id);
    expect([row["name"], row["deleted_at"]]).toEqual(["NO-LOGIN", null]);
  });

  it("K476-API-023 上限：同じ人が 1 分の上限を超えたら直すも消すも 429 と retry_after_sec（1〜60 の整数）", async () => {
    for (const [op, call] of [
      [
        "updateSavedView",
        (p: Awaited<ReturnType<typeof maker>>, id: string) => patchView(p, id, { name: `上限 ${Math.random()}` }),
      ],
      ["deleteSavedView", (p: Awaited<ReturnType<typeof maker>>, id: string) => deleteView(p, id)],
    ] as const) {
      const p = await maker("上限の人");
      const id = await seedView({ by: p, name: `LIMIT-${op}` });
      f.limits[op] = 2;
      try {
        await call(p, id);
        await call(p, id);
        const r = await call(p, id);
        expect(r.status, op).toBe(429);
        const s = Number((await json(r))["retry_after_sec"]);
        expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      } finally {
        f.limits[op] = 10_000;
      }
    }
  });

  it("K476-API-024 失敗（手順 S2：証跡を書く）：直す・消すの証跡を書く所で DB が落ちると 500。名前も消した印も前のまま（1 つの取引）・ログに条件の字は無い。戻れば同じ操作が通る", async () => {
    const c = await maker("壊れる人");
    const upd = await seedView({ by: c, name: "BOOM-UPD" });
    const del = await seedView({ by: c, name: "BOOM-DEL" });
    await f.admin.query(`create or replace function public.k476_boom() returns trigger language plpgsql as $$
      begin
        if new.action in ('saved_views.update', 'saved_views.delete') and new.actor_member_id = '${c.id}'::uuid then
          raise exception 'K476 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k476_boom before insert on audit_events for each row execute function public.k476_boom()",
    );
    try {
      const out: number[] = [];
      const logs = await captureLogs(async () => {
        out.push((await patchView(c, upd, { name: "BOOM-UPD-2", filters: { q: "秘密の言葉" } })).status);
        out.push((await deleteView(c, del)).status);
      });
      expect(out).toEqual([500, 500]);
      expect(logs).not.toContain("秘密の言葉");
      expect((await viewRow(upd))["name"]).toBe("BOOM-UPD");
      expect((await viewRow(del))["deleted_at"]).toBeNull();
    } finally {
      await f.admin.query("drop trigger if exists k476_boom on audit_events");
      await f.admin.query("drop function if exists public.k476_boom()");
    }
    expect((await patchView(c, upd, { name: "BOOM-UPD-2" })).status).toBe(200);
    expect((await deleteView(c, del)).status).toBe(200);
  });

  it("K476-API-025 失敗（手順 S1：DB に書く）：行を更新する所で DB が落ちると 500。名前も消した印も証跡も残らない。戻れば同じ操作が通る", async () => {
    const c = await maker("更新が壊れる人");
    const upd = await seedView({ by: c, name: "BOOM-ROW-UPD" });
    const del = await seedView({ by: c, name: "BOOM-ROW-DEL" });
    await f.admin.query(`create or replace function public.k476_boom_row() returns trigger language plpgsql as $$
      begin
        if new.member_id = '${c.id}'::uuid and new.name like 'BOOM-ROW-%' then raise exception 'K476 の試験で更新を壊した'; end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k476_boom_row before update on saved_views for each row execute function public.k476_boom_row()",
    );
    try {
      const out: number[] = [];
      await captureLogs(async () => {
        out.push((await patchView(c, upd, { density: "compact" })).status);
        out.push((await deleteView(c, del)).status);
      });
      expect(out).toEqual([500, 500]);
      expect((await viewRow(upd))["density"]).toBe("normal");
      expect((await viewRow(del))["deleted_at"]).toBeNull();
      expect(await audits("saved_views.update", upd)).toBe(0);
      expect(await audits("saved_views.delete", del)).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k476_boom_row on saved_views");
      await f.admin.query("drop function if exists public.k476_boom_row()");
    }
    expect((await patchView(c, upd, { density: "compact" })).status).toBe(200);
  });

  it("K476-API-026 同時に 2 回：同じ名前への改名を 2 本の条件で同時にすると 200 と 409 E-VWS-005 が 1 つずつ。同じ条件を同時に 2 回消すと 200 と 404 が 1 つずつ（証跡は 1 つ）", async () => {
    const c = await maker("同時に押す人");
    const x1 = await seedView({ by: c, name: "RACE-1" });
    const x2 = await seedView({ by: c, name: "RACE-2" });
    const two = await Promise.all([patchView(c, x1, { name: "RACE-SAME" }), patchView(c, x2, { name: "RACE-SAME" })]);
    expect(two.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await code(two.find((r) => r.status === 409)!)).toBe(VWS_SAME_NAME);
    const names = (await f.admin.query("select name from saved_views where id = any($1::uuid[])", [[x1, x2]])).rows.map(
      (r: { name: string }) => r.name,
    );
    expect(names.filter((n) => n === "RACE-SAME")).toHaveLength(1);
    const id = await seedView({ by: c, name: "RACE-DEL" });
    const dels = await Promise.all([deleteView(c, id), deleteView(c, id)]);
    expect(dels.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(await audits("saved_views.delete", id)).toBe(1);
  });

  it("K476-API-027 貯めない：直す・消すの答えの Cache-Control に private と no-store", async () => {
    const c = await maker();
    const id = await seedView({ by: c, name: "CACHE" });
    const p = await patchView(c, id, { name: "CACHE-2" });
    const d = await deleteView(c, id);
    for (const r of [p, d]) {
      const cc = r.headers.get("cache-control") ?? "";
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
    }
  });

  it("K476-API-028 別の会社：会社 B の人は会社 A の条件を直せない・消せない（404）。会社 B の人は自分の物を直せる", async () => {
    const c = await maker();
    const id = await gView(c, "CROSS-COMPANY");
    const mine = await seedView({ by: W.outsider, name: "B-MINE", share: "self", scope: null });
    expect([
      (await patchView(W.outsider, id, { name: "x" })).status,
      (await deleteView(W.outsider, id)).status,
    ]).toEqual([404, 404]);
    expect((await viewRow(id))["name"]).toBe("CROSS-COMPANY");
    expect((await patchView(W.outsider, mine, { name: "B-MINE-2" })).status).toBe(200);
  });

  it("K476-API-029 グループの席を移したあと：作った人が別のグループの席に移ると、前のグループの人に向けた物は前の席の人に見え続けるが、作った人は自分の物として直せる。移した先の見えないグループへは見せ直せない（404 E-VWS-004）", async () => {
    const c = await maker("席を移す人");
    const id = await gView(c, "MOVED-SEAT");
    await f.admin.query("update members set scope_id = $2 where id = $1", [c.id, W.g2]);
    const r = await patchView(c, id, { name: "MOVED-SEAT-2" });
    expect(r.status, await r.clone().text()).toBe(200);
    const sub = (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name) values ($1, $2, '移したあとの下') returning id",
        [W.tenantId, W.g1],
      )
    ).id;
    const back = await patchView(c, id, { scope_id: sub });
    expect(back.status).toBe(404);
    expect(await code(back)).toBe(VWS_NO_SCOPE);
    expect((await asMember(W.mate, "select 1 from saved_views where id = $1", [id])).length).toBe(1);
  });
});
