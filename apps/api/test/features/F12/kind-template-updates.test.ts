// K-993「会社の側のひな形の新しい版（こう変わります・変える／そのままにする）」の単体の試験
//   （本物の DB・本物の入口・偽のログイン・土台 ops-templates.harness.ts＝K-992）。
// テストの名前の頭の行 ID（K993-…）は 11_tickets/K-993.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 届いた版は、土台で版を置き tenant_distributions の印を DB で付ける（出す口 K-1010 を通さない準備）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import type { Ws } from "./ops-ws.harness.js";
import { startOpsTemplates, UPDATES, type Item, type OpsTemplates } from "./ops-templates.harness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
let t: OpsTemplates;
let v2: number;
let retro: string;
beforeAll(async () => {
  t = await startOpsTemplates("k993", ["kind-template-updates"]);
  const d = await t.dist("kind");
  retro = `retro_${t.run.replace(/[^a-z0-9]/g, "")}`.slice(0, 40);
  const items: Item[] = [
    ...d.items.map((x) =>
      x.key === "meeting" ? { ...x, color_key: x["color_key"] === "amber" ? "plum" : "amber" } : x,
    ),
    { key: retro, name: "振り返り", color_key: "sage", body_template: null },
  ];
  v2 = await t.addVersion("kind", items);
});
afterAll(async () => t?.close());

/** 版 2 より前に作った会社として、版 2 が届いた形にする */
const offeredWs = async (label: string): Promise<{ w: Ws; id: string }> => {
  const w = await t.ws(label);
  await t.f.admin.query(
    `update tenant_distributions td set version_in_use = $2 - 1, offered_version = $2, offered_at = now(), chosen = null
       from distributions d where d.id = td.distribution_id and d.key = 'kind' and td.tenant_id = $1`,
    [w.tenantId, v2],
  );
  // 新しく入る会社は版 2 で始まるので、版 1 の会社の形に戻す（会議の色・振り返り・印）
  const v1 = (await t.row<{ s: { items: Item[] } }>(
    "select v.snapshot as s from distribution_versions v join distributions d on d.id = v.distribution_id where d.key = 'kind' and v.version = $1 and d.tenant_id = '00000000-0000-4000-8000-000000000001'",
    [v2 - 1],
  ))!.s.items;
  const meeting = v1.find((x) => x.key === "meeting")!;
  await t.f.admin.query(
    "update ticket_kinds set color_key = $2, template_hash = $3 where tenant_id = $1 and template_key = 'meeting'",
    [w.tenantId, meeting["color_key"], await t.hashOf("kind", meeting)],
  );
  await t.f.admin.query("delete from ticket_kinds where tenant_id = $1 and template_key = $2", [w.tenantId, retro]);
  const id = String((await t.tenantDist(w.tenantId, "kind"))!["id"]);
  return { w, id };
};
const list = async (who: Person) => {
  const r = await t.act(who, "GET", UPDATES);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await t.json(r)).data ?? []) as Record<string, unknown>[];
};
const apply = (who: Person | null, id: string, body: unknown = { choice: "change" }) =>
  t.act(who, "POST", `${UPDATES}/${id}/apply`, body);
const meetingOf = (tenantId: string) =>
  t.row<Record<string, unknown>>(
    "select * from ticket_kinds where tenant_id = $1 and template_key = 'meeting' and deleted_at is null",
    [tenantId],
  );

describe("K-993 一覧", () => {
  it("K993-API-001 一覧：届いた版 1 行・7 欄・kind・種別・from と to・差 2（会議の change・振り返りの add）", async () => {
    const { w, id } = await offeredWs("一覧");
    const rows = await list(w.admin);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(Object.keys(r).sort()).toEqual([
      "diffs",
      "from_version",
      "id",
      "part",
      "part_name",
      "released_at",
      "to_version",
    ]);
    expect([r["id"], r["part"], r["part_name"], r["from_version"], r["to_version"]]).toEqual([
      id,
      "kind",
      "種別",
      v2 - 1,
      v2,
    ]);
    const diffs = r["diffs"] as Record<string, unknown>[];
    expect(diffs.map((x) => [x["key"], x["change"]])).toEqual([
      ["meeting", "change"],
      [retro, "add"],
    ]);
  });

  it("K993-API-002 出ない：届いていない会社・そのままにするを選んだ会社の一覧は空", async () => {
    const fresh = await t.ws("届いていない");
    expect(await list(fresh.admin)).toEqual([]);
    const { w, id } = await offeredWs("選んだ");
    await t.f.admin.query("update tenant_distributions set chosen = 'keep', chosen_at = now() where id = $1", [id]);
    expect(await list(w.admin)).toEqual([]);
  });

  it("K993-API-003 差の字：会議は「種別「会議」」と色の字・振り返りは「種別「振り返り」」「種別を足す」・必須でない項目の足すは「項目を足す（必須ではありません）」", async () => {
    const { w } = await offeredWs("字");
    const diffs = (await list(w.admin))[0]!["diffs"] as Record<string, unknown>[];
    expect(diffs[0]!["target_label"]).toBe("種別「会議」");
    expect(String(diffs[0]!["detail_label"])).toContain("色を「");
    expect([diffs[1]!["target_label"], diffs[1]!["detail_label"]]).toEqual(["種別「振り返り」", "種別を足す"]);
    const f = await t.dist("field");
    const fv = await t.addVersion("field", [
      ...f.items,
      {
        key: "minutes_link",
        name: "議事録のリンク",
        field_type: "short_text",
        required: false,
        description: "",
        options: [],
        kind_keys: ["meeting"],
      },
    ]);
    await t.f.admin.query(
      `update tenant_distributions td set offered_version = $2, chosen = null from distributions d
        where d.id = td.distribution_id and d.key = 'field' and td.tenant_id = $1`,
      [w.tenantId, fv],
    );
    const field = (await list(w.admin)).find((x) => x["part"] === "field")!;
    expect((field["diffs"] as Record<string, unknown>[])[0]).toMatchObject({
      target_label: "項目「議事録のリンク」",
      detail_label: "項目を足す（必須ではありません）",
    });
  });
});

describe("K-993 選ぶ", () => {
  it("K993-API-004 変える：会議の色と印・振り返りが在る・version_in_use・chosen change・一覧は空・記録 template.apply", async () => {
    const { w, id } = await offeredWs("変える");
    const want = (await t.dist("kind")).items.find((x) => x.key === "meeting")!;
    const r = await apply(w.admin, id);
    expect(r.status, await r.clone().text()).toBe(200);
    const m = (await meetingOf(w.tenantId))!;
    expect(m["color_key"]).toBe(want["color_key"]);
    expect(m["template_hash"]).toBe(await t.hashOf("kind", want));
    expect(
      await t.row("select id from ticket_kinds where tenant_id = $1 and template_key = $2", [w.tenantId, retro]),
    ).toBeDefined();
    const td = (await t.tenantDist(w.tenantId, "kind"))!;
    expect([td["version_in_use"], td["chosen"]]).toEqual([v2, "change"]);
    expect(await list(w.admin)).toEqual([]);
    const a = await t.row<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'template.apply' order by created_at desc limit 1",
      [w.tenantId],
    );
    expect(a?.payload["changed"]).toBe(2);
  });

  it("K993-API-005 そのままにする：会議の色は前のまま・振り返りなし・chosen keep・version_in_use は前のまま・一覧は空", async () => {
    const { w, id } = await offeredWs("そのまま");
    const before = (await meetingOf(w.tenantId))!["color_key"];
    const r = await apply(w.admin, id, { choice: "keep" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await meetingOf(w.tenantId))!["color_key"]).toBe(before);
    expect(
      await t.row("select id from ticket_kinds where tenant_id = $1 and template_key = $2", [w.tenantId, retro]),
    ).toBeUndefined();
    const td = (await t.tenantDist(w.tenantId, "kind"))!;
    expect([td["version_in_use"], td["chosen"]]).toEqual([v2 - 1, "keep"]);
    expect(await list(w.admin)).toEqual([]);
  });

  it("K993-API-006 届いた後に直した：会議の名前を変えると差は振り返りだけ・変えるで会議の名前と色は会社の物のまま", async () => {
    const { w, id } = await offeredWs("後で直した");
    await t.f.admin.query(
      "update ticket_kinds set name = '打ち合わせ' where tenant_id = $1 and template_key = 'meeting'",
      [w.tenantId],
    );
    const before = (await meetingOf(w.tenantId))!;
    const diffs = (await list(w.admin))[0]!["diffs"] as Record<string, unknown>[];
    expect(diffs.map((x) => x["key"])).toEqual([retro]);
    expect((await apply(w.admin, id)).status).toBe(200);
    const after = (await meetingOf(w.tenantId))!;
    expect([after["name"], after["color_key"]]).toEqual(["打ち合わせ", before["color_key"]]);
  });

  it("K993-API-014 届いた後に同じ名前を自分で作った：会社の「タスク」を「振り返り」に名前を変えると、振り返りの add は差から外れ（一覧は会議だけ）、変えるで種別「振り返り」は 1 つのまま（一意の違反で落ちない）", async () => {
    const { w, id } = await offeredWs("同じ名前");
    await t.f.admin.query("update ticket_kinds set name = '振り返り' where tenant_id = $1 and template_key = 'task'", [
      w.tenantId,
    ]);
    const diffs = (await list(w.admin))[0]!["diffs"] as Record<string, unknown>[];
    expect(diffs.map((x) => x["key"])).toEqual(["meeting"]);
    expect((await apply(w.admin, id)).status).toBe(200);
    expect(
      await t.n(
        "select count(*) as n from ticket_kinds where tenant_id = $1 and name = '振り返り' and deleted_at is null",
        [w.tenantId],
      ),
    ).toBe(1);
    expect(
      await t.n("select count(*) as n from ticket_kinds where tenant_id = $1 and template_key = $2", [
        w.tenantId,
        retro,
      ]),
    ).toBe(0);
  });

  it("K993-API-015 届いた後に既定の会議を消した：消したのは手を付けた扱いで、差は振り返りだけ。変えるで会議は消えたまま（足し直さない）", async () => {
    const { w, id } = await offeredWs("会議を消した");
    await t.f.admin.query(
      "update ticket_kinds set deleted_at = now() where tenant_id = $1 and template_key = 'meeting'",
      [w.tenantId],
    );
    const diffs = (await list(w.admin))[0]!["diffs"] as Record<string, unknown>[];
    expect(diffs.map((x) => x["key"])).toEqual([retro]);
    expect((await apply(w.admin, id)).status).toBe(200);
    expect(await meetingOf(w.tenantId)).toBeUndefined();
  });

  it("K993-API-007 選んだ後：もう一度変える・そのままにするは 409・E-OPS-025・欄なし", async () => {
    const { w, id } = await offeredWs("二度");
    expect((await apply(w.admin, id)).status).toBe(200);
    for (const choice of ["change", "keep"]) {
      const r = await apply(w.admin, id, { choice });
      expect(r.status, choice).toBe(409);
      const j = await t.json(r);
      expect(j["code"]).toBe("E-OPS-025");
      expect(j["field"]).toBeUndefined();
    }
  });

  it("K993-API-008 入口：ログインなし 401・管理者でないメンバー 403・運営の人 403・ほかの会社の行の id は 404", async () => {
    const { w, id } = await offeredWs("入口");
    const other = await offeredWs("ほか");
    const member = await t.member(w, "メンバー");
    const ops = await t.ops("運営", ["distribute"]);
    expect((await t.act(null, "GET", UPDATES)).status).toBe(401);
    expect((await t.act(member, "GET", UPDATES)).status).toBe(403);
    expect((await t.act(ops, "GET", UPDATES)).status).toBe(403);
    expect((await apply(member, id)).status).toBe(403);
    const r = await apply(w.admin, other.id);
    expect(r.status).toBe(404);
    expect((await t.json(r))["field"]).toBeUndefined();
  });

  it("K993-API-009 形の誤り：choice が無い・apply・余計な欄・:id が uuid でないは 422・何も変わらない", async () => {
    const { w, id } = await offeredWs("形");
    for (const b of [{}, { choice: "apply" }, { choice: "change", part: "kind" }])
      expect((await apply(w.admin, id, b)).status, JSON.stringify(b)).toBe(422);
    expect((await apply(w.admin, "not-a-uuid")).status).toBe(422);
    expect((await t.tenantDist(w.tenantId, "kind"))!["chosen"]).toBeNull();
  });

  it("K993-API-010 外す口：endpoints.json に makeKindTemplateFromTicket が無く、retired-endpoints.json に根拠 D-156.20 で在る・道は 404", async () => {
    const endpoints = readFileSync(join(ROOT, "08_api/endpoints.json"), "utf8");
    expect(endpoints).not.toContain('"makeKindTemplateFromTicket"');
    const retired = readFileSync(join(ROOT, "08_api/retired-endpoints.json"), "utf8");
    expect(retired).toContain("makeKindTemplateFromTicket");
    expect(retired).toContain("D-156.20");
    const { w } = await offeredWs("外す");
    expect((await t.act(w.admin, "POST", `/ticket_kinds/${randomUUID()}/template-from-ticket`, {})).status).toBe(404);
  });

  it("K993-API-011 書けない：ticket_kinds への書き込みを落とすと 503・E-PAGE-003・会議の色は前のまま・chosen は null", async () => {
    const { w, id } = await offeredWs("書けない");
    const before = (await meetingOf(w.tenantId))!["color_key"];
    const fix = await t.breakWrites("ticket_kinds", { tenant_id: w.tenantId });
    try {
      const r = await apply(w.admin, id);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect((await meetingOf(w.tenantId))!["color_key"]).toBe(before);
    expect((await t.tenantDist(w.tenantId, "kind"))!["chosen"]).toBeNull();
  });

  it("K993-API-012 上限：一覧の上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const w = await t.ws("上限");
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await t.act(w.admin, "GET", UPDATES);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K993-API-013 同時に 2 回：同じ行を同時に変えると 200 と 409 E-OPS-025・振り返りの種別は 1 つ", async () => {
    const { w, id } = await offeredWs("同時");
    const rs = await Promise.all([apply(w.admin, id), apply(w.admin, id)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await t.n("select count(*)::int as n from ticket_kinds where tenant_id = $1 and template_key = $2", [
        w.tenantId,
        retro,
      ]),
    ).toBe(1);
  });

  it("K993-DB-001 2 層目：運営の文脈で app.kind_template_updates を直に呼ぶと 42501・PUBLIC は app.kind_template_apply を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'ops', true)");
      await expect(app.query("select app.kind_template_updates()")).rejects.toMatchObject({ code: "42501" });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.kind_template_apply(uuid, text)', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});

// 種別の新しい版（版 3）と項目の新しい版をここで置く。新しい版の後に始まる会社はその版で始まるので、ほかの行（版 2 を届ける offeredWs・K993-API-003 の項目の版）より後に置く
describe("K-993 名前を変える差", () => {
  it("K993-API-016 名前を変える差が重なる：届いた版が会議を「定例」に変え、会社が自分の振り返りを「定例」に名前を変えていると、差はタスクだけ。変えるで 200（503 にならない）・会議は「会議」のまま・「定例」は 1 つ・タスクの色は新しい色", async () => {
    const w = await t.ws("名前が重なる");
    await t.f.admin.query("update ticket_kinds set name = '定例' where tenant_id = $1 and template_key = $2", [
      w.tenantId,
      retro,
    ]);
    const d = await t.dist("kind");
    const task = d.items.find((x) => x.key === "task")!;
    const newTask = { ...task, color_key: task["color_key"] === "amber" ? "plum" : "amber" };
    const v3 = await t.addVersion(
      "kind",
      d.items.map((x) => (x.key === "meeting" ? { ...x, name: "定例" } : x.key === "task" ? newTask : x)),
    );
    await t.f.admin.query(
      `update tenant_distributions td set version_in_use = $2 - 1, offered_version = $2, offered_at = now(), chosen = null
         from distributions d where d.id = td.distribution_id and d.key = 'kind' and td.tenant_id = $1`,
      [w.tenantId, v3],
    );
    const id = String((await t.tenantDist(w.tenantId, "kind"))!["id"]);
    const rows = await list(w.admin);
    expect(rows).toHaveLength(1);
    expect((rows[0]!["diffs"] as Record<string, unknown>[]).map((x) => [x["key"], x["change"]])).toEqual([
      ["task", "change"],
    ]);
    const r = await apply(w.admin, id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await meetingOf(w.tenantId))!["name"]).toBe("会議");
    expect(
      await t.n(
        "select count(*) as n from ticket_kinds where tenant_id = $1 and name = '定例' and deleted_at is null",
        [w.tenantId],
      ),
    ).toBe(1);
    const tk = (await t.row<Record<string, unknown>>(
      "select * from ticket_kinds where tenant_id = $1 and template_key = 'task' and deleted_at is null",
      [w.tenantId],
    ))!;
    expect(tk["color_key"]).toBe(newTask["color_key"]);
    const td = (await t.tenantDist(w.tenantId, "kind"))!;
    expect([td["version_in_use"], td["chosen"]]).toEqual([v3, "change"]);
  });
  it("K993-API-017 項目の名前を変える差が重なる：届いた版が既定の項目「議題メモ」を「締切」に変え、会社が自分の項目を「締切」に名前を変えていると、項目の差は参考リンクの add だけ。変えるで 200（503 にならない）・議題メモはそのまま・「締切」は 1 つ・参考リンクが在る", async () => {
    const run = t.run.replace(/[^a-z0-9]/g, "");
    const fk = (s: string) => `${s}_${run}`.slice(0, 40);
    const field = (key: string, name: string): Item => ({
      key,
      name,
      field_type: "short_text",
      required: false,
      description: "",
      options: [],
      kind_keys: ["meeting"],
    });
    const agenda = field(fk("agenda"), "議題メモ");
    const memo = field(fk("memo"), "メモ欄");
    const link = field(fk("link"), "参考リンク");
    const f = await t.dist("field");
    await t.addVersion("field", [...f.items, agenda, memo]);
    // この版の後に始まる会社なので、議題メモとメモ欄を手を付けていない形で持つ
    const w = await t.ws("項目の名前が重なる");
    await t.f.admin.query("update custom_fields set name = '締切' where tenant_id = $1 and template_key = $2", [
      w.tenantId,
      memo.key,
    ]);
    const fb = await t.addVersion("field", [...f.items, { ...agenda, name: "締切" }, memo, link]);
    await t.f.admin.query(
      `update tenant_distributions td set version_in_use = $2 - 1, offered_version = $2, offered_at = now(), chosen = null
         from distributions d where d.id = td.distribution_id and d.key = 'field' and td.tenant_id = $1`,
      [w.tenantId, fb],
    );
    const row = (await list(w.admin)).find((x) => x["part"] === "field")!;
    expect((row["diffs"] as Record<string, unknown>[]).map((x) => [x["key"], x["change"]])).toEqual([
      [link.key, "add"],
    ]);
    const r = await apply(w.admin, String(row["id"]));
    expect(r.status, await r.clone().text()).toBe(200);
    const a = await t.row<Record<string, unknown>>(
      "select * from custom_fields where tenant_id = $1 and template_key = $2 and deleted_at is null",
      [w.tenantId, agenda.key],
    );
    expect(a?.["name"]).toBe("議題メモ");
    expect(
      await t.n(
        "select count(*) as n from custom_fields where tenant_id = $1 and name = '締切' and deleted_at is null",
        [w.tenantId],
      ),
    ).toBe(1);
    expect(
      await t.n(
        "select count(*) as n from custom_fields where tenant_id = $1 and template_key = $2 and deleted_at is null",
        [w.tenantId, link.key],
      ),
    ).toBe(1);
    const td = (await t.tenantDist(w.tenantId, "field"))!;
    expect([td["version_in_use"], td["chosen"]]).toEqual([fb, "change"]);
  });
});
