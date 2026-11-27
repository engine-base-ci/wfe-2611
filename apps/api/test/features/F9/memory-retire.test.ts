// K-712「記憶の口と旧い記憶の道を消す」の単体の試験（本物の DB で関数の有無・契約と生成物と文書のファイル・コードの字・本人確認の表の検査）。
// テストの名前の頭の行 ID（K712-DB-…・K712-API-…）は 11_tickets/K-712.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 消すもの（D-152.1・D-152.8・D-152.20：記憶は物として無くす）:
//   契約の口 5：listMemories・createMemory・updateMemory・deleteMemory・promoteMemoryToRule（/memories 系）
//   旧い記憶の道 9（apps/api/src/auth/agent.ts の /agent/memory/…）と、それだけが使う DB の関数 12
//   会話の仕事への記憶の渡し（bridge.ts の withExtras の memories・app.bridge_job_memories）
// 残すもの：「覚えて」の印を記憶に入れる所（takeRemember・app.agent_remember・app.agent_remember_tool）と、前の道で始まったまとめの仕事の
//   結末を受ける所（parseDigest・app.digest_of_job・app.agent_digest_start・app.agent_digest_apply）。表（memories・memory_digests・memory_proposals）は消さない
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDigest, takeRemember } from "../../../src/auth/memory.js";
import { makeFixture, type Fixture } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");
const gitFiles = (args: string[]): string[] =>
  spawnSync("git", ["grep", "-l", ...args], { cwd: ROOT, encoding: "utf-8" })
    .stdout.split("\n")
    .filter(Boolean);
const MIGRATION = "20261125015200_memory_routes_retire";

/** 消す契約の口 5（操作 ID・方法・道）。答えの形の名前 MemoryUpdated も一緒に消える */
const MEMORY_OPS: readonly [string, string, string][] = [
  ["listMemories", "GET", "/memories"],
  ["createMemory", "POST", "/memories"],
  ["updateMemory", "PATCH", "/memories/{id}"],
  ["deleteMemory", "DELETE", "/memories/{id}"],
  ["promoteMemoryToRule", "POST", "/memories/{id}/promote"],
];
const MEMORY_OP_IDS = MEMORY_OPS.map(([op]) => op);
const MEMORY_RX = new RegExp(`\\b(${[...MEMORY_OP_IDS, "MemoryUpdated"].join("|")})\\b`);
/** 旧い記憶の道 9（画面の口 /api/auth-ext の下） */
const OLD_ROUTES = [
  "/agent/memory/digest",
  "/agent/memory/digest/:id/undo",
  "/agent/memory/digest/:id/pick",
  "/agent/memory/:id",
  "/agent/memory/proposals/:id/send",
  "/agent/memory/proposals/:id/decide",
  "/agent/memory/reviews",
];
/** 消す DB の関数 12（旧い道とそれだけが使う物） */
const DROPPED_FUNCTIONS = [
  "agent_digest_status",
  "agent_digest_source",
  "agent_memory_edit",
  "agent_memory_delete",
  "agent_digest_undo_merge",
  "agent_digest_pick",
  "agent_proposal_send",
  "agent_memory_reviews",
  "agent_proposal_decide",
  "agent_my_proposals",
  "bridge_job_memories",
  "memory_reviewer",
];
/** 残す DB の関数 5 */
const KEPT_FUNCTIONS = [
  "agent_remember",
  "agent_remember_tool",
  "agent_digest_start",
  "digest_of_job",
  "agent_digest_apply",
];
const testFile = (method: string, path: string): string =>
  `${method.toLowerCase()}_${path
    .replace(/\{(\w+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join("_")}.test.ts`;

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const appFunctions = async (names: readonly string[]): Promise<string[]> =>
  (
    await f.admin.query<{ proname: string }>(
      "select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = any($1)",
      [names],
    )
  ).rows
    .map((r) => r.proname)
    .sort();

describe("K-712 DB：旧い記憶の道の関数を外し、残す関数と表は残る", () => {
  it("K712-DB-001 旧い記憶の道だけが使っていた DB の関数 12（まとめの状態・元・取り消し・拾い・記憶を直す／消す・上げる・確認する・自分の候補・確認者・会話の仕事への記憶の渡し）が無い", async () => {
    expect(await appFunctions(DROPPED_FUNCTIONS)).toEqual([]);
  });

  it("K712-DB-002 残す関数 5（「覚えて」の印・道具の remember・まとめの仕事を始める・仕事に結ぶまとめ・まとめの結果を入れる）は在り、アプリの接続が実行できる", async () => {
    expect(await appFunctions(KEPT_FUNCTIONS)).toEqual([...KEPT_FUNCTIONS].sort());
    const can = await f.admin.query<{ fn: string; ok: boolean }>(
      `select p.proname as fn, has_function_privilege('kaname_app', p.oid, 'execute') as ok
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = any($1)`,
      [KEPT_FUNCTIONS],
    );
    expect(can.rows.filter((r) => !r.ok).map((r) => r.fn)).toEqual([]);
  });

  it("K712-DB-003 表は消さない：memories・memory_digests・memory_proposals が在り、置いた記憶の行は読み戻せる（凍結の印は K-722）", async () => {
    for (const t of ["memories", "memory_digests", "memory_proposals"]) {
      const r = await f.admin.query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${t}`]);
      expect(r.rows[0]!.ok, `${t} の表`).toBe(true);
    }
    const c = await f.company(`K712 の会社 ${Math.random().toString(36).slice(2, 7)}`, "MR");
    const p = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
    await f.admin.query(
      "insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body) values ($1, $2, 'preference', $3, 'K-712', '前の中身')",
      [c.tenantId, c.rootScope, p.id],
    );
    const row = await f.admin.query<{ body: string }>(
      "select body from memories where owner_member_id = $1 and title = 'K-712'",
      [p.id],
    );
    expect(row.rows).toEqual([{ body: "前の中身" }]);
  });

  it("K712-DB-004 migration：名前が一覧（migrations.generated.ts）に在り、もう一度当てても失敗せず、2 回目のあとも残す関数 5 は在る（drop function if exists）", async () => {
    expect(read("packages", "db", "src", "migrations.generated.ts")).toContain(MIGRATION);
    const sql = read("packages", "db", "migrations", `${MIGRATION}.sql`);
    expect(sql).toMatch(/drop function if exists/i);
    for (const name of KEPT_FUNCTIONS)
      expect(sql, `${name} を消さない`).not.toMatch(new RegExp(`drop function[^;]*\\b${name}\\b`, "i"));
    await f.admin.query(sql);
    await f.admin.query(sql);
    expect(await appFunctions(DROPPED_FUNCTIONS)).toEqual([]);
    expect(await appFunctions(KEPT_FUNCTIONS)).toEqual([...KEPT_FUNCTIONS].sort());
  });

  it("K712-DB-005 K-697 が足した渡し app.bridge_job_knowledge は残っている（記憶の渡しを消すとき一緒に消えていない）", async () => {
    expect(await appFunctions(["bridge_job_knowledge", "knowledge_context"])).toEqual([
      "bridge_job_knowledge",
      "knowledge_context",
    ]);
  });
});

describe("K-712 契約・道・コード・文書：記憶の口と旧い記憶の道を消す", () => {
  it("K712-API-001 旧い記憶の道 9 が消えている：agent.ts に /agent/memory の道が無く、auth-ext-routes.json に記憶の行が無い。会話・成果物・PC の道の行は残る", () => {
    const agent = read("apps", "api", "src", "auth", "agent.ts");
    for (const r of OLD_ROUTES) expect(agent, r).not.toContain(`"${r}"`);
    expect(agent).not.toMatch(/\/agent\/memory/);
    const routes = (
      JSON.parse(read("08_api", "auth-ext-routes.json")) as { routes: { route: string; to: string | null }[] }
    ).routes;
    expect(routes.filter((r) => /\/agent\/memory/.test(r.route)).map((r) => r.route)).toEqual([]);
    expect(routes.map((r) => r.route)).toEqual(
      expect.arrayContaining([
        "/api/auth-ext/agent/conversations",
        "/api/auth-ext/agent/say",
        "/api/auth-ext/agent/steer",
      ]),
    );
  });

  it("K712-API-002 契約と目録：記憶の口 5 と答えの形 MemoryUpdated が screen_api.py・endpoints.json・openapi.yaml・types.ts・registry.ts・ops.ts・catalog.json・catalog.md に無く、routes/memories.ts が消え、routes/index.ts が読まない", () => {
    for (const p of [
      ["05_flow", "screen_api.py"],
      ["08_api", "endpoints.json"],
      ["08_api", "openapi.yaml"],
      ["08_api", "types.ts"],
      ["packages", "contracts", "src", "registry.ts"],
      ["packages", "contracts", "src", "ops.ts"],
      ["03_architecture", "catalog.json"],
      ["03_architecture", "catalog.md"],
    ])
      expect(read(...p), p.join("/")).not.toMatch(MEMORY_RX);
    expect(existsSync(join(ROOT, "apps/api/src/routes/memories.ts"))).toBe(false);
    expect(read("apps", "api", "src", "routes", "index.ts")).not.toMatch(/\.\/memories\.js|\bmemories\(app/);
  });

  it("K712-API-003 外す口の記録：08_api/retired-endpoints.json に 5 つの（方法・道）が 1 行ずつ在り、根拠は D-152.20・理由は空でない", () => {
    const rows = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason?: string }[];
      }
    ).retired;
    for (const [op, method, path] of MEMORY_OPS) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} の行`).toBe(1);
      expect(hit[0]!.decision).toBe("D-152.20");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
  });

  it("K712-API-004 生成の試験 5 本（get_memories・post_memories・patch_memories_id・delete_memories_id・post_memories_id_promote）が消えている", () => {
    for (const [op, method, path] of MEMORY_OPS)
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", testFile(method, path))), op).toBe(false);
  });

  it("K712-API-005 コードから記憶を直す・まとめを組む・まとめの元を引く本体が消え、残す 2 つ（takeRemember・parseDigest）は残る", () => {
    const hit = gitFiles([
      "-w",
      "-E",
      "editMemory|digestPrompt|DigestSource|agent_memory_edit|agent_memory_delete|agent_digest_status|agent_digest_source|agent_digest_pick|agent_digest_undo_merge|agent_proposal_send|agent_proposal_decide|agent_memory_reviews|agent_my_proposals|bridge_job_memories|memory_reviewer",
      "--",
      "apps/api/src",
    ]);
    expect(hit, "消した本体や関数の名前を書いているコード").toEqual([]);
    const m = read("apps", "api", "src", "auth", "memory.ts");
    expect(m).toMatch(/export function takeRemember/);
    expect(m).toMatch(/export function parseDigest/);
    expect(read("apps", "api", "src", "auth", "agent-ops.ts")).not.toMatch(/editMemory/);
  });

  it("K712-API-006 仕事を PC に渡す所（bridge.ts の withExtras）：記憶（memories・bridge_job_memories）を渡さず、道具の鍵・ブラウザ・K-697 のナレッジの渡しは残り、結末を受ける所（覚えての印・まとめの結果）も残る", () => {
    const b = read("apps", "api", "src", "features", "F5", "delegate", "bridge.ts");
    expect(b).not.toMatch(/bridge_job_memories/);
    expect(b).not.toMatch(/\bmemories\b/);
    expect(b).toMatch(/issueToolToken/);
    expect(b).toMatch(/bridge_job_browser/);
    expect(b).toMatch(/bridge_job_knowledge/);
    expect(b).toMatch(/knowledgeExtras/);
    expect(b).toMatch(/takeRemember/);
    expect(b).toMatch(/digest_of_job/);
    expect(b).toMatch(/agent_digest_apply/);
  });

  it("K712-API-007 契約の口の振る舞い（hooks/agent.ts）：updateMemory が消え、会話の 3 つ（createConversation・updateConversation・deleteConversation）は残る", () => {
    const h = read("apps", "api", "src", "hooks", "agent.ts");
    expect(h).not.toMatch(/updateMemory|MEMORY_NOT_FOUND/);
    for (const op of ["createConversation", "updateConversation", "deleteConversation"])
      expect(h, op).toMatch(new RegExp(`\\b${op}\\b`));
  });

  it("K712-API-008 本人確認と契約の外の道の検査（scripts/ci/zt_gate.py）が通る：契約の外の道は全部、行き先か外す理由を持つ（記憶の道の行を消した後も）", () => {
    const r = spawnSync("python3", ["scripts/ci/zt_gate.py"], { cwd: ROOT, encoding: "utf-8" });
    expect(r.status, `${r.stdout.slice(-400)}${r.stderr.slice(-200)}`).toBe(0);
  });

  it("K712-API-009 文書：03_分身の部屋.md から記憶の 5 行（GET・POST・PATCH・DELETE /memories と /memories/:id/promote）が消え、会話の行（GET・POST /conversations）は残る（数・覚えたいことの行は K-721 が消すので見ない）", () => {
    const doc = read("08_api", "phase1", "03_分身の部屋.md");
    expect(doc).not.toMatch(/`(GET|POST|PATCH|DELETE) \/memories/);
    expect(doc).toMatch(/`GET \/conversations`/);
    expect(doc).toMatch(/`POST \/conversations`/);
  });

  it("K712-API-010 親の md：K-69.md の apis から記憶の口 5 が、tests から生成の試験 5 本の名前が外れる（ほかの口は K-711・K-721・K-722 が外して apis が空になるので、残る口は見ない）", () => {
    const k69 = read("11_tickets", "K-69.md");
    expect(k69).toMatch(/^id: K-69$/m);
    const apis = /^apis:\s*\[(.*)\]\s*$/m
      .exec(k69)![1]!
      .split(",")
      .map((x) => x.trim());
    expect(apis.filter((x) => MEMORY_OP_IDS.includes(x))).toEqual([]);
    const tests = /^tests:\s*\[(.*)\]\s*$/m.exec(k69)![1]!;
    expect(tests).not.toMatch(/_memories(_id)?(_promote)?\.test\.ts/);
  });

  it("K712-API-011 前からの試験が消した口・道・関数を使わない：手で書いた試験（生成の試験とこの試験を除く）に /agent/memory・記憶の口 5・digestPrompt・editMemory・newMemory・newProposal が出てこない", () => {
    const hit = gitFiles([
      "-E",
      // \b は Mac の git grep -E で効かないので、前後が名前の字でないことを字の組で書く（Mac と Linux で同じ）
      "agent/memory|(^|[^A-Za-z0-9_])(listMemories|createMemory|updateMemory|deleteMemory|promoteMemoryToRule|digestPrompt|editMemory|newMemory|newProposal)([^A-Za-z0-9_]|$)",
      "--",
      "apps/*/test/*.ts",
      "apps/*/test/**/*.ts",
      "packages/*/test/*.ts",
      "scripts/ci/*_test.py",
      ":!apps/api/test/generated/*",
      ":!apps/api/test/features/F9/memory-retire.test.ts",
      ":!apps/api/test/features/F9/rules-work-types-retire.test.ts",
      // 消したことを確かめる側の字（消した名前を並べて「無い」を見る）。消した口を使う試験ではない
      ":!apps/web/test/k725-memory-ui-retire.test.ts",
      ":!scripts/ci/k722_flow_test.py",
    ]);
    expect(hit).toEqual([]);
  });

  it("K712-API-012 前の道で始まったまとめの仕事の結末を受ける所が残る：bridge.ts が digest_of_job・agent_digest_apply を呼び、parseDigest が「覚えて」とまとめの JSON を読める（動く確かめは前からの K62-API-065・066）", () => {
    const t = takeRemember("了解です。\n[[覚える: 税込を先に]]");
    expect(t).toEqual({ text: "了解です。", items: ["税込を先に"] });
    const d = parseDigest('{"remembered":[{"body":"金曜は定休"}],"merged":[],"propose":[],"discarded":[]}');
    expect(d?.remembered.map((x) => x.body)).toEqual(["金曜は定休"]);
    expect(parseDigest("書き忘れました")).toBeNull();
  });
});
