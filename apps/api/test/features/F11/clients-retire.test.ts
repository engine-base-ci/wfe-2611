// K-924「取引先の口 12 本を契約から外す」の単体の試験（契約と、作り手が作り直すファイルと、文書・口の道は本物の入口で 404 を見る）。
// テストの名前の頭の行 ID（K924-API-…）は 11_tickets/K-924.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-155.35：取引先を別の登録として持たない・先方の人は役割「ゲスト」で招く）:
//   行為 A121 の取引先の口 12（契約の表では 13 行：listClients が 2 行＝チケットの画面用 A103 と取引先の一覧 A121）：
//   listClients・listClientLinkCandidates・createClient・getClient・updateClient・listClientActivity・updateClientShare・
//   getClientPortalPreview・createClientContact・updateClientContact・removeClientContact・inviteClientContact
// 外さないもの：依頼の口（listClientRequests ほか A122）・先方の場所の口（getPortalHome ほか /portal の下）・
//   検収の口（K-926 が外す）・見せる相手の口（K-881 が足す）・行為 A121 に並んでいた決まりの口 2 本（段 10 の K-711 が外す）
// この葉は決定ログ §155（D-155.1〜55）を本線に入れる最初の葉でもある（外す口の記録 retired-endpoints.json の根拠の決定が、決定ログにあることが要る）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");

/** 外す口 12（操作 ID・方法・道） */
const CLIENT_OPS: readonly [string, string, string][] = [
  ["listClients", "GET", "/clients"],
  ["listClientLinkCandidates", "GET", "/clients/link-candidates"],
  ["createClient", "POST", "/clients"],
  ["getClient", "GET", "/clients/{id}"],
  ["updateClient", "PATCH", "/clients/{id}"],
  ["listClientActivity", "GET", "/clients/{id}/activity"],
  ["updateClientShare", "PATCH", "/clients/{id}/share"],
  ["getClientPortalPreview", "GET", "/clients/{id}/portal-preview"],
  ["createClientContact", "POST", "/clients/{id}/contacts"],
  ["updateClientContact", "PATCH", "/client_contacts/{id}"],
  ["removeClientContact", "DELETE", "/client_contacts/{id}"],
  ["inviteClientContact", "POST", "/client_contacts/{id}/invitation"],
];
const GONE_IDS = CLIENT_OPS.map(([op]) => op);
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
const asked = (method: string): { body?: object } => (method === "GET" || method === "DELETE" ? {} : { body: {} });
const concrete = (path: string): string => path.replace("{id}", "0193c5a0-0000-7000-8000-00000000d001");

/** 残す口：依頼の口・先方の場所の口（検収の口は K-926 が外すので数えない） */
const KEPT_OPS = [
  "listClientRequests",
  "getClientRequest",
  "updateClientRequest",
  "replyToClientRequest",
  "acceptClientRequest",
  "declineClientRequest",
  "getPortalHome",
  "createPortalRequest",
  "getPortalRequest",
  "postPortalRequestMessage",
  "uploadPortalAttachment",
  "getPortalTicket",
  "listPortalNotices",
];

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K924 の会社 ${Math.random().toString(36).slice(2, 7)}`, "CR");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-924 取引先の口を契約から外す", () => {
  it("K924-API-001 外した 12 の道は道ごと無い：直に呼ぶと 404（501 でない）・何も起きない", async () => {
    for (const [op, method, path] of CLIENT_OPS) {
      const r = await f.req(method, concrete(path), { headers: writer.auth, ...asked(method) });
      const text = await r.clone().text();
      expect(r.status, `${op} ${method} ${path}：${text}`).toBe(404);
      expect(text, `${op} の名前が体に出ない`).not.toContain(op);
    }
  });

  it("K924-API-002 契約と目録：外した 12 の操作 ID が screen_api.py・endpoints.json・openapi.yaml・types.ts・registry.ts・ops.ts・lint-mapping.json・catalog.json・catalog.md のどこにも無い（listClients の 2 行とも）", () => {
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
    expect(
      read("05_flow", "screen_api.py"),
      "行為 A121 の取引先の口が残っていない（同じ行為の決まりの口 2 本は K-711 が外す）",
    ).not.toContain('"A121", "clients"');
  });

  it("K924-API-003 口の道の登録：routes/clients.ts・routes/client_contacts.ts が無く、routes/index.ts がそれを読まない。ほかの routes に外した道が無い", () => {
    for (const n of ["clients.ts", "client_contacts.ts"])
      expect(existsSync(join(ROOT, "apps/api/src/routes", n)), `${n} は消える`).toBe(false);
    const index = read("apps", "api", "src", "routes", "index.ts");
    expect(index).not.toMatch(/\.\/clients\.js|\.\/client_contacts\.js|\bclients\(app|\bclient_contacts\(app/);
    for (const file of ["tickets.ts", "portal.ts", "client_requests.ts", "knowledge.ts"]) {
      const s = read("apps", "api", "src", "routes", file);
      expect(s, file).not.toMatch(GONE_RX);
      expect(s, file).not.toMatch(/"\/api\/v1\/clients|\/api\/v1\/client_contacts/);
    }
  });

  it("K924-API-004 生成の試験 12 本が消えている（口ごとの it.todo だけで本物の試験を持たない物。get_clients.test.ts は listClients の 1 本）", () => {
    for (const [op, method, path] of CLIENT_OPS) {
      const name = testFile(method, path);
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", name)), `${op} の ${name}`).toBe(false);
    }
  });

  it("K924-API-005 残す物は触らない：依頼の口・先方の場所の口が endpoints.json に在る（読めていない検査で緑にならないための確かめ）", () => {
    const e = read("08_api", "endpoints.json");
    for (const op of KEPT_OPS) expect(e, `${op} は残る`).toContain(`"${op}"`);
  });

  it("K924-API-006 親の md：K-59.md の apis から listClients が外れ・tests から get_clients.test.ts が外れる。K-71.md の tests に取引先の 11 の生成の試験が無い。残る口の名前は残る", () => {
    const list = (k: string, key: "apis" | "tests"): string[] => {
      const m = new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, "m").exec(read("11_tickets", `${k}.md`));
      return m
        ? m[1]!
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    };
    expect(list("K-59", "apis")).not.toContain("listClients");
    expect(list("K-59", "apis")).toContain("createTicketLink");
    expect(list("K-59", "tests").filter((t) => t.endsWith("/get_clients.test.ts"))).toEqual([]);
    const gone = CLIENT_OPS.map(([, m, p]) => testFile(m, p));
    expect(list("K-71", "tests").filter((t) => gone.some((g) => t.endsWith(`/${g}`)))).toEqual([]);
    expect(list("K-71", "apis").filter((x) => GONE_IDS.includes(x))).toEqual([]);
    expect(list("K-71", "tests")).toEqual([]);
  });

  it("K924-API-007 文書：08_取引先とクライアントの場所.md の取引先の節（`GET /clients` ほか 12 の道）と 01_チケット.md の `GET /clients` の行が無い。依頼・クライアントの場所の節は残る", () => {
    const rx = /`(GET|POST|PATCH|DELETE) (\/clients|\/client_contacts)/;
    // 表の行は葉ごとの断片（08_取引先とクライアントの場所.d/）に移った（K-1112・PM の決め 2026-11-28）。読む人は断片を合わせた写しを読む
    const doc = read("08_api", "phase1", "合わせた", "08_取引先とクライアントの場所.md");
    expect(doc).not.toMatch(rx);
    expect(read("08_api", "phase1", "01_チケット.md")).not.toMatch(rx);
    expect(doc, "届いた依頼の節は残る").toContain("`GET /client_requests`");
    expect(doc, "クライアントの場所の節は残る").toContain("`GET /portal`");
  });

  it("K924-API-008 コードと検査の字：apps/api/src（routes を除く）・apps/web・apps/bridge に外した 12 の操作 ID が無く、row_rules.mjs から取引先の行の言葉（clients・client_contacts の manager）と CLIENT_MANAGER が外れる", () => {
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
    const rr = read("scripts", "ci", "row_rules.mjs");
    expect(rr).not.toMatch(/CLIENT_MANAGER|clients: |client_contacts: /);
  });

  it("K924-API-009 前からの試験は外した操作 ID を使わない：apps・packages の手で書いた試験と scripts/ci の python の試験に 12 の操作 ID が出てこない（生成の試験・この試験・消したことを確かめる側の試験を除く）", () => {
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

  it("K924-API-010 外す口の記録：08_api/retired-endpoints.json に 12 の口がそれぞれ（方法・道）1 行ずつ在り、根拠の決定が D-155.35・理由が空でない（契約の破壊的変更の検査 G11 が通る条件）", () => {
    const rows = (JSON.parse(read("08_api", "retired-endpoints.json")) as { retired: RetiredRow[] }).retired;
    for (const [op, method, path] of CLIENT_OPS) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} ${method} ${path} の行`).toBe(1);
      expect(hit[0]!.decision, `${op} の根拠`).toBe("D-155.35");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
  });

  it("K924-API-011 決定ログ §155：D-155.1〜55 が順に 1 行ずつ在り、取引先を持たない決め（D-155.35）と検収を作らない決め（D-155.44）の行が在る（この葉が最初に本線へ運ぶ）", () => {
    const log = read("01_hearing", "決定ログ_進行中.md");
    const sec = log.slice(log.indexOf("## 155."));
    const ids = [...sec.matchAll(/^\| D-155\.(\d+) \|/gm)].map((m) => Number(m[1]));
    expect(ids).toEqual(Array.from({ length: 55 }, (_, i) => i + 1));
    expect(sec).toContain("| D-155.35 |");
    expect(sec).toContain("| D-155.44 |");
    // 決める人の答えの記録（G60）：§155 の answer=<12 桁> が全部 decider-answers.jsonl に在る（切る段の木で pending から足した物を運ぶ）
    const answers = new Set([...sec.matchAll(/answer=([0-9a-f]{12})/g)].map((m) => m[1]!));
    expect(answers.size, "§155 の答えの種類（読めていない検査で緑にならないための確かめ）").toBeGreaterThanOrEqual(15);
    const recorded = new Set(
      read("01_hearing", "decider-answers.jsonl")
        .split("\n")
        .filter(Boolean)
        .map((l) => (JSON.parse(l) as { id: string }).id),
    );
    for (const a of answers) expect(recorded.has(a), `答え ${a} の記録`).toBe(true);
    const gate = spawnSync(
      "python3",
      [
        "scripts/ci/decision_source_gate.py",
        "--log",
        "01_hearing/決定ログ_進行中.md",
        "--answers",
        "01_hearing/decider-answers.jsonl",
        "--label",
        "高本さん",
        "--since",
        "D-130",
      ],
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(gate.status, `decision_source_gate（G60）：${gate.stdout}${gate.stderr}`).toBe(0);
  });

  it("K924-API-012 凍結の前の確かめ：外した後も、取引先の表（clients・client_contacts・client_groups）は DB に在る（消さない・凍結の印は K-883）", async () => {
    for (const t of ["clients", "client_contacts", "client_groups"]) {
      const r = await f.admin.query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${t}`]);
      expect(r.rows[0]!.ok, `${t} の表`).toBe(true);
    }
  });

  it("K924-API-013 外した後も、ほかの口は動く：依頼の一覧の道・チケットの一覧の道は 404 でない（外す作業が別の道を巻き込んでいない）", async () => {
    for (const path of ["/tickets", "/client_requests"]) {
      const r = await f.req("GET", path, { headers: writer.auth });
      expect(r.status, `${path}：${await r.clone().text()}`).not.toBe(404);
    }
  });
});
