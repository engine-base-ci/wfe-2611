// K-926「検収の口 4 本を契約から外す」の単体の試験（契約と生成物と文書のファイル・口の道は本物の入口で 404 を見る）。
// テストの名前の頭の行 ID（K926-API-…）は 11_tickets/K-926.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-155.44：検収を作らない。OK／直してほしいのボタン・検収の帯・検収を頼む小窓・催促・取り下げ・検収の知らせ・完了の条件にすること）:
//   requestAcceptance（POST /tickets/:id/acceptances・A123）・remindAcceptance（POST /acceptances/:id/remind・A123）・
//   getPortalAcceptance（GET /portal/acceptances/:id・A126）・answerAcceptance（POST /portal/acceptances/:id/answer・A126）
//   足す予定だった listTicketAcceptances・withdrawAcceptance は作らない（契約に入っていない）
// 外さないもの：先方の場所のほかの口（getPortalHome ほか）・チケットの見せ方の古い口 updateTicketClientShare（K-881 が見せる相手の口に置き換える）・
//   取引先の口（K-924 が外した）・DB の表 acceptances（消さない・凍結の印は K-883）
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");

/** 外す口 4（操作 ID・方法・道） */
const ACCEPT_OPS: readonly [string, string, string][] = [
  ["requestAcceptance", "POST", "/tickets/{id}/acceptances"],
  ["remindAcceptance", "POST", "/acceptances/{id}/remind"],
  ["getPortalAcceptance", "GET", "/portal/acceptances/{id}"],
  ["answerAcceptance", "POST", "/portal/acceptances/{id}/answer"],
];
const GONE_IDS = ACCEPT_OPS.map(([op]) => op);
const GONE_RX = new RegExp(`\\b(${GONE_IDS.join("|")})\\b`);
interface RetiredRow {
  method: string;
  path: string;
  decision: string;
  reason?: string;
}
/** 生成の試験のファイル名（作り手が道から付ける名前）。道の `{x}` は名前の中で `x`、`-` は `_` になる */
const testFile = (method: string, path: string): string =>
  `${method.toLowerCase()}_${path
    .replace(/\{(\w+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join("_")
    .replace(/-/g, "_")}.test.ts`;
const gitGrepFiles = (args: string[]): string[] =>
  spawnSync("git", ["grep", "-l", ...args], { cwd: ROOT, encoding: "utf-8" })
    .stdout.split("\n")
    .filter(Boolean);
const concrete = (path: string): string => path.replace("{id}", "0193c5a0-0000-7000-8000-00000000d001");

/** 残す口：先方の場所のほかの口・依頼の口 */
const KEPT_OPS = [
  "getPortalHome",
  "createPortalRequest",
  "getPortalRequest",
  "postPortalRequestMessage",
  "uploadPortalAttachment",
  "getPortalTicket",
  "listPortalNotices",
  "listClientRequests",
];

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K926 の会社 ${Math.random().toString(36).slice(2, 7)}`, "AR");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-926 検収の口を契約から外す", () => {
  it("K926-API-001 外した 4 の道は道ごと無い：直に呼ぶと 404（501 でない）・何も起きない（社内の人の文脈でも先方の場所の道でも）", async () => {
    for (const [op, method, path] of ACCEPT_OPS) {
      const r = await f.req(method, concrete(path), {
        headers: writer.auth,
        ...(method === "GET" ? {} : { body: {} }),
      });
      const text = await r.clone().text();
      expect(r.status, `${op} ${method} ${path}：${text}`).toBe(404);
      expect(text, `${op} の名前が体に出ない`).not.toContain(op);
    }
  });

  it("K926-API-002 契約と目録：外した 4 の操作 ID が screen_api.py・build_functional.py・endpoints.json・openapi.yaml・types.ts・registry.ts・ops.ts・lint-mapping.json・catalog.json・catalog.md のどこにも無い", () => {
    for (const p of [
      ["05_flow", "screen_api.py"],
      ["05_flow", "build_functional.py"],
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
    expect(read("05_flow", "screen_api.py"), "行為 A126 の口が残っていない").not.toContain('"A126"');
  });

  it("K926-API-003 口の道の登録：routes/acceptances.ts が無く、routes/index.ts がそれを読まない。routes/tickets.ts・routes/portal.ts に外した道が無い", () => {
    expect(existsSync(join(ROOT, "apps/api/src/routes/acceptances.ts")), "acceptances.ts は消える").toBe(false);
    expect(read("apps", "api", "src", "routes", "index.ts")).not.toMatch(/\.\/acceptances\.js|\bacceptances\(app/);
    for (const file of ["tickets.ts", "portal.ts"]) {
      const s = read("apps", "api", "src", "routes", file);
      expect(s, file).not.toMatch(GONE_RX);
      expect(s, file).not.toMatch(/\/acceptances/);
    }
  });

  it("K926-API-004 生成の試験 4 本が消えている（口ごとの it.todo だけで本物の試験を持たない物）", () => {
    for (const [op, method, path] of ACCEPT_OPS) {
      const name = testFile(method, path);
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", name)), `${op} の ${name}`).toBe(false);
    }
  });

  it("K926-API-005 残す物は触らない：先方の場所のほかの口・依頼の口が endpoints.json に在る（読めていない検査で緑にならないための確かめ）", () => {
    const e = read("08_api", "endpoints.json");
    for (const op of KEPT_OPS) expect(e, `${op} は残る`).toContain(`"${op}"`);
  });

  it("K926-API-006 親の md：K-71.md の apis に外した操作 ID が無く、tests に検収の 4 つの生成の試験（post_tickets_id_acceptances・post_acceptances_id_remind・get_portal_acceptances_id・post_portal_acceptances_id_answer）が無い。依頼・先方の場所の生成の試験（検収を除く）は、持ち主を問わずどれかのチケットの tests: に残る（K-71 から葉へ移った物も含む）", () => {
    const list = (key: "apis" | "tests"): string[] => {
      const m = new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, "m").exec(read("11_tickets", "K-71.md"));
      return m
        ? m[1]!
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    };
    expect(list("apis").filter((x) => GONE_IDS.includes(x))).toEqual([]);
    const gone = ACCEPT_OPS.map(([, m, p]) => testFile(m, p));
    expect(list("tests").filter((t) => gone.some((g) => t.endsWith(`/${g}`)))).toEqual([]);
    // 依頼・先方の場所の生成の試験は、K-71 から葉へ移っていても、どれかのチケットの tests:（carry: ではない）に残る
    const owned = new Set(
      readdirSync(join(ROOT, "11_tickets"))
        .filter((f) => /^K-\d+\.md$/.test(f))
        .flatMap((f) => {
          const m = /^tests:\s*\[(.*)\]\s*$/m.exec(read("11_tickets", f));
          return m ? m[1]!.split(",").map((x) => x.trim()) : [];
        }),
    );
    const kept = readdirSync(join(ROOT, "apps", "api", "test", "generated")).filter(
      (f) => /client_requests|portal_/.test(f) && !f.includes("acceptances"),
    );
    expect(kept.length, "依頼・先方の場所の生成の試験が読めている").toBeGreaterThan(0);
    expect(
      kept.filter((f) => !owned.has(`apps/api/test/generated/${f}`)),
      "持ち主の無い生成の試験",
    ).toEqual([]);
  });

  it("K926-API-007 文書：08_取引先とクライアントの場所.md と 01_チケット.md に、検収の道（`POST /tickets/:id/acceptances`・`POST /acceptances/:id/remind`・`GET /portal/acceptances/:id`・`POST /portal/acceptances/:id/answer`）の行が無く、検収の機能を書いた文（「検収」の字）も無い（D-155.44）。依頼・クライアントの場所のほかの行は残る", () => {
    const rx =
      /(POST \/tickets\/(:id|\{id\})\/acceptances|POST \/acceptances\/(:id|\{id\})\/remind|GET \/portal\/acceptances\/(:id|\{id\})|POST \/portal\/acceptances\/(:id|\{id\})\/answer)/;
    // 表の行は葉ごとの断片（08_取引先とクライアントの場所.d/）に移った（K-1112・PM の決め 2026-11-28）。読む人は断片を合わせた写しを読む
    const doc = read("08_api", "phase1", "合わせた", "08_取引先とクライアントの場所.md");
    expect(doc).not.toMatch(rx);
    expect(read("08_api", "phase1", "01_チケット.md")).not.toMatch(rx);
    // 検収の機能を書いた文も残さない（「足した表」「置き換えた表」の節は事実の記録なので除く。今の 2 つの文書には無い）
    const body = (t: string): string =>
      t.replace(/^#+\s*[^\n]*(足した表|置き換えた表)[^\n]*\n[\s\S]*?(?=^#|(?![\s\S]))/gm, "");
    expect(body(doc), "08_取引先とクライアントの場所.md の検収の文").not.toContain("検収");
    expect(body(read("08_api", "phase1", "01_チケット.md")), "01_チケット.md の検収の文").not.toContain("検収");
    expect(doc, "acceptances.reminded_at の催促の行").not.toContain("acceptances.reminded_at");
    expect(doc, "届いた依頼の節は残る").toContain("`GET /client_requests`");
    expect(doc, "クライアントの場所の節は残る").toContain("`GET /portal`");
  });

  it("K926-API-008 コードと検査の字：apps/api/src（routes を除く）・apps/web・apps/bridge に外した 4 の操作 ID が無く、row_rules.mjs の assignee の言葉から acceptances が外れ、build_functional.py の通知の口の表（_NOTIFY_OPS）から requestAcceptance が外れる", () => {
    const hit = gitGrepFiles([
      "-w",
      "-E",
      GONE_IDS.join("|"),
      "--",
      "apps/api/src",
      "apps/web",
      "apps/bridge",
      ":!apps/api/src/routes/*",
    ]);
    expect(hit, "外した操作 ID を書いているコード").toEqual([]);
    expect(read("scripts", "ci", "row_rules.mjs")).not.toMatch(/acceptances: /);
    expect(read("05_flow", "build_functional.py")).not.toContain("requestAcceptance");
  });

  it("K926-API-009 前からの試験は外した操作 ID を使わない：apps・packages の手で書いた試験と scripts/ci の python の試験に 4 の操作 ID が出てこない（生成の試験・K-924 と K-926 の試験を除く）", () => {
    const out = gitGrepFiles([
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
      ":!apps/api/test/features/F11/clients-retire.test.ts",
      ":!apps/api/test/features/F11/acceptances-retire.test.ts",
    ]);
    expect(out, "外した操作 ID を使う前からの試験").toEqual([]);
  });

  it("K926-API-010 外す口の記録：08_api/retired-endpoints.json に 4 の口がそれぞれ（方法・道）1 行ずつ在り、根拠の決定が D-155.44・理由が空でない。決定ログに D-155.44 の行が在る", () => {
    const rows = (JSON.parse(read("08_api", "retired-endpoints.json")) as { retired: RetiredRow[] }).retired;
    for (const [op, method, path] of ACCEPT_OPS) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} ${method} ${path} の行`).toBe(1);
      expect(hit[0]!.decision, `${op} の根拠`).toBe("D-155.44");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
    expect(read("01_hearing", "決定ログ_進行中.md"), "根拠の決定が決定ログに在る").toContain("| D-155.44 |");
  });

  it("K926-API-011 凍結の前の確かめ：外した後も、検収の表 acceptances は DB に在り、行は消えていない（消さない・凍結の印は K-883）", async () => {
    const r = await f.admin.query<{ ok: boolean }>("select to_regclass('public.acceptances') is not null as ok");
    expect(r.rows[0]!.ok, "acceptances の表").toBe(true);
  });

  it("K926-API-012 外した後も、ほかの口は動く：先方の場所のホーム・チケットの一覧の道は 404 でない（外す作業が別の道を巻き込んでいない）", async () => {
    for (const path of ["/tickets", "/portal"]) {
      const r = await f.req("GET", path, { headers: writer.auth });
      expect(r.status, `${path}：${await r.clone().text()}`).not.toBe(404);
    }
  });
});
