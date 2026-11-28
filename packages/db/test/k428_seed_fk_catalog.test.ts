// K-428「場合表の種の外部キーの問い合わせを、目録（pg_catalog）で引いて速くする」の試験（本物の DB・migration を全部当てた後）。
//   種 seedAccessMatrix（seed_generic.ts）は、表ごとの外部キーを information_schema の 3 つのビューの結合で引いている。
//   表が 138 あると約 20 秒かかり、DB の試験の準備（beforeAll・上限 33 秒）が CI の混む時に時間切れで赤になった（K-402・K-404）。
//   直し方：同じ行の集合を pg_constraint・pg_class・pg_attribute で引き直す。列の別名（table・col・refTable・refCol）は読む側が使うので変えない。
//   時間そのものは台で揺れるので比べない。使う系（information_schema を引かない・1 回だけ引く）と、結果が前と同じであることで見る。
//   行 ID（K428-DB-…）は 11_tickets/K-428.md の表と 1 対 1。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DB_URL = process.env["DATABASE_URL"]!;
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });

type FkRow = { table: string; col: string; refTable: string; refCol: string };
const key = (r: FkRow) => `${r.table}.${r.col}>${r.refTable}.${r.refCol}`;
const sorted = (rows: FkRow[]) => rows.map(key).sort();

/** 今までの問い合わせ（information_schema の結合）。結果の比べの基準として、ここに写しておく */
const OLD_FK_SQL =
  "select tc.table_name as table, kcu.column_name as col, ccu.table_name as \"refTable\", ccu.column_name as \"refCol\" from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'";

/** 種を流している間に、種が DB に出した文を全部記録する（種の中身は変えず、文を覗くだけ） */
const seen: string[] = []; // 1 回目の種で出した文だけ（2 回目の前に区切る）
let seeded: Awaited<ReturnType<typeof seedAccessMatrix>>;
let firstCount = 0;

/** 外部キーを引く文＝列の別名 "refTable" を持つ文（種が読む形） */
const fkQueries = () => seen.slice(0, firstCount).filter((s) => s.includes('"refTable"'));
const fkSql = () => {
  const qs = fkQueries();
  expect(qs.length, "外部キーを引く文が種の中で見つからない（列の別名 refTable が無い）").toBeGreaterThan(0);
  return qs[0]!;
};

/** 2 列の外部キーを持つ表の組を 1 つの取引で作り、中で fn を流してから必ず戻す（本物の表に残さない） */
async function inRolledBackTx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await admin.connect();
  try {
    await c.query("begin");
    return await fn(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

/** 2 列の外部キーを持つ表のある表（今の DB に在る物）。比べるときは両側から外す（2 列は今までの結果が組にならず、行が増える） */
async function multiColumnFkTables(): Promise<Set<string>> {
  const r = await admin.query<{ t: string }>(
    "select r.relname::text as t from pg_constraint c join pg_class r on r.oid = c.conrelid where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) > 1",
  );
  return new Set(r.rows.map((x) => x.t));
}

beforeAll(async () => {
  await migrate(DB_URL, join(PKG));
  const c = await admin.connect();
  try {
    const spy = new Proxy(c, {
      get(target, prop, receiver) {
        if (prop === "query")
          return (sql: unknown, ...rest: unknown[]) => {
            seen.push(typeof sql === "string" ? sql : String((sql as { text?: string }).text ?? ""));
            return (target.query as (...a: unknown[]) => unknown)(sql, ...rest);
          };
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    seeded = await seedAccessMatrix(spy);
    firstCount = seen.length;
  } finally {
    c.release();
  }
});
afterAll(async () => {
  await admin.end();
});

describe("場合表の種の外部キーの問い合わせ", () => {
  it("K428-DB-001 結果が前と同じ：種が使う外部キーの問い合わせの行の集合が、前の問い合わせ（information_schema）と同じで、空でない", async () => {
    const skip = await multiColumnFkTables();
    const now = (await admin.query<FkRow>(fkSql())).rows.filter((r) => !skip.has(r.table));
    const before = (await admin.query<FkRow>(OLD_FK_SQL)).rows.filter((r) => !skip.has(r.table));
    // 何も見ていないのに緑にならない：空でなく、DB の目録の外部キーの本数（1 列の物）と同じ数
    const n = (
      await admin.query<{ n: string }>(
        "select count(*)::text as n from pg_constraint c join pg_class r on r.oid = c.conrelid where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1 and r.relname <> all($1::text[])",
        [[...skip]],
      )
    ).rows[0]!.n;
    expect(before.length).toBeGreaterThan(100);
    expect(now.length).toBe(Number(n));
    expect(sorted(now)).toEqual(sorted(before));
  });

  it("K428-DB-002 速い系の表で引く：種は外部キーを 1 回だけ（表ごとにではなく）、目録（pg_constraint）から引く。遅い 3 つのビューの結合（constraint_column_usage）を引かない", () => {
    const sql = fkSql();
    expect(fkQueries().length).toBe(1);
    expect(sql).toContain("pg_constraint");
    expect(sql).not.toContain("information_schema");
    expect(sql).not.toContain("constraint_column_usage");
    // 種の中のどの文も、遅い結合（constraint_column_usage）を引かない（外部キーの探し方が別の所に残っていない）
    expect(seen.slice(0, firstCount).filter((s) => s.includes("constraint_column_usage"))).toEqual([]);
    // 外部キーを information_schema から引く文が残っていない（主キーなど別の引きは今のまま）
    expect(
      seen.slice(0, firstCount).filter((s) => s.includes("information_schema") && s.includes("FOREIGN KEY")),
    ).toEqual([]);
    // 文は引数なしで流せる形のまま（読む側が引数を渡さない）
    expect(sql).not.toMatch(/\$1/);
  });

  it("K428-DB-003 2 列の外部キー：列の組ごとに 1 行（元の列と先の列が組になる）。表を足しても 1 列の外部キーは 1 行のまま・戻すと消える", async () => {
    const sql = fkSql();
    const got = await inRolledBackTx(async (c) => {
      await c.query("create table public.k428_parent (a int, b int, primary key (a, b))");
      await c.query("create table public.k428_one (id int primary key)");
      await c.query(
        "create table public.k428_child (a int, b int, one_id int references public.k428_one (id), foreign key (a, b) references public.k428_parent (a, b))",
      );
      return (await c.query<FkRow>(sql)).rows.filter((r) => r.table === "k428_child");
    });
    expect(sorted(got)).toEqual(
      ["k428_child.a>k428_parent.a", "k428_child.b>k428_parent.b", "k428_child.one_id>k428_one.id"].sort(),
    );
    // 取引を戻した後は、足した表の行が無い
    const after = (await admin.query<FkRow>(sql)).rows.filter((r) => r.table.startsWith("k428_"));
    expect(after).toEqual([]);
  });

  it("K428-DB-004 接続の設定で変わらない：探す道（search_path）を空にしても、表の名前は修飾も引用符も付かず、行の集合は同じ", async () => {
    const sql = fkSql();
    const plain = (await admin.query<FkRow>(sql)).rows;
    const narrowed = await inRolledBackTx(async (c) => {
      await c.query("set local search_path = pg_catalog");
      return (await c.query<FkRow>(sql)).rows;
    });
    expect(sorted(narrowed)).toEqual(sorted(plain));
    const bad = plain.filter((r) => ![r.table, r.refTable].every((t) => /^[a-z0-9_]+$/.test(t)));
    expect(bad).toEqual([]);
  });

  it("K428-DB-007 先の表が別のスキーマ：public の表から別のスキーマの表への外部キーは、前の文と同じに 0 行（種は public の表どうしの外部キーだけを見る）", async () => {
    const sql = fkSql();
    const got = await inRolledBackTx(async (c) => {
      await c.query("create schema k428_other");
      await c.query("create table k428_other.k428_base (id int primary key)");
      await c.query("create table public.k428_x (b int references k428_other.k428_base (id))");
      const before = (await c.query<FkRow>(`${OLD_FK_SQL} and tc.table_name = 'k428_x'`)).rows;
      expect(before).toEqual([]); // 前の文は別のスキーマの先を返さない（この行の基準）
      return (await c.query<FkRow>(sql)).rows.filter((r) => r.table === "k428_x");
    });
    expect(got).toEqual([]);
  });

  it("K428-DB-005 種の出来は前と同じ：種を 2 回流しても落ちず、表ごとの種（rows）の表の集合が同じで、外部キーを持つ表にも種がある（2 回目はこの試験の中で流す）", async () => {
    const first = Object.keys(seeded.rows).sort();
    const c = await admin.connect();
    let again: Awaited<ReturnType<typeof seedAccessMatrix>>;
    try {
      again = await seedAccessMatrix(c);
    } finally {
      c.release();
    }
    const second = Object.keys(again.rows).sort();
    expect(first.length).toBeGreaterThan(100);
    expect(second).toEqual(first);
    const fk = (await admin.query<FkRow>(fkSql())).rows;
    const children = [...new Set(fk.map((r) => r.table))];
    const noSeed = children.filter((t) => !first.includes(t));
    // 外部キーを持つ表のうち種が無い物は、前から種を持たない表（explicit の外・先に消す物など）。数が前と同じ範囲に収まる
    expect(noSeed.length).toBeLessThan(children.length / 2);
    expect(first).toContain("tickets");
    expect(first).toContain("members");
  }, 60_000);
});

// K428-DB-006 は人が確かめる（下の judge-skip）
