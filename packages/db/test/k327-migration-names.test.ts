// K-327 の試験：migration の名前を時刻（YYYYMMDDHHMMSS_名前.sql）にして飛びを許す。今の 4 けたはそのまま読む。
//   行 ID は K327-DB-NNN（チケット 11_tickets/K-327.md の表の行と 1 対 1）。DB-006・007 は使い捨ての DB を作って消す
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_LAST, MIGRATIONS, checkMigrationOrder } from "../src/index.js";
import { migrate } from "../src/migrate.js";

const here = dirname(fileURLToPath(import.meta.url));
const four = (n: number) => String(n).padStart(4, "0");
const legacy = Array.from({ length: LEGACY_LAST }, (_, i) => `${four(i + 1)}_m${i + 1}.sql`);

describe("K-327 並びの検査", () => {
  it("K327-DB-001 4 けたの後に時刻が並べば通る", () => {
    expect(checkMigrationOrder([...legacy, "20261119010000_a.sql", "20261119020000_b.sql"])).toEqual({ ok: true });
  });

  it("K327-DB-002 時刻は間が飛んでも通る", () => {
    expect(checkMigrationOrder([...legacy, "20261119010000_a.sql", "20261201000000_b.sql"])).toEqual({ ok: true });
  });

  it("K327-DB-003 4 けたはもう増やせない", () => {
    expect(checkMigrationOrder([...legacy, `${four(LEGACY_LAST + 1)}_x.sql`])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("時刻の名前"),
    });
  });

  it("K327-DB-004 時刻の後の 4 けた・減る時刻・同じ名前は止める", () => {
    expect(
      checkMigrationOrder([...legacy.slice(0, -1), "20261119010000_a.sql", legacy[legacy.length - 1]!]),
    ).toMatchObject({
      ok: false,
    });
    expect(checkMigrationOrder([...legacy, "20261119020000_b.sql", "20261119010000_a.sql"])).toMatchObject({
      ok: false,
    });
    expect(checkMigrationOrder([...legacy, "20261119010000_a.sql", "20261119010000_a.sql"])).toMatchObject({
      ok: false,
      reason: expect.stringContaining("重複"),
    });
  });

  it("K327-DB-005 時刻の形でない名前は止める", () => {
    for (const bad of ["2026111901_a.sql", "20261319010000_a.sql", "20261119010000_A.sql"]) {
      expect(checkMigrationOrder([...legacy, bad]), bad).toMatchObject({
        ok: false,
        reason: expect.stringContaining("形"),
      });
    }
  });

  it("K327-DB-008 本物の一覧はフォルダの全部を名前の順に並べた物", () => {
    const files = readdirSync(join(here, "..", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect([...MIGRATIONS]).toEqual(files);
    expect(checkMigrationOrder(MIGRATIONS)).toEqual({ ok: true });
  });
});

const DB_URL = process.env["DATABASE_URL"]!;
const name = `kaname_k327_${Math.random().toString(36).slice(2, 8)}`;
const TMP_URL = DB_URL.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
const root = new pg.Pool({ connectionString: DB_URL, max: 1 });
let dir = "";
const A = "20261119010000_a.sql";
const B = "20261119020000_b.sql";
const BAD = "20261119030000_bad.sql";

async function rows(sql: string): Promise<string[]> {
  const c = new pg.Client({ connectionString: TMP_URL });
  await c.connect();
  try {
    return (await c.query<{ v: string }>(sql)).rows.map((r) => r.v);
  } finally {
    await c.end();
  }
}

describe("K-327 当てる順（使い捨ての DB）", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    root.on("error", () => undefined);
    await root.query(`create database ${name}`);
    dir = mkdtempSync(join(tmpdir(), "k327-"));
    mkdirSync(join(dir, "migrations"));
    writeFileSync(join(dir, "migrations", B), "create table k327_b (id int);");
  });
  afterAll(async () => {
    rmSync(dir, { recursive: true, force: true });
    await root.query(`drop database if exists ${name} with (force)`);
    await root.end();
  });

  it("K327-DB-006 後から入った時刻の早い物も当たる", async () => {
    const first = await migrate(TMP_URL, dir, {}, [B]);
    expect(first.applied).toEqual([B]);
    // 時刻の早い A は、B が当たった後に入った（一覧に無いファイルの検査は names で見るので、1 回目の前には置かない）
    writeFileSync(join(dir, "migrations", A), "create table k327_a (id int);");
    const second = await migrate(TMP_URL, dir, {}, [A, B]);
    expect(second.applied).toEqual([A]);
    expect(second.skipped).toEqual([B]);
    expect((await rows("select name as v from app.schema_migrations order by name")).sort()).toEqual([A, B]);
    expect(
      (
        await rows(
          "select table_name as v from information_schema.tables where table_name in ('k327_a','k327_b') order by 1",
        )
      ).sort(),
    ).toEqual(["k327_a", "k327_b"]);
  });

  it("K327-DB-007 手順 1（DB を書く）の失敗：失敗した migration は取引ごと戻り、名前も残らない", async () => {
    writeFileSync(join(dir, "migrations", BAD), "create tabel k327_bad (id int);");
    await expect(migrate(TMP_URL, dir, {}, [A, B, BAD])).rejects.toThrow();
    expect(await rows(`select name as v from app.schema_migrations where name = '${BAD}'`)).toEqual([]);
    rmSync(join(dir, "migrations", BAD));
  });
});
