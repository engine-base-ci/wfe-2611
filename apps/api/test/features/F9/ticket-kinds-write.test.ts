// K-704「種別を足す・直す（名前・色・本文のひな形）・並べる・消す」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K704-API-… / K704-DB-…）は 11_tickets/K-704.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない。実装の前に流して赤を確かめない。
//
// 試験が決める口の形（設計は 07_functional/段10-F9/土台-settings.md。契約は 05_flow/screen_api.d/K-704.py で作る）:
//   createTicketKind    POST   /api/v1/ticket_kinds        { name, color_key, body_template? }          201 { data: TicketKindSetting }
//   updateTicketKind    PATCH  /api/v1/ticket_kinds/:id    { name?, color_key?, body_template? }        200 { data: TicketKindSetting }
//   deleteTicketKind    DELETE /api/v1/ticket_kinds/:id                                                 200 { data: { id } }
//   reorderTicketKinds  POST   /api/v1/ticket_kinds/order  { kind_ids: uuid[] }                         200 { data: TicketKindSetting[] }
//   TicketKindSetting = { id, name, color_key, position, is_builtin, body_template }（鍵ちょうど 6）。body_template は文書の木か null
//   color_key は indigo・teal・amber・coral・sage・plum・lavender・teal-light の 8 つ。権限は ticket_kinds の edit
//   断る：形の誤り 422（欄つき）／無い・見えない 404 E-PAGE-001／同じ名前 409 E-KND-001／11 個目 409 E-KND-002／使っている 409 E-KND-003（detail.ticket_count）／
//         並びが今と合わない 409 E-KND-004／最後の 1 つ 409 E-KND-005／権限なし 403／ログインなし 401／上限 429／DB の失敗 503 E-PAGE-003
// DB（migration 20261125014400_ticket_kind_settings.sql）:
//   ticket_kinds.color_key（8 つの check）・app.tone_hex(text)・引き金で color（16 進）を color_key に合わせる・app.ticket_kind_color_key_from_hex(text)・
//   一意の索引 (tenant_id, name) where deleted_at is null・app.ticket_kind_create / update / delete / reorder（security definer・答えは jsonb。断りは { error: <言葉> }）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { isFlat, startSettings, type Json, type Settings, type World } from "./settings.harness.js";

const KEYS = ["body_template", "color_key", "id", "is_builtin", "name", "position"];
const DOC = (text: string) => ({
  type: "doc",
  content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] }],
});
let s: Settings;
let A: World;
let B: World;
beforeAll(async () => {
  s = await startSettings(["ticket-kinds-write"]);
  A = await s.world("設定 種別 A");
  B = await s.world("設定 種別 B");
});
afterAll(async () => {
  await s.close();
});
const create = (w: World, body: unknown, who = w.admin) => s.call(who, "POST", "/ticket_kinds", body);
const update = (w: World, id: string, body: unknown, who = w.admin) =>
  s.call(who, "PATCH", `/ticket_kinds/${id}`, body);
const del = (w: World, id: string, who = w.admin) => s.call(who, "DELETE", `/ticket_kinds/${id}`);
const order = (w: World, ids: string[], who = w.admin) => s.call(who, "POST", "/ticket_kinds/order", { kind_ids: ids });
const live = async (w: World): Promise<{ id: string; name: string; position: number; color: string | null }[]> =>
  (
    await s.f.admin.query(
      "select id, name, position, color from ticket_kinds where tenant_id = $1 and deleted_at is null order by position, id",
      [w.tenantId],
    )
  ).rows;
const list = async (
  w: World,
): Promise<{ id: string; name: string; color_key: string | null; body_template: unknown }[]> =>
  ((await s.json(await s.call(w.admin, "GET", "/ticket_kinds"))).data ?? []) as never;
const ctxOf = (w: World, p = w.admin): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
/** 試験どうしで混ざらない新しい会社（種別の数・並びを数える試験用） */
const fresh = (_from: World): Promise<World> => s.world("設定 種別 一時");

describe("種別を足す", () => {
  it("K704-API-001 足す：201・鍵ちょうど 6・並びは最後・読み直すと出る", async () => {
    const r = await create(A, { name: "請求", color_key: "teal" });
    expect(r.status).toBe(201);
    const d = ((await s.json(r)).data ?? {}) as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d["color_key"]).toBe("teal");
    expect(d["is_builtin"]).toBe(false);
    expect(d["body_template"]).toBeNull();
    const all = await live(A);
    expect(all[all.length - 1]!.id).toBe(d["id"]);
    expect((await list(A)).some((k) => k.id === d["id"] && k.color_key === "teal")).toBe(true);
  });
  it("K704-API-002 足す：本文のひな形を持てる・無ければ null・読み直しで同じ木", async () => {
    const r = await create(A, { name: "問い合わせ", color_key: "amber", body_template: DOC("目的") });
    expect(r.status).toBe(201);
    const id = (((await s.json(r)).data ?? {}) as { id: string }).id;
    expect((await list(A)).find((k) => k.id === id)!.body_template).toEqual(DOC("目的"));
    const none = await create(A, { name: "不具合", color_key: "coral", body_template: null });
    expect((((await s.json(none)).data ?? {}) as { body_template: unknown }).body_template).toBeNull();
  });
  it("K704-API-003 名前の形：前後の空白（全角・タブ）は落とす・空白だけ・41 字・NUL は 422（欄 name）・40 字は通る", async () => {
    const ok = await create(A, { name: "　\t四十　", color_key: "sage" });
    expect(((await s.json(ok)).data as { name: string }).name).toBe("四十");
    for (const name of ["　 \t", "あ".repeat(41), "あ\u0000い", ""]) {
      const r = await create(A, { name, color_key: "sage" });
      expect(r.status, JSON.stringify(name)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain("name");
    }
    expect((await create(A, { name: "字".repeat(40), color_key: "sage" })).status).toBe(201);
  });
  it("K704-API-004 色の形：8 つの外・無い・文字でない は 422（欄 color_key）", async () => {
    for (const color_key of ["red", "#186F69", "TEAL", 3, null, undefined]) {
      const r = await create(A, color_key === undefined ? { name: "色なし" } : { name: "色", color_key });
      expect(r.status, String(color_key)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain("color_key");
    }
  });
  it("K704-API-005 同じ名前は 409 E-KND-001（欄なし）・消した名前は使い回せる", async () => {
    expect((await create(A, { name: "重複", color_key: "plum" })).status).toBe(201);
    const dup = await create(A, { name: "重複", color_key: "plum" });
    expect(dup.status).toBe(409);
    const b = await s.json(dup);
    expect(b["code"]).toBe("E-KND-001");
    expect(isFlat(b)).toBe(true);
    const id = await s.kindId(A, "重複");
    expect((await del(A, id)).status).toBe(200);
    expect((await create(A, { name: "重複", color_key: "plum" })).status).toBe(201);
    expect((await create(B, { name: "重複", color_key: "plum" })).status).toBe(201);
  });
  it("K704-API-006 11 個目は 409 E-KND-002・足されない・別の会社の数は数えない", async () => {
    const w = await fresh(A);
    const have = (await live(w)).length;
    for (let i = have; i < 10; i += 1)
      expect((await create(w, { name: `種別${i}`, color_key: "indigo" })).status).toBe(201);
    const r = await create(w, { name: "あふれ", color_key: "indigo" });
    expect(r.status).toBe(409);
    expect((await s.json(r))["code"]).toBe("E-KND-002");
    expect((await live(w)).length).toBe(10);
    expect((await create(B, { name: "別の会社の 1 つ", color_key: "indigo" })).status).toBe(201);
  });
});

describe("種別を直す", () => {
  it("K704-API-007 直す：名前・色・ひな形が変わり読み直しで同じ・色の 16 進も色に合わせて変わる", async () => {
    const id = (((await s.json(await create(A, { name: "直す前", color_key: "indigo" }))).data ?? {}) as { id: string })
      .id;
    const r = await update(A, id, { name: "直した後", color_key: "lavender", body_template: DOC("参考") });
    expect(r.status).toBe(200);
    expect(Object.keys(((await s.json(r)).data ?? {}) as object).sort()).toEqual(KEYS);
    const k = (await list(A)).find((x) => x.id === id)!;
    expect(k).toMatchObject({ name: "直した後", color_key: "lavender", body_template: DOC("参考") });
    expect((await live(A)).find((x) => x.id === id)!.color).toBe("#6B5B99");
  });
  it("K704-API-008 一部だけ：送らない物は変わらない・body_template に null で外す・空の体は 422", async () => {
    const id = (
      ((await s.json(await create(A, { name: "一部", color_key: "sage", body_template: DOC("目的") }))).data ?? {}) as {
        id: string;
      }
    ).id;
    await update(A, id, { name: "一部だけ直す" });
    expect((await list(A)).find((x) => x.id === id)).toMatchObject({ color_key: "sage", body_template: DOC("目的") });
    await update(A, id, { body_template: null });
    expect((await list(A)).find((x) => x.id === id)!.body_template).toBeNull();
    expect((await update(A, id, {})).status).toBe(422);
  });
  it("K704-API-009 ひな形の木が壊れている・text を付けた は 422（欄 body_template）", async () => {
    const id = await s.kindId(A, "請求");
    for (const body_template of [
      { type: "paragraph" },
      "文字",
      { type: "doc", content: "x" },
      { ...DOC("a"), text: "x" },
    ]) {
      const r = await update(A, id, { body_template });
      expect(r.status, JSON.stringify(body_template)).toBe(422);
      expect(JSON.stringify((await s.json(r)).details)).toContain("body_template");
    }
  });
  it("K704-API-010 別の種別と同じ名前に直すと 409 E-KND-001・自分の名前のままは通る", async () => {
    const id = await s.kindId(A, "請求");
    const r = await update(A, id, { name: "問い合わせ" });
    expect(r.status).toBe(409);
    expect((await s.json(r))["code"]).toBe("E-KND-001");
    expect((await update(A, id, { name: "請求", color_key: "teal" })).status).toBe(200);
  });
  it("K704-API-011 無い・消した・別の会社の種別は 404 E-PAGE-001（欄・details なし）・uuid でない道は 422", async () => {
    const gone = await s.newKind(A, "消す予定");
    await del(A, gone);
    const foreign = await s.kindId(B, "タスク");
    for (const id of [gone, foreign, "00000000-0000-4000-8000-000000000000"]) {
      for (const r of [await update(A, id, { name: "x" }), await del(A, id)]) {
        expect(r.status, id).toBe(404);
        const b = await s.json(r);
        expect(b["code"]).toBe("E-PAGE-001");
        expect(isFlat(b)).toBe(true);
      }
    }
    expect((await update(A, "not-a-uuid", { name: "x" })).status).toBe(422);
    expect((await s.kindId(B, "タスク")).length).toBeGreaterThan(0);
  });
});

describe("種別を消す・並べる", () => {
  it("K704-API-012 使っていない種別は消せる：読みから消え名前を使い回せ、ほかの種別のチケットは変わらない", async () => {
    const id = await s.newKind(A, "使わない");
    const keep = await s.ticket(A);
    const r = await del(A, id);
    expect(r.status).toBe(200);
    expect(((await s.json(r)).data as { id: string }).id).toBe(id);
    expect((await list(A)).some((k) => k.id === id)).toBe(false);
    expect(await s.n("select count(*) n from tickets where id = $1 and deleted_at is null", [keep])).toBe(1);
  });
  it("K704-API-013 使っているチケットが在る種別は 409 E-KND-003・枚数が detail に入る・消したチケットも数える・消えない", async () => {
    const id = await s.newKind(A, "使っている");
    await s.ticket(A, { kindId: id });
    await s.ticket(A, { kindId: id, deleted: true });
    const r = await del(A, id);
    expect(r.status).toBe(409);
    const b = await s.json(r);
    expect(b["code"]).toBe("E-KND-003");
    expect(b["detail"]).toEqual({ ticket_count: 2 });
    expect("field" in b || "details" in b).toBe(false);
    expect(await s.n("select count(*) n from ticket_kinds where id = $1 and deleted_at is null", [id])).toBe(1);
  });
  it("K704-API-014 最後の 1 つは消せない 409 E-KND-005", async () => {
    const w = await fresh(A);
    const all = await live(w);
    for (const k of all.slice(1)) expect((await del(w, k.id)).status).toBe(200);
    const r = await del(w, all[0]!.id);
    expect(r.status).toBe(409);
    expect((await s.json(r))["code"]).toBe("E-KND-005");
    expect((await live(w)).length).toBe(1);
  });
  it("K704-API-015 並べる：渡した順になり読み直しも同じ順・答えは全部の種別", async () => {
    const ids = (await live(A)).map((k) => k.id).reverse();
    const r = await order(A, ids);
    expect(r.status).toBe(200);
    expect((((await s.json(r)).data ?? []) as { id: string }[]).map((k) => k.id)).toEqual(ids);
    expect((await list(A)).map((k) => k.id)).toEqual(ids);
  });
  it("K704-API-016 並びが今と合わない（足りない・余る・重なる・消した物・別の会社の物）は 409 E-KND-004・何も変わらない・uuid でない要素は 422", async () => {
    const before = (await live(A)).map((k) => k.id);
    const gone = await s.newKind(A, "並べ用");
    await del(A, gone);
    const bad = [
      before.slice(1),
      [...before, randomId()],
      [before[0]!, ...before],
      [...before, gone],
      [...before, await s.kindId(B, "タスク")],
    ];
    for (const ids of bad) {
      const r = await order(A, ids);
      expect(r.status).toBe(409);
      expect((await s.json(r))["code"]).toBe("E-KND-004");
    }
    expect((await live(A)).map((k) => k.id)).toEqual(before);
    expect((await order(A, ["x"])).status).toBe(422);
    expect((await order(A, [])).status).toBe(422);
  });
});

describe("守り・記録・失敗", () => {
  it("K704-API-017 権限が無い人は 4 つとも 403・何も変わらない／ログインなしは 401", async () => {
    const id = await s.kindId(A, "請求");
    const n0 = (await live(A)).length;
    const rs = [
      await create(A, { name: "権限なし", color_key: "teal" }, A.member),
      await update(A, id, { name: "権限なし" }, A.member),
      await del(A, id, A.member),
      await order(
        A,
        (await live(A)).map((k) => k.id),
        A.member,
      ),
    ];
    for (const r of rs) expect(r.status).toBe(403);
    expect((await live(A)).length).toBe(n0);
    expect((await s.kindId(A, "請求")).length).toBeGreaterThan(0);
    expect((await s.call(null, "POST", "/ticket_kinds", { name: "x", color_key: "teal" })).status).toBe(401);
  });
  it("K704-API-018 別の会社の管理者は触れない：自分の会社の種別だけ並べ・足せ、相手の物は 404／409", async () => {
    const mine = (await live(B)).map((k) => k.id);
    const theirs = await s.kindId(A, "請求");
    expect((await update(B, theirs, { name: "のっとり" }, B.admin)).status).toBe(404);
    expect((await order(B, [...mine, theirs], B.admin)).status).toBe(409);
    expect((await s.kindId(A, "請求")).length).toBeGreaterThan(0);
    expect((await list(B)).some((k) => k.id === theirs)).toBe(false);
  });
  it("K704-API-019 1 分あたりの上限を超えた書きは 429・retry_after_sec が数", async () => {
    s.f.limits["createTicketKind"] = 2;
    const w = await fresh(A);
    const ip = "198.51.100.77";
    const hit = () =>
      s.f.req("POST", "/ticket_kinds", {
        headers: w.admin.auth,
        ip,
        body: { name: `n${Math.random()}`, color_key: "teal" },
      });
    await hit();
    await hit();
    const r = await hit();
    delete s.f.limits["createTicketKind"];
    expect(r.status).toBe(429);
    expect(typeof ((await s.json(r)) as Json)["retry_after_sec"]).toBe("number");
  });
  it("K704-API-020 手順 1・2：書くたびに証跡（audit_events）が 1 行・会社・操作した人・C2・対象の種別つき（失敗した書きには残らない）", async () => {
    const w = await fresh(A);
    const before = await s.n(
      "select count(*) n from audit_events where tenant_id = $1 and target_type = 'ticket_kinds'",
      [w.tenantId],
    );
    const id = (((await s.json(await create(w, { name: "証跡", color_key: "teal" }))).data ?? {}) as { id: string }).id;
    await update(w, id, { color_key: "plum" });
    await order(
      w,
      (await live(w)).map((k) => k.id),
    );
    await del(w, id);
    await create(w, { name: "タスク", color_key: "teal" });
    const rows = (
      await s.f.admin.query<{ action: string; actor_member_id: string; choke_point_id: string; target_id: string }>(
        "select action, actor_member_id, choke_point_id, target_id from audit_events where tenant_id = $1 and target_type = 'ticket_kinds' order by occurred_at, id",
        [w.tenantId],
      )
    ).rows;
    expect(rows.length - before).toBe(4);
    expect(rows.map((r) => r.action)).toEqual([
      "ticket_kind.create",
      "ticket_kind.update",
      "ticket_kind.reorder",
      "ticket_kind.delete",
    ]);
    expect(rows.every((r) => r.actor_member_id === w.admin.id && r.choke_point_id === "C2")).toBe(true);
    expect(rows[0]!.target_id).toBe(id);
  });
  it("K704-API-021 失敗（手順 1）：種別の行を書く所で DB が落ちる → 503 E-PAGE-003・種別も証跡も増えない", async () => {
    const w = await fresh(A);
    const n0 = (await live(w)).length;
    const a0 = await s.n("select count(*) n from audit_events where tenant_id = $1", [w.tenantId]);
    const fix = await s.breakWrites("ticket_kinds");
    try {
      const r = await create(w, { name: "落ちる", color_key: "teal" });
      expect(r.status).toBe(503);
      expect((await s.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await live(w)).length).toBe(n0);
    expect(await s.n("select count(*) n from audit_events where tenant_id = $1", [w.tenantId])).toBe(a0);
  });
  it("K704-API-022 失敗（手順 2）：証跡を書く所で DB が落ちる → 503 E-PAGE-003・同じ取引なので種別の行も前のまま（名前・色が戻る）", async () => {
    const w = await fresh(A);
    const id = await s.kindId(w, "タスク");
    const fix = await s.breakWrites("audit_events");
    try {
      const r = await update(w, id, { name: "証跡で落ちる", color_key: "plum" });
      expect(r.status).toBe(503);
      expect((await s.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await s.n("select count(*) n from ticket_kinds where id = $1 and name = 'タスク'", [id])).toBe(1);
  });
});

describe("DB の守り", () => {
  it("K704-DB-001 色：color_key は 8 つ以外を DB が断る（23514）・入れると color（16 進）が合う・変えると追いかける・既存の物は 16 進から色の名前が付く", async () => {
    const bad = s.f.admin.query("insert into ticket_kinds (tenant_id, name, color_key) values ($1, '悪い色', 'red')", [
      A.tenantId,
    ]);
    await expect(bad).rejects.toMatchObject({ code: "23514" });
    const id = await s.one(
      "insert into ticket_kinds (tenant_id, name, color_key) values ($1, '色合わせ', 'coral') returning id",
      [A.tenantId],
    );
    const hex = async () =>
      (await s.f.admin.query<{ color: string }>("select color from ticket_kinds where id = $1", [id])).rows[0]!.color;
    expect(await hex()).toBe("#A34A3E");
    await s.f.admin.query("update ticket_kinds set color_key = 'teal-light' where id = $1", [id]);
    expect(await hex()).toBe("#537E7B");
    const pairs: [string, string][] = [
      ["#186F69", "teal"],
      ["#B45309", "amber"],
      ["#6B5B99", "lavender"],
      ["#22345C", "indigo"],
      ["#123456", "indigo"],
    ];
    for (const [h, key] of pairs) {
      const got = (await s.f.admin.query<{ k: string }>("select app.ticket_kind_color_key_from_hex($1) k", [h]))
        .rows[0]!.k;
      expect(got, h).toBe(key);
    }
    const builtin = (
      await s.f.admin.query<{ color_key: string | null }>(
        "select color_key from ticket_kinds where tenant_id = $1 and is_builtin",
        [A.tenantId],
      )
    ).rows;
    expect(builtin.length).toBeGreaterThan(0);
    expect(builtin.every((r) => r.color_key !== null)).toBe(true);
  });
  it("K704-DB-002 名前の一意：同じ会社の消していない同じ名前は DB が断る（23505）・消した名前・別の会社の同じ名前は入る", async () => {
    await s.newKind(A, "一意");
    await expect(s.newKind(A, "一意")).rejects.toMatchObject({ code: "23505" });
    await s.f.admin.query("update ticket_kinds set deleted_at = now() where tenant_id = $1 and name = '一意'", [
      A.tenantId,
    ]);
    await expect(s.newKind(A, "一意")).resolves.toBeTruthy();
    await expect(s.newKind(B, "一意")).resolves.toBeTruthy();
  });
  it("K704-DB-003 関数の守り：edit の権限が無い人が関数を直に呼んでも { error: forbidden } で何も書かない／権限のある人は書ける", async () => {
    const n0 = (await live(A)).length;
    const call = (p: typeof A.member) =>
      withTenant(
        s.f.pool,
        ctxOf(A, p),
        async (c) =>
          (await c.query("select app.ticket_kind_create($1, $2, null) r", ["関数で足す", "teal"])).rows[0]!.r as {
            error?: string;
          },
      );
    expect(await call(A.member)).toMatchObject({ error: "forbidden" });
    expect((await live(A)).length).toBe(n0);
    expect((await call(A.admin)).error).toBeUndefined();
    expect((await live(A)).length).toBe(n0 + 1);
  });
});

function randomId(): string {
  return "11111111-1111-4111-8111-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}
