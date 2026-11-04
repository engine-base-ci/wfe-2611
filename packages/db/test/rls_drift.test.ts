// DB の行の守りは仕様（07_functional/entities.json の access_control_policies）と同じで、余分も不足も無い（KN-44）。
//   守りは「どれかが通れば通る」ので、作り方を変えた表に古い守りが残ると、黙って穴になる（0014 の守りが運営の表に残っていた）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";

const DB_URL = process.env["DATABASE_URL"]!;
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 1 });
const E = JSON.parse(readFileSync(join(here, "..", "..", "..", "07_functional", "entities.json"), "utf8")) as {
  entities: { table_name: string; access_control_policies: { name: string; role: string; operation: string }[] }[];
};
const want = new Map<string, Set<string>>();
for (const e of E.entities) {
  const s = new Set<string>();
  for (const p of e.access_control_policies) {
    if (p.role === "system") continue;
    const ops = p.operation.split(",").map((o) => o.trim());
    for (const o of ops) s.add(ops.length > 1 ? `${p.name}_${o}` : p.name);
  }
  want.set(e.table_name, s);
}
let have = new Map<string, Set<string>>();
beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  have = new Map();
  for (const r of (
    await admin.query<{ t: string; n: string }>(
      "select tablename as t, policyname as n from pg_policies where schemaname = 'public'",
    )
  ).rows)
    have.set(r.t, (have.get(r.t) ?? new Set()).add(r.n));
});
afterAll(async () => {
  await admin.end();
});

describe("行の守りのずれ", () => {
  it("DB にあって仕様に無い守りが無い（古い守りが残っていない）", () => {
    const extra = [...have].flatMap(([t, s]) => [...s].filter((n) => !want.get(t)?.has(n)).map((n) => `${t}.${n}`));
    expect(extra).toEqual([]);
  });
  it("仕様にあって DB に無い守りが無い（migration 済みの表）", () => {
    const missing = [...want]
      .filter(([t]) => have.has(t))
      .flatMap(([t, s]) => [...s].filter((n) => !have.get(t)!.has(n)).map((n) => `${t}.${n}`));
    expect(missing).toEqual([]);
  });
});
