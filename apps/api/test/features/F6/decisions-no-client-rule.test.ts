// K-916「決定の『取引先のこれから』（client_rule）と E-CONF-037 を外す」の単体の試験（口・本物の DB・本物のファイル）。
//   名前の頭の行 ID（K916-API-…）は 11_tickets/K-916.md の表と 1 対 1。土台は ./decisions.harness.ts（K-390 と同じ）。
//   見ること：口は client_rule を選べない（422・何も書かない）・ticket と送らないは通る・DB の関数の枝は残るが口の外（2 層目）・
//   契約・エラー・ears・画面の部品から取引先のこれからが消えた。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  setupDecisions,
  boss,
  viewer,
  json,
  ticket,
  add,
  asMember,
  snapshot,
  decisionsOf,
} from "./decisions.harness.js";

setupDecisions();

const ROOT = join(__dirname, "../../../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("K-916 取引先のこれからを外す（口）", () => {
  it("K916-API-001 promoted_to が client_rule：422・何も書かない（決定・やり取り・お知らせが増えない）・E-CONF-037 でも 409 でもない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const r = await add(boss, t.id, { text: "請求書は PDF", promoted_to: "client_rule" });
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).not.toBe("E-CONF-037");
    expect(j["error"]).not.toBe("conflict");
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K916-API-002 promoted_to が知らない値（everywhere）：client_rule と同じ 422・何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const r = await add(boss, t.id, { text: "請求書は PDF", promoted_to: "everywhere" });
    expect(r.status).toBe(422);
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K916-API-003 promoted_to が ticket か送らない：どちらも 201・行の promoted_to は ticket", async () => {
    const t = await ticket();
    expect((await add(boss, t.id, { text: "支払いは月末", promoted_to: "ticket" })).status).toBe(201);
    expect((await add(boss, t.id, { text: "見積は税込" })).status).toBe(201);
    const rows = await decisionsOf(t.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((d) => (d as Record<string, unknown>)["promoted_to"])).toEqual(["ticket", "ticket"]);
  });

  it("K916-API-004 見るだけの人が client_rule を付けて呼ぶ：403（権限の判定が先・値の誤りを漏らさない）・何も書かない", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const r = await add(viewer, t.id, { text: "請求書は PDF", promoted_to: "client_rule" });
    expect(r.status).toBe(403);
    expect(await snapshot(t.id)).toEqual(before);
  });

  it("K916-API-005 2 層目：DB の関数に client_rule を直に渡しても行は作られない（not_yet を返す・口の外の枝は凍結の扱いで残す）", async () => {
    const t = await ticket();
    const before = await snapshot(t.id);
    const v = await asMember<{ v: Record<string, unknown> }>(
      boss,
      "select app.ticket_decision_add($1, $2::jsonb) as v",
      [t.id, JSON.stringify({ text: "請求書は PDF", promoted_to: "client_rule" })],
    );
    expect(v.v["error"]).toBe("not_yet");
    expect(await snapshot(t.id)).toEqual(before);
  });
});

describe("K-916 取引先のこれからを外す（契約・エラー・文書・画面）", () => {
  it("K916-API-006 契約：promoted_to の許す値は ticket だけ（screen_api.d と contract_shape.d）・409 E-CONF-037 の行が無い", async () => {
    const api = read("05_flow/screen_api.d/K-390.py");
    const shape = read("scripts/ci/contract_shape.d/K-390.py");
    expect(shape).toContain('"promoted_to": {"enum": ["ticket"]}');
    expect(shape).not.toContain("client_rule");
    expect(api).not.toContain("client_rule");
    expect(api).not.toContain("E-CONF-037");
    expect(api).not.toContain("取引先のルール");
  });

  it("K916-API-007 エラーの正本：errors.d/K-390.json・errors.json・errors.md・errors カタログに E-CONF-037 が無い。errors.d/K-390.json の id は E-VAL-042 だけが残る", async () => {
    for (const p of [
      "07_qa/test-specs/errors.d/K-390.json",
      "07_qa/test-specs/errors.json",
      "07_qa/test-specs/errors.md",
      "packages/errors/src/catalog.ts",
    ])
      expect(read(p), p).not.toContain("E-CONF-037");
    const d = JSON.parse(read("07_qa/test-specs/errors.d/K-390.json")) as unknown;
    const ids = [...JSON.stringify(d).matchAll(/"id":\s*"(E-[A-Z]+-\d+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["E-VAL-042"]);
  });

  it("K916-API-008 ears：ears-elsewhere.d/K-390.json に conflict の行が無く、生成の試験 post_tickets_id_decisions.test.ts・08_api/ears-ac-seed.json・endpoints.json に取引先のルールの行が無い", async () => {
    expect(read("07_qa/test-plan/ears-elsewhere.d/K-390.json")).not.toContain(
      "test_post_tickets_id_decisions_conflict",
    );
    for (const p of [
      "apps/api/test/generated/post_tickets_id_decisions.test.ts",
      "08_api/ears-ac-seed.json",
      "08_api/endpoints.json",
      "07_qa/test-plan/ears-test-mapping.json",
    ])
      expect(read(p), p).not.toMatch(/取引先のルールにした/);
  });

  it("K916-API-009 口のコード：errors.ts に CLIENT_RULE_LATER・E-CONF-037・client_rule の字が無い。not_yet は知らない言葉として止める側（503）へ落ちる", async () => {
    const src = read("apps/api/src/features/F6/decisions/errors.ts");
    for (const w of ["CLIENT_RULE_LATER", "E-CONF-037", "client_rule", "取引先"]) expect(src, w).not.toContain(w);
    expect(src).toContain("decisionsDown");
  });

  it("K916-API-010 画面の部品：features/F6/decisions/views.tsx に「取引先」と client_rule と欄 decision_scope が無い（選び肢が 1 つだけの欄ごと外した）", async () => {
    const src = read("apps/web/features/F6/decisions/views.tsx");
    for (const w of ["取引先", "client_rule", "decision_scope", "どこまで効かせる"]) expect(src, w).not.toContain(w);
    expect(read("apps/web/features/F6/decisions/decisions.css")).not.toContain("k-dec-scope");
  });

  it("K916-API-011 キャンバスの決定の小窓（TdDecision）：作り手 td2.py の「どこまで効かせる」の行ごと外れ、絵（小窓と後ろの詳細の本文）に「どこまで効かせる」「のこれから」「取引先のルール」が無い（そのほかの「取引先」の字は K-870 の申し送りで絵の葉が直す）", async () => {
    const gen = read("04_design/canvas_gen/td2.py");
    const dc = read("04_design/canvas/TdDecision.dc.html");
    for (const w of ["どこまで効かせる", "のこれから", "取引先のルール"]) {
      expect(gen, `td2.py:${w}`).not.toContain(w);
      expect(dc, `TdDecision:${w}`).not.toContain(w);
    }
  });

  it("K916-API-012 凍結の扱い：DB の check の値（0072 の promoted_to の client_rule）と migration は変わらない・取引先のこれからの字は決めた所以外に無い", async () => {
    expect(read("packages/db/migrations/0072_ticket_around.sql")).toContain(
      "check (promoted_to in ('ticket', 'client_rule'))",
    );
    expect(read("packages/db/migrations/20261120130700_ticket_decisions.sql")).toContain("'not_yet'");
    const hits = [
      "apps",
      "packages/contracts/src",
      "05_flow/screen_api.d",
      "07_qa/test-specs/errors.d",
      "scripts/ci/contract_shape.d",
    ].flatMap((d) => grep(d));
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

/** apps などの下で「取引先のこれから」「client_rule」「E-CONF-037」を探す。許す所（K-916 の試験 2 本・K-390 の試験の client_rule を断る行・harness の古い定数・段 7 の枝の試験）は除く */
function grep(dir: string): string[] {
  try {
    const out = execFileSync("git", ["grep", "-n", "-E", "client_rule|E-CONF-037|取引先のこれから", "--", dir], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return out
      .split("\n")
      .filter(
        (l) =>
          l &&
          !l.startsWith("apps/api/test/features/F6/decisions-no-client-rule.test.ts") &&
          !l.startsWith("apps/web/tests/k/k916-decision-scope.spec.ts") &&
          !l.startsWith("apps/api/test/features/F6/decisions.harness.ts") &&
          !l.startsWith("apps/api/test/features/F6/decisions.test.ts") &&
          !l.startsWith("apps/api/test/features/F6/decision-update.test.ts"),
      );
  } catch {
    return [];
  }
}
