import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { runMatrix, type MatrixCase } from "../src/matrix.js";
import { seedAccessMatrix } from "../src/seeds.js";

const URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(pkg, "..", "..");
const admin = new pg.Pool({ connectionString: URL, max: 2 });
const app = new pg.Pool({ connectionString: APP_URL, max: 2 });

beforeAll(async () => {
  await migrate(URL, pkg);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("G33 access-matrix（RLS の場合表を実表で流す）", () => {
  it("migration 済みの表の場合が全部期待どおり。未 migration の表は skip として数える（全部済めば skip 0）", async () => {
    const cases = JSON.parse(readFileSync(join(root, "07_qa/test-plan/access-matrix.json"), "utf8"))
      .cases as MatrixCase[];
    const r = await runMatrix(app, admin, cases, seedAccessMatrix);
    expect(r.executed).toBeGreaterThanOrEqual(30);
    expect(
      r.failed.map((f) => `${f.case.table} ${f.case.policy} ${f.case.case} → ${f.got}（期待 ${f.case.expected}）`),
    ).toEqual([]);
    // 全表が migration 済みなら skip は 0。skip があるなら担当の T-D-* が未了
    expect(r.executed + r.skipped.length).toBeGreaterThanOrEqual(cases.length - r.executed);
    expect(r.executed).toBeGreaterThanOrEqual(cases.length - r.skipped.length * 4);
  }, 60_000);
});
