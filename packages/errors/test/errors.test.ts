import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { CATALOG, KanameError, isKnown, kanameError, markNextActionTaken, recordErrorEvent } from "../src/index.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
beforeAll(async () => {
  await migrate(DB_URL, dbPkg);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = createPool({ databaseUrl: APP_URL, max: 3 });
  repo = await createRepository(app);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
const staff = () => ({ tenantId: S.tenantA, userId: S.staffA, role: "member" as const });

describe("エラー一覧の実行時", () => {
  it("正本の文言と次の一手をそのまま返す。class → HTTP の状態", () => {
    const e = kanameError("E-AUTH-001", { remaining: 4 });
    expect(e.message).toBe(CATALOG["E-AUTH-001"]!.message);
    expect(e.toJSON().action).toBe(CATALOG["E-AUTH-001"]!.action);
    expect(e.status).toBe(401);
    expect(e.toJSON().support_code).toBeTruthy();
    expect(Object.keys(CATALOG).length).toBeGreaterThanOrEqual(90);
  });
  it("正本に無いエラーは作れない（出せないエラーはデッドコード）", () => {
    expect(() => new KanameError("E-NOPE-999")).toThrow(/正本に無い/);
    expect(isKnown("E-NOPE-999")).toBe(false);
  });
  it("出た記録は本人が書け、次の一手を押したことも残る。他社からは見えない", async () => {
    const id = await recordErrorEvent(repo, staff(), "E-AUTH-001", "login", { attempts: 1 });
    expect(id).toBeTruthy();
    expect(await markNextActionTaken(repo, staff(), id!)).toBe(true);
    const rows = await repo.table("error_events").list(staff(), { where: { error_code: "E-AUTH-001" } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!["next_action_taken_at"]).not.toBeNull();
    const other = await repo.table("error_events").list({ tenantId: S.tenantB, userId: S.tenantB, role: "member" });
    expect(other).toHaveLength(0);
    expect(await recordErrorEvent(repo, staff(), "E-NOPE-999", null)).toBeNull();
  });
});
