// G-16：上限まで埋まった後に来た要求は待機列で待つ（入口を落とさない）。並ぶ時間と接続を作る時間は別の上限（L-023）
import { describe, expect, it } from "vitest";
import { createPool } from "../src/pool.js";

const DB_URL = process.env["DATABASE_URL"]!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("接続プールの待機列（G-16）", () => {
  it("作る上限（200ms）より長く並んでも断られない：1 本を 800ms 持っている間に来た要求は、空いたら通る", async () => {
    const pool = createPool({ databaseUrl: DB_URL, max: 1, connectTimeoutMs: 200, queueTimeoutMs: 5_000 });
    try {
      const held = await pool.connect();
      const t0 = Date.now();
      const waiting = pool.query("select 1 as n");
      await sleep(800);
      held.release();
      const r = await waiting;
      expect(r.rows[0].n).toBe(1);
      expect(Date.now() - t0).toBeGreaterThanOrEqual(700); // 本当に並んでいた
    } finally {
      await pool.end();
    }
  });

  it("並ぶ上限を超えたら、理由つきで断る（黙って固まらない）。断った後も枠は減らない", async () => {
    const pool = createPool({ databaseUrl: DB_URL, max: 1, queueTimeoutMs: 300 });
    try {
      const held = await pool.connect();
      await expect(pool.query("select 1")).rejects.toThrow(/順番待ち/);
      held.release();
      expect((await pool.query("select 2 as n")).rows[0].n).toBe(2);
    } finally {
      await pool.end();
    }
  });

  it("同時 50 要求でも全部返り、同時に持つ接続は上限（3）を超えない", async () => {
    const pool = createPool({ databaseUrl: DB_URL, max: 3, connectTimeoutMs: 200 });
    try {
      const rs = await Promise.all(
        Array.from({ length: 50 }, (_, i) => pool.query("select pg_sleep(0.02), $1::int as i", [i])),
      );
      expect(rs.map((r) => r.rows[0].i)).toEqual(Array.from({ length: 50 }, (_, i) => i));
      expect(pool.totalCount).toBeLessThanOrEqual(3);
    } finally {
      await pool.end();
    }
  });
});
