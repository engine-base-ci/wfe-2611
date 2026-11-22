// K-563「会社が足す項目の表（custom_fields・custom_field_kinds・ticket_field_values）と読む口（listTicketFields）・分類の軸の移しと凍結」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K563-API-…）は 11_tickets/K-563.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
// 準備の行は DB に直に入れる（行の守りの外・admin）。項目のマスタを作る・直す口は段 10（この葉は作らない）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-563.py で作る）:
//   listTicketFields  GET /api/v1/ticket-fields?kind_id=<uuid>（そのワークスペースのメンバー・120 回／分／人）
//     200 { data: TicketField[] }・Cache-Control: private, no-store
//     TicketField = { id, name, field_type, required, description, options, position }
//       field_type は short_text・long_text・number・date・select・multi_select・check の 7 つ。options は select・multi_select だけ
//       [{ id, name, position }] を position の順に持ち、ほかの型は []。description は文か null
//     並びは position の昇順（同じなら作った順・id）。消した項目は出ない
//     kind_id あり：custom_field_kinds に行のある項目はその種別だけ・行の無い項目は全部の種別に出る。kind_id なし：消していない項目を全部
//     kind_id が無い・消された・別の会社の種別なら 404（field・details を付けない）。uuid の形でなければ 422（欄 kind_id）
//   listClassAxes（GET /api/v1/class_axes）は外す。道そのものが無くなる（404）
// DB（migration 20261122096300_custom_fields.sql）:
//   custom_fields：name（空白を除いて 1〜40 字・同じ会社の消していない物で一意）・field_type（7 つ）・required・description・options（jsonb の配列・選ぶ型だけ中身）・position・共通の列
//   custom_field_kinds：field_id・kind_id（同じ会社の物・消していない組で一意）
//   ticket_field_values：ticket_id・field_id・value（jsonb・null でない）・共通の列（同じチケット・同じ項目で消していない行は 1 つ）
//   app.custom_fields_move_axes(p_tenant uuid) returns jsonb：class_axes（作り付けでない物）を項目に、class_values を選択肢に、ticket_class_values を値に移す（何度流しても増えない）。
//     項目の id は軸の id・選択肢の id は値の id・値（select）は選択肢の id の文字。class_axes・class_values・ticket_class_values は凍結（行は消さない）
//   行の守り：custom_fields・custom_field_kinds は会社のメンバーが読み、直せるのは custom_fields の edit の権限を持つ人／ticket_field_values は元のチケットを読める人が読み、書ける人が書く
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const KEYS = ["description", "field_type", "id", "name", "options", "position", "required"];
const TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"];
interface Field {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string | null;
  options: { id: string; name: string; position: number }[];
  position: number;
}
interface World {
  tenantId: string;
  rootScope: string;
  kindId: string;
  writer: Person;
  viewer: Person;
  stranger: Person;
}
type Json = Record<string, unknown> & { data?: unknown };

let f: Fixture;
let loading: Promise<void> | null = null;
/** 口の振る舞い（hooks のファイル）を最初の要求のときに 1 回だけ読む（準備で読まない・answer=8f745003d023） */
const ready = (): Promise<void> =>
  (loading ??= (async () => {
    const m = (await import(join(HERE, "..", "..", "..", "src", "hooks", "ticket-fields-read.ts"))) as { register: HookModule };
    Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
  })());
const call = async (who: Person | null, path: string, headers?: Record<string, string>) => {
  await ready();
  return f.req("GET", path, { headers: { ...(who ? who.auth : {}), ...(headers ?? {}) } });
};
const json = async (r: Response) => (await r.json()) as Json;
const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;

let A: World;
let B: World;
const world = async (label: string): Promise<World> => {
  const c = await f.company(`${label} ${Math.random().toString(36).slice(2, 7)}`, "EG");
  const kindId = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null", [c.tenantId]);
  return {
    ...c,
    kindId,
    writer: await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" }),
    viewer: await f.person(c.tenantId, c.rootScope, { name: "山田", ticketAbility: "view" }),
    stranger: await f.person(c.tenantId, c.rootScope, { name: "見えない人", ticketAbility: null }),
  };
};
/** 項目を DB に直に入れる（マスタの口は段 10）。options は [{name}] を渡すと id と並びを付ける */
const field = async (
  w: World,
  o: { name?: string; type?: string; required?: boolean; description?: string | null; options?: string[]; position?: number; deleted?: boolean } = {},
): Promise<{ id: string; options: { id: string; name: string; position: number }[] }> => {
  const options = (o.options ?? []).map((name, i) => ({ id: randomUUID(), name, position: i + 1 }));
  const id = await one(
    `insert into custom_fields (tenant_id, name, field_type, required, description, options, position, deleted_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) returning id`,
    [
      w.tenantId,
      o.name ?? `項目 ${randomUUID().slice(0, 6)}`,
      o.type ?? "short_text",
      o.required ?? false,
      o.description ?? null,
      JSON.stringify(options),
      o.position ?? 0,
      o.deleted ? new Date().toISOString() : null,
    ],
  );
  return { id, options };
};
const forKind = (fieldId: string, w: World, kindId: string) =>
  f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [w.tenantId, fieldId, kindId]);
const newKind = (w: World, name: string) =>
  one("insert into ticket_kinds (tenant_id, name, position) values ($1, $2, 50) returning id", [w.tenantId, name]);
const ticket = async (w: World): Promise<string> => {
  const stage = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo' and deleted_at is null", [w.tenantId]);
  return one(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, updated_by)
     values ($1, $2, '', $3, $4, '請求書を送る', $5, $5, $5) returning id`,
    [w.tenantId, w.rootScope, w.kindId, stage, w.writer.id],
  );
};
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const ctxOf = (p: Person): TenantContext => ({ tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null });
const asApp = async (p: Person, sql: string, params: unknown[]): Promise<number | "denied"> => {
  try {
    return await withTenant(f.pool, ctxOf(p), async (cl) => (await cl.query(sql, params)).rowCount ?? 0);
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
};
const list = async (who: Person | null, w: World, kind?: string) =>
  call(who, `/ticket-fields${kind ? `?kind_id=${kind}` : ""}`);
const names = (r: Json) => (r.data as Field[]).map((x) => x.name);

beforeAll(async () => {
  f = await makeFixture([]);
  f.limits["listTicketFields"] = 100_000;
  A = await world("K563 会社 A");
  B = await world("K563 会社 B");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-563 会社が足す項目を読む（listTicketFields）", () => {
  it("K563-API-001 読む：200・鍵はちょうど 7・position の順（同じなら作った順）・消した項目と別の会社の項目は出ない・no-store", async () => {
    const w = await world("K563 並び");
    const c = await field(w, { name: "支払期日メモ", position: 20 });
    const a = await field(w, { name: "先方の担当", position: 10, description: "先方の窓口の名前" });
    const b = await field(w, { name: "同じ並びの 2 つ目", position: 20 });
    await field(w, { name: "消した項目", deleted: true });
    await field(B, { name: "別の会社の項目" });
    const r = await list(w.writer, w);
    expect(r.status, await r.clone().text()).toBe(200);
    const j = await json(r);
    const data = j.data as Field[];
    expect(data.map((x) => x.id)).toEqual([a.id, c.id, b.id]);
    expect(Object.keys(data[0]!).sort()).toEqual(KEYS);
    expect(data[0]).toMatchObject({ name: "先方の担当", field_type: "short_text", required: false, description: "先方の窓口の名前", options: [], position: 10 });
    expect(data[1]!.description).toBeNull();
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
  });

  it("K563-API-002 型 7 つ：型・必須・説明がそのまま返り、選択肢は 1 つ選ぶ・複数選ぶだけが {id, name, position} を position の順に持つ（ほかは空）", async () => {
    const w = await world("K563 型");
    const made: Record<string, { id: string; options: { id: string; name: string; position: number }[] }> = {};
    for (const [i, t] of TYPES.entries()) {
      const choose = t === "select" || t === "multi_select";
      made[t] = await field(w, { name: `型 ${t}`, type: t, required: t === "number", position: i, options: choose ? ["赤", "青", "黄"] : [] });
    }
    const data = (await json(await list(w.writer, w))).data as Field[];
    expect(data.map((x) => x.field_type)).toEqual(TYPES);
    expect(data.find((x) => x.field_type === "number")!.required).toBe(true);
    expect(data.find((x) => x.field_type === "short_text")!.required).toBe(false);
    for (const t of TYPES) {
      const got = data.find((x) => x.field_type === t)!;
      expect(got.options, t).toEqual(made[t]!.options);
    }
    expect(data.find((x) => x.field_type === "select")!.options.map((o) => [o.name, o.position])).toEqual([["赤", 1], ["青", 2], ["黄", 3]]);
  });

  it("K563-API-003 種別で絞る：その種別の行がある項目はその種別だけ・行の無い項目は全部の種別・消した行は数えない", async () => {
    const w = await world("K563 絞り込み");
    const other = await newKind(w, "別の種別");
    const onlyTask = await field(w, { name: "タスクだけ", position: 1 });
    const onlyOther = await field(w, { name: "別の種別だけ", position: 2 });
    await field(w, { name: "全部の種別", position: 3 });
    const both = await field(w, { name: "2 つの種別", position: 4 });
    await forKind(onlyTask.id, w, w.kindId);
    await forKind(onlyOther.id, w, other);
    await forKind(both.id, w, w.kindId);
    await forKind(both.id, w, other);
    expect(names(await json(await list(w.writer, w, w.kindId)))).toEqual(["タスクだけ", "全部の種別", "2 つの種別"]);
    expect(names(await json(await list(w.writer, w, other)))).toEqual(["別の種別だけ", "全部の種別", "2 つの種別"]);
    await f.admin.query("update custom_field_kinds set deleted_at = now() where field_id = $1 and kind_id = $2", [onlyOther.id, other]);
    expect(names(await json(await list(w.writer, w, other)))).toEqual(["全部の種別", "2 つの種別"]);
  });

  it("K563-API-004 種別を指さない：消していない項目を全部（種別の行があっても）。0 件なら data は []", async () => {
    const empty = await world("K563 空");
    expect((await json(await list(empty.writer, empty))).data).toEqual([]);
    const w = await world("K563 全部");
    const x = await field(w, { name: "あ", position: 1 });
    await field(w, { name: "い", position: 2 });
    await forKind(x.id, w, w.kindId);
    expect(names(await json(await list(w.writer, w)))).toEqual(["あ", "い"]);
  });

  it("K563-API-005 読むだけの人・チケットが見えない人も 200 で読める（マスタはワークスペースのメンバーが読む）", async () => {
    const w = await world("K563 読む人");
    await field(w, { name: "共通の項目" });
    for (const who of [w.viewer, w.stranger]) {
      const r = await list(who, w, w.kindId);
      expect(r.status).toBe(200);
      expect(names(await json(r))).toEqual(["共通の項目"]);
    }
  });

  it("K563-API-006 種別が無い・消された・別の会社：404（体は error と code だけ・在るかを漏らさない）", async () => {
    const w = await world("K563 404");
    const gone = await newKind(w, "消す種別");
    await f.admin.query("update ticket_kinds set deleted_at = now() where id = $1", [gone]);
    for (const [kind, why] of [[randomUUID(), "無い id"], [gone, "消された種別"], [B.kindId, "別の会社の種別"]] as const) {
      const r = await list(w.writer, w, kind);
      expect(r.status, why).toBe(404);
      const j = await json(r);
      expect(j["error"], why).toBe("not_found");
      expect(Object.keys(j).sort(), `${why}：field・details・detail を付けない`).toEqual(["code", "error"]);
    }
  });

  it("K563-API-007 種別の id が uuid の形でない・空：422・欄 kind_id（契約に書ける形の誤りだけ）", async () => {
    for (const bad of ["abc", "1234", "%20"]) {
      const r = await call(A.writer, `/ticket-fields?kind_id=${bad}`);
      expect(r.status, bad).toBe(422);
      const j = await json(r);
      expect(j["code"]).toBe("VALIDATION_ERROR");
      expect(((j["details"] as { field: string }[]) ?? []).map((d) => d.field)).toContain("kind_id");
    }
  });

  it("K563-API-008 ログインしていない：401。読めない", async () => {
    expect((await call(null, "/ticket-fields")).status).toBe(401);
  });

  it("K563-API-009 上限：1 分あたりの上限を超えた読みは 429・retry_after_sec が付く", async () => {
    const me = await f.person(A.tenantId, A.rootScope, { name: "数える人", ticketAbility: "edit" });
    f.limits["listTicketFields"] = 2;
    try {
      expect((await list(me, A)).status).toBe(200);
      expect((await list(me, A)).status).toBe(200);
      const r = await list(me, A);
      expect(r.status).toBe(429);
      expect(typeof (await json(r))["retry_after_sec"]).toBe("number");
    } finally {
      f.limits["listTicketFields"] = 100_000;
    }
  });

  it("K563-API-010 分類の軸の口は外れた：GET /class_axes は道ごと無い（404）。読む口は動く", async () => {
    await ready();
    const r = await f.req("GET", "/class_axes", { headers: A.writer.auth });
    expect(r.status).toBe(404);
    expect((await list(A.writer, A)).status).toBe(200);
  });
});

describe("K-563 表の守り（DB）", () => {
  it("K563-API-011 項目の守り：型の外・名前が空白だけ・41 字・選ぶ型でないのに選択肢がある・選択肢が配列でない・同じ会社の同じ名前は DB が断る。40 字と別の会社の同じ名前は入る", async () => {
    const w = await world("K563 守り 1");
    const ins = (name: string, type: string, options: string) =>
      f.admin.query("insert into custom_fields (tenant_id, name, field_type, options) values ($1, $2, $3, $4::jsonb)", [w.tenantId, name, type, options]);
    await expect(ins("型の外", "radio", "[]"), "型の外").rejects.toMatchObject({ code: "23514" });
    await expect(ins("　 \t", "short_text", "[]"), "空白だけ").rejects.toMatchObject({ code: "23514" });
    await expect(ins("あ".repeat(41), "short_text", "[]"), "41 字").rejects.toMatchObject({ code: "23514" });
    await expect(ins("選べない型に選択肢", "number", '[{"id":"1","name":"a","position":1}]'), "選ぶ型でない").rejects.toMatchObject({ code: "23514" });
    await expect(ins("配列でない", "select", "{}"), "配列でない").rejects.toMatchObject({ code: "23514" });
    expect(await n("select count(*) as n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(0);
    await ins("あ".repeat(40), "short_text", "[]");
    await expect(ins("あ".repeat(40), "long_text", "[]"), "同じ名前").rejects.toMatchObject({ code: "23505" });
    await f.admin.query("update custom_fields set deleted_at = now() where tenant_id = $1", [w.tenantId]);
    await ins("あ".repeat(40), "long_text", "[]"); // 消した後は同じ名前を使える
    await f.admin.query("insert into custom_fields (tenant_id, name, field_type) values ($1, $2, 'check')", [B.tenantId, "あ".repeat(40)]);
  });

  it("K563-API-012 種別の行・値の表の守り：別の会社の種別・項目・チケットは DB が断る（22023）。同じ組・同じチケットと項目の 2 行目は断る（23505）。値が null は断る（23502）", async () => {
    const w = await world("K563 守り 2");
    const x = await field(w);
    const bx = await field(B);
    const t = await ticket(w);
    const bt = await ticket(B);
    await expect(forKind(x.id, w, B.kindId), "別の会社の種別").rejects.toMatchObject({ code: "22023" });
    await expect(forKind(bx.id, w, w.kindId), "別の会社の項目").rejects.toMatchObject({ code: "22023" });
    await forKind(x.id, w, w.kindId);
    await expect(forKind(x.id, w, w.kindId), "同じ組").rejects.toMatchObject({ code: "23505" });
    const val = (ticketId: string, fieldId: string, v: string | null) =>
      f.admin.query("insert into ticket_field_values (tenant_id, ticket_id, field_id, value) values ($1, $2, $3, $4::jsonb)", [w.tenantId, ticketId, fieldId, v]);
    await expect(val(bt, x.id, '"a"'), "別の会社のチケット").rejects.toMatchObject({ code: "22023" });
    await expect(val(t, bx.id, '"a"'), "別の会社の項目").rejects.toMatchObject({ code: "22023" });
    await expect(val(t, x.id, null), "値が null").rejects.toMatchObject({ code: "23502" });
    await val(t, x.id, '"先方の担当"');
    await expect(val(t, x.id, '"もう 1 つ"'), "同じチケットと項目").rejects.toMatchObject({ code: "23505" });
    expect(await n("select count(*) as n from ticket_field_values where ticket_id = $1", [t])).toBe(1);
  });

  it("K563-API-013 行の守り：別の会社の人は項目も値も読めず書けない・edit の権限が無い人は項目を書けない・権限のある人（管理者の束にも入っている）は書ける・値はチケットを書ける人が書き、見えない人は読めない", async () => {
    const w = await world("K563 行の守り");
    const x = await field(w, { name: "守る項目" });
    const t = await ticket(w);
    await f.admin.query("insert into ticket_field_values (tenant_id, ticket_id, field_id, value) values ($1, $2, $3, '\"a\"')", [w.tenantId, t, x.id]);
    expect(
      await n("select count(*) as n from role_bundle_defaults where role = 'admin' and target_kind_id = 'custom_fields' and ability_id = 'edit' and scope_kind = 'workspace'"),
      "管理者の束に custom_fields の edit が入っている",
    ).toBe(1);
    const outsider = B.writer;
    expect(await asApp(outsider, "select 1 from custom_fields where id = $1", [x.id])).toBe(0);
    expect(await asApp(outsider, "select 1 from ticket_field_values where ticket_id = $1", [t])).toBe(0);
    expect(await asApp(outsider, "update custom_fields set required = true where id = $1", [x.id])).toBe(0);
    expect(await asApp(w.viewer, "select 1 from custom_fields where id = $1", [x.id])).toBe(1);
    const ins = "insert into custom_fields (tenant_id, name, field_type) values ($1, $2, 'check')";
    expect(await asApp(w.writer, ins, [w.tenantId, "権限なしで足す"])).toBe("denied");
    await f.admin.query("insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'custom_fields', null, 'edit')", [w.tenantId, w.writer.id]);
    expect(await asApp(w.writer, ins, [w.tenantId, "権限ありで足す"])).toBe(1);
    expect(await asApp(w.writer, "select 1 from ticket_field_values where ticket_id = $1", [t])).toBe(1);
    expect(await asApp(w.stranger, "select 1 from ticket_field_values where ticket_id = $1", [t])).toBe(0);
    expect(await asApp(w.viewer, "update ticket_field_values set value = '\"b\"' where ticket_id = $1", [t])).toBe(0);
    expect(await asApp(w.writer, "update ticket_field_values set value = '\"b\"' where ticket_id = $1", [t])).toBe(1);
  });
});

describe("K-563 分類の軸の移しと凍結", () => {
  /** 軸 1 つと値 2 つを class_* に直に入れる */
  const axis = async (w: World, name: string, key: string, labels: string[], o: { builtin?: boolean; deleted?: boolean; position?: number } = {}) => {
    const id = await one(
      "insert into class_axes (tenant_id, key, name, is_builtin, position, deleted_at) values ($1, $2, $3, $4, $5, $6) returning id",
      [w.tenantId, key, name, o.builtin ?? false, o.position ?? 1, o.deleted ? new Date().toISOString() : null],
    );
    const values: string[] = [];
    for (const [i, label] of labels.entries())
      values.push(await one("insert into class_values (tenant_id, axis_id, label, position) values ($1, $2, $3, $4) returning id", [w.tenantId, id, label, i + 1]));
    return { id, values };
  };
  const tag = (w: World, ticketId: string, valueId: string, deleted = false) =>
    f.admin.query("insert into ticket_class_values (tenant_id, ticket_id, value_id, deleted_at) values ($1, $2, $3, $4)", [w.tenantId, ticketId, valueId, deleted ? new Date().toISOString() : null]);
  const move = async (w: World) => (await f.admin.query<{ v: Record<string, number> }>("select app.custom_fields_move_axes($1) as v", [w.tenantId])).rows[0]!.v;

  it("K563-API-014 軸 → 項目：作り付けでない軸だけが「1 つ選ぶ」の項目になる（id・名前・並びは軸のまま・必須でない・どの種別にも出る）。値が選択肢（id・名前・並び）。消した軸と消した値・優先度は移らない", async () => {
    const w = await world("K563 移し 1");
    const pri = await n("select count(*) as n from class_axes where tenant_id = $1 and key = 'priority' and is_builtin", [w.tenantId]);
    expect(pri, "新しい会社には作り付けの優先度の軸がある").toBe(1);
    const size = await axis(w, "規模", "size", ["大", "小"], { position: 3 });
    const gone = await axis(w, "消した軸", "gone", ["x"], { deleted: true });
    const part = await axis(w, "部分", "part", ["残る", "消す"]);
    await f.admin.query("update class_values set deleted_at = now() where id = $1", [part.values[1]]);
    await move(w);
    const rows = (await f.admin.query<{ id: string; name: string; field_type: string; required: boolean; options: Field["options"]; position: number }>(
      "select id, name, field_type, required, options, position from custom_fields where tenant_id = $1 and deleted_at is null order by position, name", [w.tenantId])).rows;
    expect(rows.map((r) => r.id).sort()).toEqual([size.id, part.id].sort());
    const s = rows.find((r) => r.id === size.id)!;
    expect(s).toMatchObject({ name: "規模", field_type: "select", required: false, position: 3 });
    expect(s.options).toEqual([{ id: size.values[0], name: "大", position: 1 }, { id: size.values[1], name: "小", position: 2 }]);
    expect(rows.find((r) => r.id === part.id)!.options).toEqual([{ id: part.values[0], name: "残る", position: 1 }]);
    expect(rows.some((r) => r.id === gone.id), "消した軸").toBe(false);
    expect(await n("select count(*) as n from custom_fields where tenant_id = $1 and name = '優先度'", [w.tenantId]), "優先度は移さない").toBe(0);
    expect(await n("select count(*) as n from custom_field_kinds where tenant_id = $1", [w.tenantId]), "種別の行は作らない（全部の種別に出る）").toBe(0);
    const r = await list(w.writer, w, w.kindId);
    expect(names(await json(r))).toEqual(["規模", "部分"]);
  });

  it("K563-API-015 付けた値 → 項目の値：選択肢の id の文字になる。同じ軸に 2 つ付いていた物は最初の 1 つだけ。消した行・消した値・消したチケットの行・優先度は移らない", async () => {
    const w = await world("K563 移し 2");
    const size = await axis(w, "規模", "size", ["大", "小", "中"]);
    const t1 = await ticket(w);
    const t2 = await ticket(w);
    const t3 = await ticket(w);
    await tag(w, t1, size.values[0]!);
    await tag(w, t1, size.values[1]!); // 同じ軸の 2 つ目（落とす）
    await tag(w, t2, size.values[2]!, true); // 消した行
    await move(w);
    const v = async (t: string) => (await f.admin.query<{ field_id: string; value: unknown }>("select field_id, value from ticket_field_values where ticket_id = $1 and deleted_at is null", [t])).rows;
    expect(await v(t1)).toEqual([{ field_id: size.id, value: size.values[0] }]);
    expect(await v(t2)).toEqual([]);
    expect(await v(t3)).toEqual([]);
    const t4 = await ticket(w);
    await tag(w, t4, size.values[0]!);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t4]);
    await move(w);
    expect((await v(t4)).length, "消したチケットの値も写す（消した印はチケットの物）").toBe(1);
  });

  it("K563-API-016 何度流しても増えない・凍結の表の行は消えない・別の会社には触れない", async () => {
    const w = await world("K563 移し 3");
    const other = await world("K563 移し 3 別");
    const size = await axis(w, "規模", "size", ["大", "小"]);
    await axis(other, "他社の軸", "x", ["a"]);
    const t = await ticket(w);
    await tag(w, t, size.values[0]!);
    const before = {
      axes: await n("select count(*) as n from class_axes where tenant_id = $1", [w.tenantId]),
      values: await n("select count(*) as n from class_values where tenant_id = $1", [w.tenantId]),
      tags: await n("select count(*) as n from ticket_class_values where tenant_id = $1", [w.tenantId]),
    };
    const first = await move(w);
    const second = await move(w);
    expect(await n("select count(*) as n from custom_fields where tenant_id = $1", [w.tenantId])).toBe(1);
    expect(await n("select count(*) as n from ticket_field_values where tenant_id = $1", [w.tenantId])).toBe(1);
    expect(first).toMatchObject({ fields: 1, values: 1 });
    expect(second).toMatchObject({ fields: 0, values: 0 });
    expect(await n("select count(*) as n from class_axes where tenant_id = $1", [w.tenantId])).toBe(before.axes);
    expect(await n("select count(*) as n from class_values where tenant_id = $1", [w.tenantId])).toBe(before.values);
    expect(await n("select count(*) as n from ticket_class_values where tenant_id = $1", [w.tenantId])).toBe(before.tags);
    expect(await n("select count(*) as n from custom_fields where tenant_id = $1", [other.tenantId]), "別の会社は移していない").toBe(0);
  });

  it("K563-API-017 凍結：目録（db-catalog.json）で 3 つの表が frozen・理由つき。コード（apps/api/src）は 3 つの表を使わない。新しい 3 つの表は目録にある", async () => {
    const cat = JSON.parse(readFileSync(join(ROOT, "03_architecture", "db-catalog.json"), "utf-8")) as { tables: Record<string, { class: string; why: string }> };
    for (const t of ["class_axes", "class_values", "ticket_class_values"]) {
      expect(cat.tables[t]?.class, t).toBe("frozen");
      expect(cat.tables[t]?.why.length ?? 0, `${t} の理由`).toBeGreaterThan(10);
    }
    for (const t of ["custom_fields", "custom_field_kinds", "ticket_field_values"]) expect(["skeleton", "internal"], t).toContain(cat.tables[t]?.class);
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? walk(join(d, x)) : /\.tsx?$/.test(x) ? [join(d, x)] : []));
    for (const file of walk(join(ROOT, "apps", "api", "src")))
      expect(readFileSync(file, "utf-8"), file).not.toMatch(/class_axes|class_values|ticket_class_values|listClassAxes/);
  });
});
