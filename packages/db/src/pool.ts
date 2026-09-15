// 接続プール（関門 C2 の中で 1 つだけ）。1 要求 1 接続以下・上限は待機列（G-16）。専用接続は台帳登録制（choke-point-exceptions.md）。
import pg from "pg";

export interface PoolOptions {
  databaseUrl: string;
  max?: number;
  statementTimeoutMs?: number;
}

export function createPool(o: PoolOptions): pg.Pool {
  const pool = new pg.Pool({
    connectionString: o.databaseUrl,
    max: o.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: o.statementTimeoutMs ?? 15_000, // 黙って固まらない（G-15）
  });
  pool.on("error", (e) => {
    console.error("[db pool] idle client error", e.message);
  });
  return pool;
}
