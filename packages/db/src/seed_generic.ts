// access-matrix の種を information_schema から機械的に作る（表を足すたびに seeds.ts へ手で足さない＝漏れない）。
// 規則：tenant_id → その会社／scope_id → 会社の根の層／members への FK → その会社の代表／他表への FK → その表の同じ会社の種／マスタ（key）→ 'seed'／NOT NULL は型の既定値
import type pg from "pg";
import type { Seeded } from "./matrix.js";

export interface GenericBase {
  tenantA: string;
  tenantB: string;
  bossA: string;
  bossB: string;
  scopeRootA: string;
  scopeRootB: string;
  opsTenant: string;
  opsMember: string;
  opsScope: string;
}
type Col = { table: string; col: string; type: string; udt: string; nullable: boolean; def: string | null };
type Fk = { table: string; col: string; refTable: string; refCol: string };
type SeedRow = Seeded["rows"][string];
const rnd = () => Math.random().toString(36).slice(2, 8);

export async function seedGenericRows(
  c: pg.PoolClient,
  b: GenericBase,
  explicit: Set<string>,
): Promise<Record<string, SeedRow>> {
  const cols = (
    await c.query<Col>(
      "select table_name as table, column_name as col, data_type as type, udt_name as udt, (is_nullable = 'YES') as nullable, column_default as def from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
    )
  ).rows;
  const fks = (
    await c.query<Fk>(
      "select tc.table_name as table, kcu.column_name as col, ccu.table_name as \"refTable\", ccu.column_name as \"refCol\" from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'",
    )
  ).rows;
  const pks = new Map<string, string>();
  for (const r of (
    await c.query<{ t: string; c: string }>(
      "select tc.table_name as t, kcu.column_name as c from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'",
    )
  ).rows)
    pks.set(r.t, r.c);
  // 値の候補が CHECK で決まっている列（kind in ('init', …) 等）は、候補の先頭を種にする（"seed" では通らない）
  const allowed = new Map<string, string>(); // `${table}.${col}` → 最初の候補
  for (const r of (
    await c.query<{ t: string; def: string }>(
      "select conrelid::regclass::text as t, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace",
    )
  ).rows) {
    const m = /\(?(\w+) = ANY \(ARRAY\['([^']*)'/.exec(r.def);
    if (m) allowed.set(`${r.t}.${m[1]}`, m[2]!);
  }
  const tables = [...new Set(cols.map((x) => x.table))].filter((t) => !explicit.has(t));
  const colsOf = (t: string) => cols.filter((x) => x.table === t);
  const fkOf = (t: string, col: string) => fks.find((f) => f.table === t && f.col === col);
  const hasTenant = (t: string) => colsOf(t).some((x) => x.col === "tenant_id");
  const isOps = (t: string) => colsOf(t).some((x) => x.col === "tenant_id" && (x.def ?? "").includes("ops_tenant_id"));
  const isMaster = (t: string) => pks.get(t) === "key";
  // 依存順（FK の先を先に。自己参照と対象外の表は無視）
  const order: string[] = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter(
      (t) => !fks.some((f) => f.table === t && f.refTable !== t && pending.has(f.refTable)),
    );
    // 行き詰まったら（輪がある）、輪の上にある表から 1 つ崩す。名前順の先頭を選ぶと、輪の外で順番待ちの表
    // （例：bridge_job_events は bridge_jobs の後）を先に出してしまい、親の種が無く FK が null になる
    const deps = (t: string) => fks.filter((f) => f.table === t && f.refTable !== t && pending.has(f.refTable)).map((f) => f.refTable);
    const onCycle = (t: string): boolean => {
      const seen = new Set<string>();
      const stack = deps(t);
      while (stack.length) {
        const u = stack.pop()!;
        if (u === t) return true;
        if (seen.has(u)) continue;
        seen.add(u);
        stack.push(...deps(u));
      }
      return false;
    };
    for (const t of ready.length ? ready : [[...pending].find(onCycle) ?? [...pending][0]!]) {
      order.push(t);
      pending.delete(t);
    }
  }
  // 種の行（表 × 会社）
  const seeded = new Map<string, string>(); // `${table}:${tenant}` → pk
  const masterKey = new Map<string, string>();
  const out: Record<string, SeedRow> = {};
  const tenantOf = (t: string, which: "A" | "B" | "ops") =>
    which === "A" ? b.tenantA : which === "B" ? b.tenantB : b.opsTenant;
  const bossOf = (which: "A" | "B" | "ops") => (which === "A" ? b.bossA : which === "B" ? b.bossB : b.opsMember);
  const scopeOf = (which: "A" | "B" | "ops") =>
    which === "A" ? b.scopeRootA : which === "B" ? b.scopeRootB : b.opsScope;
  const whichOf = (tenant: string): "A" | "B" | "ops" =>
    tenant === b.tenantA ? "A" : tenant === b.tenantB ? "B" : "ops";
  const defaultOf = (x: Col): unknown => {
    if (x.type === "boolean") return false;
    if (["smallint", "integer", "bigint", "numeric", "real", "double precision"].includes(x.type)) return 1;
    if (x.type === "date") return new Date().toISOString().slice(0, 10);
    if (x.type.startsWith("timestamp")) return new Date();
    if (x.type === "jsonb" || x.type === "json") return "{}";
    if (x.type === "ARRAY") return "{}";
    if (x.udt === "uuid") return null;
    return "seed";
  };
  const build = (t: string, which: "A" | "B" | "ops", fresh: boolean): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    const tenant = tenantOf(t, which);
    for (const x of colsOf(t)) {
      if (x.col === pks.get(t) && x.col === "id") continue;
      // 自然な主キー（setup_steps の n 等）：新しく足す行は既存と重ならない値にする
      if (x.col === pks.get(t) && fresh) {
        row[x.col] = ["smallint", "integer", "bigint", "numeric"].includes(x.type) ? 1000 + Math.floor(Math.random() * 30000) : `k9-${rnd()}`;
        continue;
      }
      if (["created_at", "updated_at", "deleted_at", "created_by", "updated_by"].includes(x.col)) continue;
      const fk = fkOf(t, x.col);
      if (x.col === "tenant_id") row[x.col] = tenant;
      else if (x.col === "scope_id" && fk) row[x.col] = scopeOf(which);
      else if (fk && fk.refTable === "members") row[x.col] = bossOf(which);
      else if (fk && fk.refTable === "tenants") row[x.col] = tenant;
      else if (fk && fk.refTable === "scopes") row[x.col] = scopeOf(which);
      else if (fk && fk.refTable === t)
        row[x.col] = null; // 自己参照は根
      else if (fk && isMaster(fk.refTable)) row[x.col] = masterKey.get(fk.refTable) ?? "seed";
      else if (fk)
        row[x.col] =
          seeded.get(`${fk.refTable}:${tenant}`) ??
          seeded.get(`${fk.refTable}:${b.opsTenant}`) ??
          seeded.get(`${fk.refTable}:${b.tenantA}`) ??
          null;
      else if (x.col === "key") row[x.col] = fresh ? `k9-${rnd()}` : "seed";
      else if (x.col === "version") row[x.col] = fresh ? Math.floor(Math.random() * 1e6) + 2 : 1;
      else if (!x.nullable && x.def === null) row[x.col] = allowed.get(`${t}.${x.col}`) ?? defaultOf(x);
    }
    return row;
  };
  const insertRow = async (t: string, row: Record<string, unknown>): Promise<string> => {
    const keys = Object.keys(row).filter((k) => row[k] !== null && row[k] !== undefined);
    const pk = pks.get(t) ?? "id";
    const r = await c.query<Record<string, string>>(
      `insert into "${t}" (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning "${pk}"`,
      keys.map((k) => row[k]),
    );
    return r.rows[0]![pk]!;
  };
  for (const t of order) {
    if (isMaster(t)) {
      const existingKey = (await c.query<{ key: string }>(`select key from "${t}" order by key limit 1`)).rows[0]?.key;
      if (!existingKey) await c.query(`insert into "${t}" (key, label) values ('seed', 'seed') on conflict do nothing`);
      const k = existingKey ?? "seed";
      masterKey.set(t, k);
      out[t] = { visible: k, hiddenLayer: null, other: k, insert: () => ({ key: `k9-${rnd()}`, label: "x" }) };
      continue;
    }
    if (!hasTenant(t)) {
      // 自然な主キー（id 以外）で migration が既に中身を入れている表（例：setup_steps の n）は、その 1 行を種にする
      const pkCol = pks.get(t) ?? "id";
      if (pkCol !== "id") {
        const have = (await c.query<Record<string, string>>(`select "${pkCol}" from "${t}" order by 1 limit 1`)).rows[0]?.[pkCol];
        if (have !== undefined) {
          const id = String(have);
          seeded.set(`${t}:${b.opsTenant}`, id);
          seeded.set(`${t}:${b.tenantA}`, id);
          out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
          continue;
        }
      }
      // 版の表（親の FK だけ）。親の種（運営 → 会社 a の順）に繋ぐ
      const id = await insertRow(t, build(t, "ops", false));
      seeded.set(`${t}:${b.opsTenant}`, id);
      seeded.set(`${t}:${b.tenantA}`, id);
      out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
      continue;
    }
    if (isOps(t)) {
      const id = await insertRow(t, build(t, "ops", false));
      seeded.set(`${t}:${b.opsTenant}`, id);
      out[t] = { visible: id, hiddenLayer: null, other: id, insert: () => build(t, "ops", true) };
      continue;
    }
    const idA = await insertRow(t, build(t, "A", false));
    const idB = await insertRow(t, build(t, "B", false));
    seeded.set(`${t}:${b.tenantA}`, idA);
    seeded.set(`${t}:${b.tenantB}`, idB);
    out[t] = { visible: idA, hiddenLayer: null, other: idB, insert: (tenant) => build(t, whichOf(tenant), true) };
  }
  return out;
}
