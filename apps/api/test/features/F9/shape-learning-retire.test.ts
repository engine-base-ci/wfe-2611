// K-721「覚えたいこと・知っていることの数・チケットの形の口 9 本を契約から外す」の単体の試験（契約と生成物と文書のファイル・口の道は本物の入口で 404 を見る）。
// テストの名前の頭の行 ID（K721-API-…）は 11_tickets/K-721.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-152.1・D-152.20：覚えたいこと・チケットの形（区画）は物として無くす）:
//   覚えたいこと 5：listLearningCandidates・acceptLearningCandidate・dismissLearningCandidate・postponeLearningCandidate・requestRuleException
//   知っていることの数 1：countKnows
//   チケットの形 3：getTicketShape・previewTicketShapeChange・saveTicketShape（種別・状態・項目は K-704・K-705・K-706・K-717 の口が持つ）
// 外さないもの：運営ひな形の 2 口（makeKindTemplateFromTicket は段 13 の K-993 が外した・D-156.20）・listHandoverRules・上の 4 つの葉の口・listTicketFields
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");
const gitFiles = (args: string[]): string[] =>
  spawnSync("git", ["grep", "-l", ...args], { cwd: ROOT, encoding: "utf-8" })
    .stdout.split("\n")
    .filter(Boolean);

/** 外す口 9（操作 ID・方法・道）。答えの形の名前（KnowsCounts・TicketShape・TicketShapeChangePreview）も一緒に消える */
const GONE: readonly [string, string, string][] = [
  ["countKnows", "GET", "/clones/me/knows/counts"],
  ["listLearningCandidates", "GET", "/learning_candidates"],
  ["acceptLearningCandidate", "POST", "/learning_candidates/{id}/accept"],
  ["dismissLearningCandidate", "POST", "/learning_candidates/{id}/dismiss"],
  ["postponeLearningCandidate", "POST", "/learning_candidates/{id}/later"],
  ["requestRuleException", "POST", "/learning_candidates/{id}/exception-request"],
  ["getTicketShape", "GET", "/workspace/ticket-shape"],
  ["previewTicketShapeChange", "POST", "/workspace/ticket-shape/preview"],
  ["saveTicketShape", "PATCH", "/workspace/ticket-shape"],
];
const GONE_IDS = GONE.map(([op]) => op);
const GONE_RX = new RegExp(
  `\\b(${[...GONE_IDS, "KnowsCounts", "TicketShape", "TicketShapeChangePreview"].join("|")})\\b`,
);
/** 残す口：上の 4 つの葉の口・運営ひな形・渡すときの読む口・項目を読む口 */
const KEPT_OPS = [
  "createTicketKind",
  "updateTicketKind",
  "deleteTicketKind",
  "reorderTicketKinds",
  "listTicketStages",
  "createTicketStage",
  "updateTicketStage",
  "deleteTicketStage",
  "reorderTicketStages",
  "listTicketFieldMaster",
  "createTicketField",
  "updateTicketField",
  "deleteTicketField",
  "reorderTicketFields",
  "listTicketFields",
  "listKindTemplateUpdates",
  "applyKindTemplateUpdate",
  "listHandoverRules",
];
const testFile = (method: string, path: string): string =>
  `${method.toLowerCase()}_${path
    .replace(/\{(\w+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join("_")
    .replace(/-/g, "_")}.test.ts`;
const concrete = (path: string): string => path.replace("{id}", "0193c5a0-0000-7000-8000-00000000d001");

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K721 の会社 ${Math.random().toString(36).slice(2, 7)}`, "SL");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-721 覚えたいこと・数・チケットの形の口を契約から外す", () => {
  it("K721-API-001 外した 9 の道は道ごと無い：404（501 でない）。直に呼んでも何も起きない", async () => {
    for (const [op, method, path] of GONE) {
      const r = await f.req(method, concrete(path), {
        headers: writer.auth,
        ...(method === "GET" ? {} : { body: {} }),
      });
      expect(r.status, `${op} ${method} ${path}：${await r.clone().text()}`).toBe(404);
    }
  });

  it("K721-API-002 契約と目録：外した 9 の操作 ID と答えの形の名前が screen_api.py・endpoints.json・openapi.yaml・types.ts・lint-mapping.json・registry.ts・ops.ts・catalog.json・catalog.md に無い", () => {
    for (const p of [
      ["05_flow", "screen_api.py"],
      ["08_api", "endpoints.json"],
      ["08_api", "openapi.yaml"],
      ["08_api", "types.ts"],
      ["08_api", "lint-mapping.json"],
      ["packages", "contracts", "src", "registry.ts"],
      ["packages", "contracts", "src", "ops.ts"],
      ["03_architecture", "catalog.json"],
      ["03_architecture", "catalog.md"],
    ])
      expect(read(...p), p.join("/")).not.toMatch(GONE_RX);
  });

  it("K721-API-003 口の道の登録：routes/learning_candidates.ts が消えて routes/index.ts が読まず、routes/clones.ts から数の道が、routes/workspace.ts からチケットの形の道が消え、それぞれほかの道は残る", () => {
    expect(existsSync(join(ROOT, "apps/api/src/routes/learning_candidates.ts"))).toBe(false);
    expect(read("apps", "api", "src", "routes", "index.ts")).not.toMatch(
      /\.\/learning_candidates\.js|\blearning_candidates\(app/,
    );
    const clones = read("apps", "api", "src", "routes", "clones.ts");
    expect(clones).not.toMatch(/knows\/counts|countKnows/);
    expect(clones).toMatch(/op\(deps, "getMyClone"\)/);
    const ws = read("apps", "api", "src", "routes", "workspace.ts");
    expect(ws).not.toMatch(/ticket-shape|TicketShape/);
    expect(ws).toMatch(/op\(deps, "/);
  });

  it("K721-API-004 生成の試験 9 本（get_clones_me_knows_counts・get_learning_candidates・post_learning_candidates_id_accept・…_dismiss・…_later・…_exception_request・get_workspace_ticket_shape・patch_workspace_ticket_shape・post_workspace_ticket_shape_preview）が消える", () => {
    for (const [op, method, path] of GONE)
      expect(
        existsSync(join(ROOT, "apps", "api", "test", "generated", testFile(method, path))),
        `${op} の ${testFile(method, path)}`,
      ).toBe(false);
  });

  it("K721-API-005 外す口の記録：08_api/retired-endpoints.json に 9 の口が（方法・道）ごと 1 行ずつ在り、根拠は D-152.20・理由は空でない", () => {
    const rows = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason?: string }[];
      }
    ).retired;
    for (const [op, method, path] of GONE) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} ${method} ${path} の行`).toBe(1);
      expect(hit[0]!.decision, `${op} の根拠`).toBe("D-152.20");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
  });

  it("K721-API-006 残す口：種別・状態・項目の 15 の口（K-704・K-705・K-706・K-717・K-563）・運営ひな形の 2 口・渡すときの読む口が endpoints.json に在る（外す作業が代わりの口を巻き込んでいない）", () => {
    const e = read("08_api", "endpoints.json");
    for (const op of KEPT_OPS) expect(e, `${op} は残る`).toContain(`"${op}"`);
  });

  it("K721-API-007 親の md：K-69.md の apis に覚えたいこと 5 と countKnows が無く、tests から 9 本の生成の試験の名前が外れる", () => {
    const k69 = read("11_tickets", "K-69.md");
    const apis = /^apis:\s*\[(.*)\]\s*$/m
      .exec(k69)![1]!
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    expect(apis.filter((x) => GONE_IDS.includes(x))).toEqual([]);
    const tests = /^tests:\s*\[(.*)\]\s*$/m.exec(k69)![1]!;
    for (const [, method, path] of GONE) expect(tests, testFile(method, path)).not.toContain(testFile(method, path));
  });

  it("K721-API-008 文書：03_分身の部屋.md から数・覚えたいこと・決まり・やり方の節（見出しと表）が消え、07_ワークスペースの管理.md にチケットの形の道が無い。06 の運営ひな形の行は残る", () => {
    const d03 = read("08_api", "phase1", "03_分身の部屋.md");
    for (const gone of ["/clones/me/knows/counts", "/learning_candidates", "/memories", "/rules", "/work_types"])
      expect(d03, gone).not.toContain(`\`GET ${gone}`);
    expect(d03).not.toMatch(/^### (必ず守ること|やり方)/m);
    expect(read("08_api", "phase1", "07_ワークスペースの管理.md")).not.toMatch(/ticket-shape/);
    expect(read("08_api", "phase1", "06_運営の配るもの.md")).toContain("/ops/templates");
  });

  it("K721-API-009 検査の表：row_rules.mjs の RULES.self から learning_candidates の行が消え、本人確認と契約の外の道の検査（zt_gate.py）が通る", () => {
    expect(read("scripts", "ci", "row_rules.mjs")).not.toMatch(/^\s*learning_candidates:/m);
    const r = spawnSync("python3", ["scripts/ci/zt_gate.py"], { cwd: ROOT, encoding: "utf-8" });
    expect(r.status, `${r.stdout.slice(-400)}${r.stderr.slice(-200)}`).toBe(0);
  });

  it("K721-API-010 コードと前からの試験：外した 9 の操作 ID を書いたコード（routes の登録を除く）・手で書いた試験（生成の試験とこの試験を除く）が 0 ファイル", () => {
    const code = gitFiles([
      "-w",
      "-E",
      GONE_IDS.join("|"),
      "--",
      "apps/api/src",
      "apps/web",
      "apps/bridge",
      ":!apps/api/src/routes/*",
    ]);
    expect(code, "外した操作 ID を書いているコード").toEqual([]);
    const tests = gitFiles([
      "-w",
      "-E",
      GONE_IDS.join("|"),
      "--",
      "apps/*/test/*.ts",
      "apps/*/test/**/*.ts",
      "apps/*/tests/**/*.ts",
      "packages/*/test/*.ts",
      "scripts/ci/*_test.py",
      ":!apps/api/test/generated/*",
      ":!apps/api/test/features/F9/shape-learning-retire.test.ts",
      // 消した名前・残る名前を並べて確かめる側の字（K-712 の「残る口」・K-722 の GONE_OPS）。外した口を使う試験ではない
      ":!apps/api/test/features/F9/memory-retire.test.ts",
      ":!scripts/ci/k722_flow_test.py",
    ]);
    expect(tests, "外した操作 ID を使う前からの試験").toEqual([]);
  });

  it("K721-API-011 表は消さない：learning_candidates・handover_rules が DB に在る（learning_candidates の凍結の印は K-722。handover_rules は listHandoverRules が使い続ける）", async () => {
    for (const t of ["learning_candidates", "handover_rules"]) {
      const r = await f.admin.query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${t}`]);
      expect(r.rows[0]!.ok, `${t} の表`).toBe(true);
    }
  });

  it("K721-API-012 外した道の隣は動く：チケットの種別の道（GET /ticket_kinds）は 404 でない（外す作業が別の道を巻き込んでいない）", async () => {
    const r = await f.req("GET", "/ticket_kinds", { headers: writer.auth });
    expect(r.status, await r.clone().text()).not.toBe(404);
  });
});
