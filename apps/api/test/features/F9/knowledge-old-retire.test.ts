// K-722「ナレッジの前の形の口 23 本を契約から外す」の単体の試験（契約と生成物と文書のファイル・口の道は本物の入口で 404 を見る）。
// テストの名前の頭の行 ID（K722-API-…）は 11_tickets/K-722.md の行の表に 1 対 1 で結ぶ。流れと凍結の印の行（K722-FL-…）は scripts/ci/k722_flow_test.py。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-152.9：下絵 v2 の 25 の状態に無い物は作らない）: ホーム・一覧・ことばで聞く・役に立った・画像やファイルを入れる・前の版へ戻す・
//   Markdown の書き出し・使われ方・つながり（2）・[[ の呼び先・やり取り（2）・確かめること（2）・しまう（2）・直す案（3）・取り込み（3）の 23 本
// 外さないもの：木・ページ・版・フォルダ・下書き・書き終える・動かす・消す・必ず守る・似たページ・上げる・共有・写す・見直すページ（K-675 以降の葉の口）と `search`（K-470）
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

/** 外す口 23（操作 ID・方法・道） */
const GONE: readonly [string, string, string][] = [
  ["getKnowledgeHome", "GET", "/knowledge/home"],
  ["listKnowledgePages", "GET", "/knowledge_pages"],
  ["askKnowledge", "POST", "/knowledge/ask"],
  ["sendKnowledgeAnswerFeedback", "POST", "/knowledge/ask/feedback"],
  ["uploadKnowledgeAttachment", "POST", "/knowledge_pages/{id}/attachments"],
  ["restoreKnowledgeVersion", "POST", "/knowledge_pages/{id}/versions/{v}/restore"],
  ["exportKnowledgeMarkdown", "GET", "/knowledge_pages/{id}/markdown"],
  ["getKnowledgeUsage", "GET", "/knowledge_pages/{id}/usage"],
  ["getKnowledgeLinks", "GET", "/knowledge_pages/{id}/links"],
  ["linkKnowledgeMention", "POST", "/knowledge_pages/{id}/links"],
  ["searchKnowledgeLinkTargets", "GET", "/knowledge/link-targets"],
  ["listKnowledgeMessages", "GET", "/knowledge_pages/{id}/messages"],
  ["postKnowledgeMessage", "POST", "/knowledge_pages/{id}/messages"],
  ["listKnowledgeVerifications", "GET", "/knowledge/verifications"],
  ["verifyKnowledgePage", "POST", "/knowledge_pages/{id}/verify"],
  ["archiveKnowledgePage", "POST", "/knowledge_pages/{id}/archive"],
  ["unarchiveKnowledgePage", "POST", "/knowledge_pages/{id}/unarchive"],
  ["listKnowledgeProposals", "GET", "/knowledge/proposals"],
  ["acceptKnowledgeProposal", "POST", "/knowledge/proposals/{id}/accept"],
  ["declineKnowledgeProposal", "POST", "/knowledge/proposals/{id}/decline"],
  ["createKnowledgeImport", "POST", "/knowledge_imports"],
  ["getKnowledgeImport", "GET", "/knowledge_imports/{id}"],
  ["commitKnowledgeImport", "POST", "/knowledge_imports/{id}/commit"],
];
const GONE_IDS = GONE.map(([op]) => op);
/**
 * 外す口だけが持っていた答えの形の名前（残す口は別の名前を持つ）。
 * KnowledgeLinks は入れない：表 knowledge_links の形（作り手がどの表にも作る型）と同じ名前で、
 * 口を外しても openapi.yaml・types.ts・schemas.ts に残る（口 getKnowledgeLinks が無いことは GONE_IDS が見る）
 */
const GONE_SHAPES = [
  "KnowledgeHome",
  "KnowledgeAnswer",
  "KnowledgeUsage",
  "KnowledgeLinkTarget",
  "KnowledgeVerification",
  "KnowledgeImportPreview",
];
const GONE_RX = new RegExp(`\\b(${[...GONE_IDS, ...GONE_SHAPES].join("|")})\\b`);
/** 残す口（新しい形で宣言し直した物と、ナレッジの前の口のうち使い続ける物） */
const KEPT_OPS = [
  "getKnowledgeTree",
  "getKnowledgePage",
  "listKnowledgeVersions",
  "getKnowledgePageVersion",
  "createKnowledgeFolder",
  "updateKnowledgeFolder",
  "deleteKnowledgeFolder",
  "createKnowledgePage",
  "saveKnowledgeDraft",
  "discardKnowledgeDraft",
  "publishKnowledgePage",
  "updateKnowledgePage",
  "deleteKnowledgePage",
  "setKnowledgeMust",
  "findSimilarKnowledge",
  "copyKnowledgePage",
  "requestKnowledgeRaise",
  "withdrawKnowledgeRequest",
  "dismissKnowledgeRequest",
  "listKnowledgeApprovals",
  "approveKnowledgeRequest",
  "declineKnowledgeRequest",
  "getKnowledgeShares",
  "setKnowledgeShares",
  "getKnowledgeReview",
  "search",
];
const testFile = (method: string, path: string): string =>
  `${method.toLowerCase()}_${path
    .replace(/\{(\w+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join("_")
    .replace(/-/g, "_")}.test.ts`;
const concrete = (path: string): string =>
  path.replace("{id}", "0193c5a0-0000-7000-8000-00000000d001").replace("{v}", "1");

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K722 の会社 ${Math.random().toString(36).slice(2, 7)}`, "KO");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-722 ナレッジの前の形の口 23 を契約から外す", () => {
  it("K722-API-001 外した 23 の道（方法つき）は 404（501 でない）。同じ道の別の方法（POST /knowledge_pages・GET /knowledge_pages/:id・PATCH・DELETE）は残る口なので 404 にならない", async () => {
    for (const [op, method, path] of GONE) {
      const r = await f.req(method, concrete(path), {
        headers: writer.auth,
        ...(method === "GET" || method === "DELETE" ? {} : { body: {} }),
      });
      // 同じ道に別の方法の口が残る道（GET /knowledge_pages は POST が残る）は、前からの入口の決まり（K-35・K-421・契約 fuzz の ST204・ST205：
      //   契約にある道に契約に無い方法は 405 と使える方法 Allow）で 405。そのときも外した方法は Allow に入らない（口は無い）
      if (r.status === 405) {
        expect(r.headers.get("allow") ?? "", `${op} ${method} ${path} の Allow`).not.toContain(method);
        continue;
      }
      expect(r.status, `${op} ${method} ${path}：${await r.clone().text()}`).toBe(404);
    }
    const kept = await f.req("GET", concrete("/knowledge_pages/{id}"), { headers: writer.auth });
    const keptBody = (await kept.json().catch(() => ({}))) as { code?: string };
    expect(keptBody.code, "残す口は道が在り、口の答えの形（code つきの JSON）で返る").toBeTruthy();
  });

  it("K722-API-002 契約と目録：外した 23 の操作 ID と答えの形の名前が screen_api.py・endpoints.json・openapi.yaml・types.ts・lint-mapping.json・registry.ts・ops.ts・catalog.json・catalog.md に無い", () => {
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

  it("K722-API-003 口の道の登録：routes/knowledge_imports.ts が消えて routes/index.ts が読まず、routes/knowledge.ts・routes/knowledge_pages.ts から外した道が消え、残す口の道は残る", () => {
    expect(existsSync(join(ROOT, "apps/api/src/routes/knowledge_imports.ts"))).toBe(false);
    expect(read("apps", "api", "src", "routes", "index.ts")).not.toMatch(
      /\.\/knowledge_imports\.js|\bknowledge_imports\(app/,
    );
    for (const file of ["knowledge.ts", "knowledge_pages.ts"]) {
      const s = read("apps", "api", "src", "routes", file);
      expect(s, file).not.toMatch(new RegExp(`op\\(deps, "(${GONE_IDS.join("|")})"\\)`));
    }
    const pages = read("apps", "api", "src", "routes", "knowledge_pages.ts");
    for (const op of ["getKnowledgePage", "createKnowledgePage", "publishKnowledgePage"])
      expect(pages, op).toContain(`op(deps, "${op}")`);
  });

  it("K722-API-004 生成の試験 23 本（get_knowledge_home・get_knowledge_pages・post_knowledge_ask ほか）が消え、残す口の生成の試験（get_knowledge_tree・get_knowledge_pages_id・post_knowledge_pages_id_publish）は残る", () => {
    for (const [op, method, path] of GONE)
      expect(
        existsSync(join(ROOT, "apps", "api", "test", "generated", testFile(method, path))),
        `${op} の ${testFile(method, path)}`,
      ).toBe(false);
    for (const kept of ["get_knowledge_tree", "get_knowledge_pages_id", "post_knowledge_pages_id_publish"])
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", `${kept}.test.ts`)), kept).toBe(true);
  });

  it("K722-API-005 外す口の記録：08_api/retired-endpoints.json に 23 の口が（方法・道）ごと 1 行ずつ在り、根拠は D-152.9・理由は空でない。決定ログに D-152.9 の行が在る", () => {
    const rows = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason?: string }[];
      }
    ).retired;
    for (const [op, method, path] of GONE) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} ${method} ${path} の行`).toBe(1);
      expect(hit[0]!.decision, `${op} の根拠`).toBe("D-152.9");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
    expect(read("01_hearing", "決定ログ_進行中.md")).toContain("| D-152.9 |");
  });

  it("K722-API-006 残す口：新しい形のナレッジの口 25 と search が endpoints.json に在る（外す作業が新しい口を巻き込んでいない）。運営ひな形の 3 口も在る", () => {
    const e = read("08_api", "endpoints.json");
    // makeKindTemplateFromTicket は後から入った K-993（D-156.20・チケットからひな形を作る口は作らない）が契約から外した。残る運営ひな形の口は 2 つ
    for (const op of [...KEPT_OPS, "listKindTemplateUpdates", "applyKindTemplateUpdate"])
      expect(e, `${op} は残る`).toContain(`"${op}"`);
  });

  it("K722-API-007 文書と親：09_ナレッジ.md の 1 章の表に外した 23 の道の行が無く、K-69.md の apis と tests に外した口・生成の試験が無い", () => {
    const doc = read("08_api", "phase1", "09_ナレッジ.md");
    for (const [, method, path] of GONE) {
      const p = path.replace(/\{(\w+)\}/g, ":$1");
      expect(doc, `${method} ${p}`).not.toContain(`\`${method} ${p}\``);
    }
    const k69 = read("11_tickets", "K-69.md");
    const apis = /^apis:\s*\[(.*)\]\s*$/m
      .exec(k69)![1]!
      .split(",")
      .map((x) => x.trim());
    expect(apis.filter((x) => GONE_IDS.includes(x))).toEqual([]);
    const tests = /^tests:\s*\[(.*)\]\s*$/m.exec(k69)![1]!;
    for (const [, method, path] of GONE) expect(tests, testFile(method, path)).not.toContain(testFile(method, path));
  });

  it("K722-API-008 検査の表：row_rules.mjs の ID_TABLE から /api/v1/knowledge/proposals・/api/v1/knowledge_imports の 2 行が消え、本人確認と契約の外の道の検査（zt_gate.py）が通る", () => {
    const rr = read("scripts", "ci", "row_rules.mjs");
    expect(rr).not.toMatch(/"\/api\/v1\/knowledge\/proposals"|"\/api\/v1\/knowledge_imports"/);
    expect(rr, "残す行は残る").toContain("knowledge_pages: `(deleted_at is not null or app.kpage_writable(id))`");
    const r = spawnSync("python3", ["scripts/ci/zt_gate.py"], { cwd: ROOT, encoding: "utf-8" });
    expect(r.status, `${r.stdout.slice(-400)}${r.stderr.slice(-200)}`).toBe(0);
  });

  it("K722-API-009 コードと前からの試験：外した 23 の操作 ID を書いたコード（routes の登録を除く）・手で書いた試験（生成の試験とこの試験を除く）が 0 ファイル", () => {
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
      ":!apps/api/test/features/F9/knowledge-old-retire.test.ts",
      // 消した名前を並べて「無い」を確かめる側の字（K-722 の流れの試験の GONE_OPS）。外した口を使う試験ではない
      ":!scripts/ci/k722_flow_test.py",
    ]);
    expect(tests, "外した操作 ID を使う前からの試験").toEqual([]);
  });

  it("K722-API-010 凍結する表は DB に在り、行が消えていない：memories・skills・skill_versions・skill_test_runs・policies・learning_candidates・knowledge_links・imports（凍結の印は目録だけ・表は触らない）", async () => {
    for (const t of [
      "memories",
      "skills",
      "skill_versions",
      "skill_test_runs",
      "policies",
      "learning_candidates",
      "knowledge_links",
      "imports",
    ]) {
      const r = await f.admin.query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${t}`]);
      expect(r.rows[0]!.ok, `${t} の表`).toBe(true);
    }
  });

  it("K722-API-011 凍結の印は表のコードの読み手を持たない：apps・packages の src（試験・migration を除く）に、凍結する 8 つの表を from・join・into・update・app.<表> で読み書きする所が無い", () => {
    const rx =
      "(from|join|into|update)[[:space:]]+(app\\.)?(memories|skills|skill_versions|skill_test_runs|policies|learning_candidates|knowledge_links|imports)\\b|app\\.(memories|skills|skill_versions|skill_test_runs|policies|learning_candidates|knowledge_links|imports)\\b";
    const hit = gitFiles([
      "-i",
      "-E",
      rx,
      "--",
      "apps/*/src",
      "packages/*/src",
      ":!*.test.*",
      ":!packages/db/src/migrations.generated.ts",
    ]);
    expect(hit, "凍結する表を使っているコード").toEqual([]);
  });
});
