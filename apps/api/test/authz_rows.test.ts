// 権限の試験の残り（K-17・ZT4）：一覧・作る口の「行の絞り込み」を、本物の Postgres（RLS あり）で確かめる。
//   :id のある口は入口が行を読んで確かめる（K-15・authz.test.ts）。:id の無い一覧・作る口は、RLS が絞る。ここはその絞り込みを口ごとに見る。
//   ・作った口（入口が 501 で止めない口）：ほかの会社の行が返らない。本人の口（self）は、ほかの人の行も返らない。作った行は呼んだ人のもの
//   ・まだの口：it.todo に、その口を作るチケットの番号を付けて残す（口を作ると、この試験が自動で本物になる）
//   条件つきの本人確認（取り消せない承認・管理者として招く）も、口を作るチケットで本物になる
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { ENDPOINTS, type EndpointDef } from "@kaname/contracts";
import { TABLES } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { RULES } from "../../../scripts/ci/row_rules.mjs";
import { makeHarness, type Harness } from "./harness.js";
import { agentHooks } from "../src/hooks/agent.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// 本物の試験が別のファイルにある口（本物のログインの部品が要る など・07_qa/test-plan/ears-elsewhere.json）は、ここでは回さない
const ELSEWHERE = new Set(
  Object.keys(
    (
      JSON.parse(readFileSync(join(ROOT, "07_qa/test-plan/ears-elsewhere.json"), "utf8")) as {
        ops: Record<string, unknown>;
      }
    ).ops,
  ),
);
const DB_URL = process.env["DATABASE_URL"]!;
const ENTRANCE = new Set(["admin", "public", "client", "device"]);
const rest = ENDPOINTS.filter(
  (e) => !ENTRANCE.has(e.perm.word) && !e.perm.word.startsWith("ops:") && !e.perm.row && e.auth === "member",
);
const stepUps = ENDPOINTS.filter((e) => e.perm.stepUp && e.perm.stepUp !== "always");
// 作った口：hooks に振る舞いがある口か、共通の処理で動く表の素の読み書き（生成の試験 gen_ears_tests.mjs と同じ決め方）
const hookDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "hooks");
const hooked = new Set(
  readdirSync(hookDir)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) =>
      [...readFileSync(join(hookDir, f), "utf8").matchAll(/^\s{2,6}([a-z][A-Za-z]+): \{/gm)].map((x) => x[1]!),
    ),
);
const isBuilt = (e: EndpointDef) =>
  hooked.has(e.operationId) || (e.generic && (TABLES as readonly string[]).includes(e.table));
const builtRest = rest.filter((e) => isBuilt(e) && !ELSEWHERE.has(e.operationId));
const todoRest = rest.filter((e) => !isBuilt(e));

// 口 → 作るチケット（11_tickets の apis。無ければ画面を持つまとまり）
const T = (
  JSON.parse(readFileSync(join(ROOT, "11_tickets/tickets.json"), "utf8")) as {
    tickets: { id: string; apis?: string[]; screens?: string[]; split?: string }[];
  }
).tickets;
const ticketOf = (e: EndpointDef) =>
  T.find((t) => (t.apis ?? []).includes(e.operationId))?.id ??
  T.find((t) => (t.screens ?? []).some((s) => e.screens.includes(s)) && t.split === "これから")?.id ??
  "未割り当て";
const ownerCol = (word: string, table: string): string | null => {
  const sql = (RULES as Record<string, Record<string, string>>)[word]?.[table];
  const m = sql ? /^\(?(\w+) = app\.user_id\(\)/.exec(sql) : null;
  return m ? m[1]! : null;
};

let h: Harness;
let admin: pg.Pool;
let boss: TenantContext;
beforeAll(async () => {
  h = await makeHarness();
  Object.assign(h.hooks, agentHooks(h.pool)); // 本物のサーバーと同じ hooks
  admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
  boss = { tenantId: h.S.tenantA, userId: h.S.bossA, role: "member" };
});
afterAll(async () => {
  await admin.end();
  await h.close();
});

const listRows = async (e: EndpointDef) => {
  const r = await h.call(e, "boss", { query: { limit: "200" } });
  expect(r.status, `${e.operationId} が 200 を返す`).toBe(200);
  return ((await r.json()) as { data: { id: string; tenant_id?: string }[] }).data;
};

describe("権限の試験：一覧・作る口の行の絞り込み（K-17・本物の DB）", () => {
  it("一覧・作る口は全部、本物の試験か、作るチケットの付いた it.todo のどちらか", () => {
    expect(builtRest.length + todoRest.length + rest.filter((e) => ELSEWHERE.has(e.operationId)).length).toBe(
      rest.length,
    );
    expect(todoRest.filter((e) => ticketOf(e) === "未割り当て").map((e) => e.operationId)).toEqual([]);
  });
  for (const e of builtRest) {
    const name = `${e.method} ${e.path}：権限 ${e.perm.word} の外の人の行は返らない・作れない`;
    it(name, async () => {
      if (e.kind === "list") {
        // ほかの会社の行を 1 つ作り、返らないこと
        // 追記だけの表（記録）は新しく作れないので、種の行（ほかの会社の分）を使う
        const seeded = h.S.rows[e.table];
        const other = seeded && !seeded.insert ? seeded.other : await h.freshRow(e.table, h.S.tenantB);
        const rows = await listRows(e);
        expect(rows.map((x) => x.id)).not.toContain(other);
        for (const x of rows) if (x.tenant_id) expect(x.tenant_id).toBe(h.S.tenantA);
        // 本人の口：同じ会社のほかの人の行も返らない
        const col = ownerCol(e.perm.word, e.table);
        if (e.perm.word === "self" && col) {
          const mine = await h.freshRow(e.table, h.S.tenantA);
          await admin.query(`update "${e.table}" set "${col}" = $1 where id = $2`, [h.S.bossA, mine]);
          const theirs = await h.freshRow(e.table, h.S.tenantA);
          await admin.query(`update "${e.table}" set "${col}" = $1 where id = $2`, [h.S.staffA, theirs]);
          const ids = (await listRows(e)).map((x) => x.id);
          expect(ids, "自分の行は返る").toContain(mine);
          expect(ids, "ほかの人の行は返らない").not.toContain(theirs);
        }
      } else if (e.kind === "create") {
        // 作った行は呼んだ人のもの（本人の口は持ち主の列が呼んだ人）。ほかの人を持ち主にして作れない
        const col = ownerCol(e.perm.word, e.table);
        const body = { ...h.bodyFor(e), ...(col ? { [col]: h.S.staffA } : {}) };
        const r = await h.call(e, "boss", { body });
        if (r.status >= 400) {
          expect([403, 422]).toContain(r.status); // 持ち主の列を受け付けない形でもよい（止まれば守れている）
          return;
        }
        const id = ((await r.json()) as { data: { id: string } }).data.id;
        const row = (await admin.query(`select * from "${e.table}" where id = $1`, [id])).rows[0] as Record<
          string,
          unknown
        >;
        expect(row["tenant_id"]).toBe(h.S.tenantA);
        if (col) expect(row[col], "ほかの人を持ち主にして作れない").toBe(h.S.bossA);
        if (col)
          expect(await h.repo.rowAllowed(boss, e.table, id, `${col} = app.user_id()`), "呼んだ人の行").toBe("ok");
      }
    });
  }
});

describe("まだの口（作るチケットで本物になる）", () => {
  for (const e of todoRest) it.todo(`${e.method} ${e.path}：行の絞り込み（${e.perm.word}）→ ${ticketOf(e)} で作る`);
  for (const e of stepUps)
    it.todo(
      `${e.method} ${e.path}：条件（${e.perm.stepUp}）のとき直前 15 分以内の本人確認が無ければ 403 → ${ticketOf(e)} で作る`,
    );
});
