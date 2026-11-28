// K-992「運営のひな形の置き場と読む口 2 本」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-templates.harness.ts）。
// テストの名前の頭の行 ID（K992-…）は 11_tickets/K-992.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import {
  OPS_TENANT,
  startOpsTemplates,
  TEMPLATE_ROW_KEYS,
  TEMPLATES,
  type OpsTemplates,
} from "./ops-templates.harness.js";

let t: OpsTemplates;
let ops: Person;
beforeAll(async () => {
  t = await startOpsTemplates("k992", ["ops-templates-read"]);
  ops = await t.ops("配る佐野", ["distribute"]);
});
afterAll(async () => t?.close());

const list = async (who: Person = ops) => {
  const r = await t.act(who, "GET", TEMPLATES);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await t.json(r)).data ?? []) as Record<string, unknown>[];
};

describe("K-992 読む口", () => {
  it("K992-API-001 一覧：no-store・種別・状態・項目の順・8 欄・種別の summary・空の項目の summary", async () => {
    const r = await t.act(ops, "GET", TEMPLATES);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const rows = ((await t.json(r)).data ?? []) as Record<string, unknown>[];
    expect(rows.map((x) => x["key"])).toEqual(["kind", "state", "field"]);
    for (const x of rows) expect(Object.keys(x).sort()).toEqual([...TEMPLATE_ROW_KEYS].sort());
    for (const w of ["タスク", "課題", "QA", "会議"]) expect(String(rows[0]!["summary"])).toContain(w);
    expect((await t.dist("field")).items).toEqual([]);
    expect(rows[2]!["summary"]).toBe("チケットの欄の並び・必須。種別ごとに持つ");
    expect(Number(rows[0]!["version"])).toBeGreaterThanOrEqual(1);
  });

  it("K992-API-002 数：顧客の会社を 2 つ作ると種別の using が 2 多い。知らせた会社が無ければ took は null・2 社のうち 1 社が変えたら { changed: 1, offered: 2 }", async () => {
    const before = (await list())[0]!;
    const a = await t.ws("A");
    const b = await t.ws("B");
    const after = (await list())[0]!;
    expect(after["using"]).toBe(Number(before["using"]) + 2);
    const v = (await t.dist("kind")).version;
    await t.f.admin.query(
      `update tenant_distributions td set offered_version = null from distributions d
        where d.id = td.distribution_id and d.key = 'kind' and td.offered_version = $1`,
      [v],
    );
    expect((await list())[0]!["took"]).toBeNull();
    const kind = (await t.dist("kind")).id;
    await t.f.admin.query(
      "update tenant_distributions set offered_version = $3, offered_at = now(), chosen = case when tenant_id = $1 then 'change' end where distribution_id = $4 and tenant_id = any($2::uuid[])",
      [a.tenantId, [a.tenantId, b.tenantId], v, kind],
    );
    expect((await list())[0]!["took"]).toEqual({ changed: 1, offered: 2 });
  });

  it("K992-API-003 1 つ：10 欄・items は今の版の中身（種別は 4 欄）・versions は新しい順", async () => {
    const kind = await t.dist("kind");
    await t.addVersion("kind", kind.items, ops, "会議の色を見直した");
    const r = await t.act(ops, "GET", `${TEMPLATES}/${kind.id}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual([...TEMPLATE_ROW_KEYS, "items", "versions"].sort());
    const items = d["items"] as Record<string, unknown>[];
    expect(Object.keys(items[0]!).sort()).toEqual(["body_template", "color_key", "key", "name"]);
    const versions = d["versions"] as Record<string, unknown>[];
    expect(versions[0]!["version"]).toBe(kind.version + 1);
    expect(versions[0]!["change_reason"]).toBe(`${t.run} 会議の色を見直した`);
    expect(versions[0]!["released_by_name"]).toBe("運営 配る佐野");
    expect(Object.keys(versions[0]!).sort()).toEqual(["change_reason", "released_at", "released_by_name", "version"]);
  });

  it("K992-API-004 入口：ログインなし 401・会社の人 403・配るものを持たない運営の人は 2 本とも 403", async () => {
    const w = await t.ws("入口");
    const none = await t.ops("配らない", ["inquiry"]);
    const id = (await t.dist("kind")).id;
    for (const p of [TEMPLATES, `${TEMPLATES}/${id}`]) {
      expect((await t.act(null, "GET", p)).status, p).toBe(401);
      expect((await t.act(w.admin, "GET", p)).status, p).toBe(403);
      expect((await t.act(none, "GET", p)).status, p).toBe(403);
    }
  });

  it("K992-API-005 無い・形：無い uuid は 404・欄なし・:id が uuid でないは 422", async () => {
    const r = await t.act(ops, "GET", `${TEMPLATES}/${randomUUID()}`);
    expect(r.status).toBe(404);
    expect((await t.json(r))["field"]).toBeUndefined();
    expect((await t.act(ops, "GET", `${TEMPLATES}/kind`)).status).toBe(422);
  });

  it("K992-API-006 上限：一覧の上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["distribute"]);
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await t.act(p, "GET", TEMPLATES);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });
});

describe("K-992 置き場と印", () => {
  it("K992-DB-001 版 1 の種：kind・state・field の 3 行・版 1 は種別 4・状態 7・項目 0", async () => {
    const keys = (
      await t.f.admin.query<{ key: string }>("select key from distributions where tenant_id = $1 order by key", [
        OPS_TENANT,
      ])
    ).rows.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(["field", "kind", "state"]));
    const v1 = async (part: string) =>
      (
        (
          await t.row<{ s: { items: { key: string }[] } }>(
            "select v.snapshot as s from distribution_versions v join distributions d on d.id = v.distribution_id where d.tenant_id = $1 and d.key = $2 and v.version = 1",
            [OPS_TENANT, part],
          )
        )?.s.items ?? []
      ).map((x) => x.key);
    expect(await v1("kind")).toEqual(["task", "issue", "qa", "meeting"]);
    expect(await v1("state")).toEqual(["todo", "doing", "hold", "checking", "awaiting_approval", "running", "done"]);
    expect(await v1("field")).toEqual([]);
  });

  it("K992-DB-002 前からの会社の印：印と使い始めの行を外して app.template_backfill() を流すと、会議は meeting と版 1 の印・使い始めは 3 行で版 1", async () => {
    const w = await t.ws("前から");
    await t.f.admin.query("update ticket_kinds set template_key = null, template_hash = null where tenant_id = $1", [
      w.tenantId,
    ]);
    await t.f.admin.query("update ticket_stages set template_key = null, template_hash = null where tenant_id = $1", [
      w.tenantId,
    ]);
    await t.f.admin.query("delete from tenant_distributions where tenant_id = $1", [w.tenantId]);
    await t.f.admin.query("select app.template_backfill()");
    const meeting = await t.kindRow(w.tenantId, "会議");
    const v1 = (await t.row<{ s: { items: { key: string }[] } }>(
      "select v.snapshot as s from distribution_versions v join distributions d on d.id = v.distribution_id where d.tenant_id = $1 and d.key = 'kind' and v.version = 1",
      [OPS_TENANT],
    ))!.s.items.find((x) => x.key === "meeting")!;
    expect(meeting?.["template_key"]).toBe("meeting");
    expect(meeting?.["template_hash"]).toBe(await t.hashOf("kind", v1));
    for (const p of ["kind", "state", "field"] as const)
      expect((await t.tenantDist(w.tenantId, p))?.["version_in_use"]).toBe(1);
  });

  it("K992-DB-003 もう変えた会社：既定の種別の名前を変えると、今の中身の印は template_hash と違う", async () => {
    const w = await t.ws("変えた");
    const row = (await t.kindRow(w.tenantId, "会議"))!;
    await t.f.admin.query("update ticket_kinds set name = '打ち合わせ' where id = $1", [row["id"]]);
    const now = await t.itemOf("kind", String(row["id"]));
    expect(await t.hashOf("kind", now)).not.toBe(row["template_hash"]);
  });

  it("K992-DB-004 新しく入る会社（版 1 のまま）：種別 4・状態 7 に印が入り今の印と同じ・使い始めは最新の版", async () => {
    const w = await t.ws("新しい");
    const kinds = await t.f.admin.query<{ id: string; template_key: string | null; template_hash: string | null }>(
      "select id, template_key, template_hash from ticket_kinds where tenant_id = $1 and is_builtin and deleted_at is null",
      [w.tenantId],
    );
    expect(kinds.rows.map((r) => r.template_key).sort()).toEqual(["issue", "meeting", "qa", "task"]);
    for (const r of kinds.rows) expect(await t.hashOf("kind", await t.itemOf("kind", r.id))).toBe(r.template_hash);
    expect(
      await t.n("select count(*)::int as n from ticket_stages where tenant_id = $1 and template_key is not null", [
        w.tenantId,
      ]),
    ).toBe(7);
    expect((await t.tenantDist(w.tenantId, "kind"))?.["version_in_use"]).toBe((await t.dist("kind")).version);
  });

  it("K992-DB-005 新しく入る会社（版 2 の後）：会議の色は版 2・「振り返り」が在る・種別の version_in_use は 2 以上の最新", async () => {
    const kind = await t.dist("kind");
    const items = kind.items.map((x) => (x.key === "meeting" ? { ...x, color_key: "amber" } : x));
    const v = await t.addVersion(
      "kind",
      [...items, { key: "retro", name: "振り返り", color_key: "sage", body_template: null }],
      ops,
    );
    try {
      const w = await t.ws("版 2 の後");
      expect((await t.kindRow(w.tenantId, "会議"))?.["color_key"]).toBe("amber");
      expect(await t.kindRow(w.tenantId, "振り返り")).toBeDefined();
      expect((await t.tenantDist(w.tenantId, "kind"))?.["version_in_use"]).toBe(v);
    } finally {
      // 共用の DB：落ちても後のファイルの会社が版 2 で始まらないよう、今の版を戻す（置いた版の行は土台の afterAll が消す）
      await t.f.admin.query("update distributions set current_version = $2 where id = $1", [kind.id, kind.version]);
    }
  });

  it("K992-DB-006 中身の印：同じ中身は同じ印・名前を 1 字変えると違う・key だけ違う中身は同じ印", async () => {
    const a = { key: "x", name: "会議", color_key: "indigo", body_template: null };
    expect(await t.hashOf("kind", a)).toBe(await t.hashOf("kind", { ...a }));
    expect(await t.hashOf("kind", a)).not.toBe(await t.hashOf("kind", { ...a, name: "会議 " }));
    expect(await t.hashOf("kind", a)).toBe(await t.hashOf("kind", { ...a, key: "y" }));
  });

  it("K992-DB-007 2 層目・関数の権限：会社の人の文脈で app.ops_templates は 42501・PUBLIC は app.ops_template を呼べない・kaname_app は app.template_seed を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(app.query("select app.ops_templates()")).rejects.toMatchObject({ code: "42501" });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const r = await t.row<{ pub: boolean; seed: boolean }>(
      `select has_function_privilege('public', 'app.ops_template(uuid)', 'execute') as pub,
              has_function_privilege('kaname_app', 'app.template_seed(uuid)', 'execute') as seed`,
    );
    expect([r?.pub, r?.seed]).toEqual([false, false]);
  });
});
