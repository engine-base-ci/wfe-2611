// K-1010「ひな形の新しい版を出す・操作を読む」の単体の試験（本物の DB・本物の入口・偽のログイン（取り直しの秒）・土台 ops-templates.harness.ts＝K-992）。
// テストの名前の頭の行 ID（K1010-…）は 11_tickets/K-1010.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import {
  STEP,
  startOpsTemplates,
  TEMPLATE_ROW_KEYS,
  TEMPLATES,
  type Item,
  type OpsTemplates,
} from "./ops-templates.harness.js";

let t: OpsTemplates;
let ops: Person;
beforeAll(async () => {
  t = await startOpsTemplates("k1010", ["ops-templates-read", "ops-templates-release"]);
  ops = await t.ops("配る高本", ["distribute"]);
});
afterAll(async () => t?.close());

const release = (who: Person | null, id: string, body: unknown, ...opt: [step?: number]) => {
  // 送らない（undefined）と既定の STEP を分ける：既定の引数は undefined を渡しても STEP になり、取り直していない場合を作れなかった
  const step = opt.length ? opt[0] : STEP;
  return t.act(who, "POST", `${TEMPLATES}/${id}/versions`, body, step === undefined ? {} : { stepUpAgoSec: step });
};
/** 今の種別の中身から、会議の色だけを変えた中身 */
const meetingRecolored = async (): Promise<{ id: string; items: Item[] }> => {
  const d = await t.dist("kind");
  const items = d.items.map((x) =>
    x.key === "meeting" ? { ...x, color_key: x["color_key"] === "amber" ? "plum" : "amber" } : x,
  );
  return { id: d.id, items };
};
const offered = async (tenantId: string) => (await t.tenantDist(tenantId, "kind"))?.["offered_version"] ?? null;
const bells = (tenantId: string) =>
  t.n("select count(*)::int as n from notifications where tenant_id = $1 and event_kind_id = 'template.update'", [
    tenantId,
  ]);

describe("K-1010 操作", () => {
  it("K1010-API-001 操作：200・6 欄・browser・ブラウザで操作する・v1.4・passed・下絵の説明", async () => {
    const r = await t.act(ops, "GET", "/ops/operations");
    expect(r.status, await r.clone().text()).toBe(200);
    const rows = ((await t.json(r)).data ?? []) as Record<string, unknown>[];
    const b = rows.find((x) => x["key"] === "browser")!;
    expect(Object.keys(b).sort()).toEqual(["check_state", "description", "id", "key", "name", "version_label"]);
    expect([b["name"], b["version_label"], b["check_state"]]).toEqual(["ブラウザで操作する", "v1.4", "passed"]);
    expect(b["description"]).toBe(
      "汎用の操作 1 つ。初めてのサイトも動かし、うまくいったら動かし方を記録して次から使う",
    );
  });

  it("K1010-API-002 入口：ログインなし 401・会社の人 403・配るものを持たない運営の人は 2 本とも 403", async () => {
    const w = await t.ws("入口");
    const none = await t.ops("配らない", ["inquiry"]);
    const { id, items } = await meetingRecolored();
    expect((await t.act(null, "GET", "/ops/operations")).status).toBe(401);
    expect((await t.act(w.admin, "GET", "/ops/operations")).status).toBe(403);
    expect((await t.act(none, "GET", "/ops/operations")).status).toBe(403);
    expect((await release(null, id, { items, change_reason: "色" })).status).toBe(401);
    expect((await release(none, id, { items, change_reason: "色" })).status).toBe(403);
  });

  it("K1010-API-013 上限：操作の一覧の上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["distribute"]);
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await t.act(p, "GET", "/ops/operations");
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });
});

describe("K-1010 新しい版を出す", () => {
  it("K1010-API-003 下書き：201・meta.offered はこの回の 2 社を含む・版・使い始め・鈴が増えない", async () => {
    const a = await t.ws("下書き A");
    const b = await t.ws("下書き B");
    const { id, items } = await meetingRecolored();
    const before = (await t.dist("kind")).version;
    const r = await release(ops, id, { items, change_reason: "会議の色を見直した", dry_run: true });
    expect(r.status, await r.clone().text()).toBe(201);
    const j = await t.json(r);
    expect(Number(j.meta?.["offered"])).toBeGreaterThanOrEqual(2);
    expect((await t.dist("kind")).version).toBe(before);
    expect([await offered(a.tenantId), await offered(b.tenantId)]).toEqual([null, null]);
    expect(await bells(a.tenantId)).toBe(0);
  });

  it("K1010-API-004 出す：201・8 欄・版＋1・meta.offered は下書きと同じ・届く会社の offered_version・管理者に鈴 1・記録", async () => {
    const w = await t.ws("出す");
    const { id, items } = await meetingRecolored();
    const before = (await t.dist("kind")).version;
    const dry = await t.json(await release(ops, id, { items, change_reason: "会議の色を見直した", dry_run: true }));
    const r = await release(ops, id, { items, change_reason: "会議の色を見直した" });
    expect(r.status, await r.clone().text()).toBe(201);
    const j = await t.json(r);
    expect(Object.keys(j.data as object).sort()).toEqual([...TEMPLATE_ROW_KEYS].sort());
    expect((j.data as Record<string, unknown>)["version"]).toBe(before + 1);
    expect(j.meta?.["offered"]).toBe(dry.meta?.["offered"]);
    const td = await t.tenantDist(w.tenantId, "kind");
    expect([td?.["offered_version"], td?.["chosen"]]).toEqual([before + 1, null]);
    expect(await bells(w.tenantId)).toBe(1);
    const a = await t.row<{ payload: Record<string, unknown> }>(
      "select payload from ops_audit_events where action = 'template.release' and target_id = $1 order by occurred_at desc limit 1",
      [id],
    );
    expect(a?.payload["offered"]).toBe(j.meta?.["offered"]);
  });

  it("K1010-API-005 既定から変えた会社：会議の名前を変えた会社には、会議だけを変えた版は届かない・鈴なし", async () => {
    const w = await t.ws("変えた会社");
    await t.f.admin.query(
      "update ticket_kinds set name = '打ち合わせ' where tenant_id = $1 and template_key = 'meeting'",
      [w.tenantId],
    );
    const { id, items } = await meetingRecolored();
    expect((await release(ops, id, { items, change_reason: "会議の色" })).status).toBe(201);
    expect(await offered(w.tenantId)).toBeNull();
    expect(await bells(w.tenantId)).toBe(0);
  });

  it("K1010-API-006 既定から変えた会社に足す版：「振り返り」を足した版は、会議の名前を変えた・会議を消した・自分で種別を足した会社のどれにも届かない（鈴なし）。既定のまま使っている会社には届く（D-156.56）", async () => {
    const renamed = await t.ws("名前を変えた");
    await t.f.admin.query(
      "update ticket_kinds set name = '打ち合わせ' where tenant_id = $1 and template_key = 'meeting'",
      [renamed.tenantId],
    );
    const gone = await t.ws("会議を消した");
    await t.f.admin.query(
      "update ticket_kinds set deleted_at = now() where tenant_id = $1 and template_key = 'meeting'",
      [gone.tenantId],
    );
    const own = await t.ws("自分で足した");
    await t.f.admin.query("insert into ticket_kinds (tenant_id, name) values ($1, '自分の種別')", [own.tenantId]);
    const plain = await t.ws("既定のまま");
    const d = await t.dist("kind");
    const items = [
      ...d.items,
      { key: `retro_${Date.now().toString(36)}`, name: "振り返り", color_key: "sage", body_template: null },
    ];
    expect((await release(ops, d.id, { items, change_reason: "振り返りを足す" })).status).toBe(201);
    for (const w of [renamed, gone, own]) {
      expect(await offered(w.tenantId), w.tenantId).toBeNull();
      expect(await bells(w.tenantId), w.tenantId).toBe(0);
    }
    expect(await offered(plain.tenantId)).toBe(d.version + 1);
    expect(await bells(plain.tenantId)).toBe(1);
  });

  it("K1010-API-007 同じ・合わない：同じ中身は 409 E-OPS-023。field_type・同じ key・壊れた本文は 409 E-OPS-024 と detail.key。版が増えない", async () => {
    const d = await t.dist("kind");
    const same = await release(ops, d.id, { items: d.items, change_reason: "同じ" });
    expect(same.status).toBe(409);
    const j = await t.json(same);
    expect(j["code"]).toBe("E-OPS-023");
    expect(j["field"]).toBeUndefined();
    const bad: Item[][] = [
      d.items.map((x) => (x.key === "qa" ? { ...x, field_type: "short_text" } : x)),
      [...d.items, { ...d.items[0]!, name: "もう 1 つ" }],
      d.items.map((x) => (x.key === "qa" ? { ...x, body_template: { type: "doc", content: [{ type: "nope" }] } } : x)),
    ];
    const keys = ["qa", d.items[0]!.key, "qa"];
    for (const [i, items] of bad.entries()) {
      const r = await release(ops, d.id, { items, change_reason: "合わない" });
      expect(r.status, String(i)).toBe(409);
      const x = await t.json(r);
      expect(x["code"]).toBe("E-OPS-024");
      expect((x["detail"] as Record<string, unknown>)["key"]).toBe(keys[i]);
    }
    expect((await t.dist("kind")).version).toBe(d.version);
  });

  it("K1010-API-014 数の上限：種別 10 個の下書きは 201・種別 11 個は 409 E-OPS-024 と 11 個目の key・状態は仕組みの段のほか 9 個で 409 E-OPS-024 と 9 個目の key・版が増えない", async () => {
    const kind = await t.dist("kind");
    const more = (n: number, base: Item) =>
      Array.from({ length: n }, (_, i) => ({ ...base, key: `plus_${i}`, name: `足す ${i + 1}` }));
    const k10 = [...kind.items, ...more(10 - kind.items.length, kind.items[0]!)];
    expect(k10).toHaveLength(10);
    const ok = await release(ops, kind.id, { items: k10, change_reason: "10 個", dry_run: true });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const k11 = [...kind.items, ...more(11 - kind.items.length, kind.items[0]!)];
    const over = await release(ops, kind.id, { items: k11, change_reason: "11 個" });
    expect(over.status).toBe(409);
    const j = await t.json(over);
    expect(j["code"]).toBe("E-OPS-024");
    expect((j["detail"] as Record<string, unknown>)["key"]).toBe(k11[10]!.key);
    expect((await t.dist("kind")).version).toBe(kind.version);

    const state = await t.dist("state");
    const FIXED = ["checking", "awaiting_approval", "running"];
    const open = state.items.filter((x) => !FIXED.includes(x.key));
    const s9 = [...state.items, ...more(9 - open.length, state.items[0]!)];
    const last = s9[s9.length - 1]!.key;
    const r = await release(ops, state.id, { items: s9, change_reason: "9 個" });
    expect(r.status).toBe(409);
    const x = await t.json(r);
    expect(x["code"]).toBe("E-OPS-024");
    expect((x["detail"] as Record<string, unknown>)["key"]).toBe(last);
    expect((await t.dist("state")).version).toBe(state.version);
  });

  it("K1010-API-008 取り直していない：出すも下書きも 403・STEP_UP_REQUIRED・版が増えない", async () => {
    const { id, items } = await meetingRecolored();
    const before = (await t.dist("kind")).version;
    for (const dry of [true, false]) {
      const r = await release(ops, id, { items, change_reason: "色", dry_run: dry }, undefined);
      expect(r.status).toBe(403);
      expect((await t.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    }
    expect((await t.dist("kind")).version).toBe(before);
  });

  it("K1010-API-009 形の誤り：items の無い・101 個・大文字の key・空と 41 字の name・知らない色・空白だけの理由・余計な欄は 422", async () => {
    const { id, items } = await meetingRecolored();
    const one = items[0]!;
    const bodies: unknown[] = [
      { change_reason: "理由" },
      { items: Array.from({ length: 101 }, (_, i) => ({ ...one, key: `k${i}` })), change_reason: "理由" },
      { items: [{ ...one, key: "Meeting" }], change_reason: "理由" },
      { items: [{ ...one, name: "" }], change_reason: "理由" },
      { items: [{ ...one, name: "あ".repeat(41) }], change_reason: "理由" },
      { items: [{ ...one, color_key: "rainbow" }], change_reason: "理由" },
      { items, change_reason: "　 " },
      { items, change_reason: "理由", version: 9 },
    ];
    for (const b of bodies) expect((await release(ops, id, b)).status, JSON.stringify(b).slice(0, 60)).toBe(422);
  });

  it("K1010-API-010 無い：無い uuid は 404・欄なし・:id が uuid でないは 422", async () => {
    const { items } = await meetingRecolored();
    const r = await release(ops, randomUUID(), { items, change_reason: "色" });
    expect(r.status).toBe(404);
    expect((await t.json(r))["field"]).toBeUndefined();
    expect((await release(ops, "kind", { items, change_reason: "色" })).status).toBe(422);
  });

  it("K1010-API-011 同時に出す：同じ中身を 2 人が同時に出すと 201 と 409 E-OPS-023・版の行は 1 つ", async () => {
    const other = await t.ops("配る木村", ["distribute"]);
    const { id, items } = await meetingRecolored();
    const before = (await t.dist("kind")).version;
    const rs = await Promise.all([
      release(ops, id, { items, change_reason: "同時" }),
      release(other, id, { items, change_reason: "同時" }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await t.dist("kind")).version).toBe(before + 1);
  });

  it("K1010-API-012 書けない：distribution_versions への書き込みを落とすと 503・E-PAGE-003・今の版は前のまま・届かない", async () => {
    const w = await t.ws("書けない");
    const { id, items } = await meetingRecolored();
    const before = (await t.dist("kind")).version;
    const fix = await t.breakWrites("distribution_versions", { distribution_id: id });
    try {
      const r = await release(ops, id, { items, change_reason: "色" });
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await t.dist("kind")).version).toBe(before);
    expect(await offered(w.tenantId)).toBeNull();
    expect(await bells(w.tenantId)).toBe(0);
  });

  it("K1010-API-015 仕組みの段の名前と色を変えた版の後に入る会社：その段の印はその行の今の中身の印（手を付けていない）・名前は種まきが直さない", async () => {
    const state = await t.dist("state");
    const items = state.items.map((x) =>
      x.key === "checking"
        ? { ...x, name: `${x.name}（版 2）`, color_key: x["color_key"] === "amber" ? "plum" : "amber" }
        : x,
    );
    const r = await release(ops, state.id, { items, change_reason: "確認中の名前と色" });
    expect(r.status).toBe(201);
    try {
      const w = await t.ws("段を変えた版の後");
      const row = await t.row<{ id: string; name: string; template_hash: string }>(
        "select id, name, template_hash from ticket_stages where tenant_id = $1 and key = 'checking' and deleted_at is null",
        [w.tenantId],
      );
      const before = state.items.find((x) => x.key === "checking")!;
      expect(row!.name).toBe(before.name);
      expect(row!.template_hash).toBe(await t.hashOf("state", await t.itemOf("state", row!.id)));
    } finally {
      // 共用の DB：後の試験の会社が版 2 で始まらないよう、今の版を戻す（置いた版の行は土台の afterAll が消す）
      await t.f.admin.query("update distributions set current_version = $2 where id = $1", [state.id, state.version]);
    }
  });

  it("K1010-DB-001 2 層目：会社の人の文脈で app.ops_template_release を直に呼ぶと 42501・PUBLIC は app.ops_operations を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(
        app.query("select app.ops_template_release($1, '{}'::jsonb, true)", [randomUUID()]),
      ).rejects.toMatchObject({ code: "42501" });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_operations()', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
