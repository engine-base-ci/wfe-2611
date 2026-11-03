// KN-47 場合表が穴を捕まえる：使い捨ての DB で行の守りをわざと壊し、場合表（G33）が赤になることを確かめる。
//   壊すのは ①チケットを誰でも読める ②チケットの本文を同じ会社なら読める（子が親に従わない）③取引先の人の柵を外す の 3 つ
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { runMatrix, type MatrixCase } from "../src/matrix.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const here = dirname(fileURLToPath(import.meta.url));
const name = `kaname_mut_${Math.random().toString(36).slice(2, 8)}`;
const MUT_URL = DB_URL.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
const root = new pg.Pool({ connectionString: DB_URL, max: 1 });
let admin: pg.Pool, app: pg.Pool;
const all = JSON.parse(readFileSync(join(here, "..", "..", "..", "07_qa", "test-plan", "access-matrix.json"), "utf8"))
  .cases as MatrixCase[];
const casesOf = (...tables: string[]) => all.filter((c) => tables.includes(c.table));

beforeAll(async () => {
  await root.query(`create database ${name}`);
  await migrate(MUT_URL, join(here, ".."));
  admin = new pg.Pool({ connectionString: MUT_URL, max: 2 });
  app = new pg.Pool({ connectionString: MUT_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"), max: 2 });
  // 使い捨ての DB を消すとき、残った接続が「管理者が切った」（57P01）を受ける。受け口が無いと試験全体が落ちる（CI でたまに落ちていた・2026-11-03）
  for (const p of [admin, app, root]) p.on("error", () => undefined);
}, 300_000);
afterAll(async () => {
  await app?.end();
  await admin?.end();
  // 接続が全部閉じたのを確かめてから消す（閉じる前に消すと、動いている文が切られる）
  for (let i = 0; i < 50; i++) {
    const n = (await root.query<{ n: string }>("select count(*) as n from pg_stat_activity where datname = $1", [name]))
      .rows[0]!.n;
    if (n === "0") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await root.query(`drop database if exists ${name} with (force)`);
  await root.end();
}, 60_000);

// 場合表を回すのは種を入れ直すので遅い（CI では 5 秒の既定を超えることがある）
describe("場合表は、わざと壊した守りで赤になる", { timeout: 120_000 }, () => {
  it("壊す前は緑", async () => {
    const r = await runMatrix(app, admin, casesOf("tickets", "ticket_sections", "clients"), seedAccessMatrix);
    expect(r.failed.map((f) => `${f.case.policy} ${f.case.case} ${f.got}`)).toEqual([]);
  });
  it("①チケットを誰でも読めるようにすると赤", async () => {
    await admin.query("create policy broken_open on tickets for select using (true)");
    const r = await runMatrix(app, admin, casesOf("tickets"), seedAccessMatrix);
    await admin.query("drop policy broken_open on tickets");
    expect(r.failed.length).toBeGreaterThan(0);
  });
  it("②チケットの本文を「同じ会社なら読める」に戻すと赤（子が親に従わない）", async () => {
    await admin.query(
      "create policy broken_tenant on ticket_sections for select using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)",
    );
    const r = await runMatrix(app, admin, casesOf("ticket_sections"), seedAccessMatrix);
    await admin.query("drop policy broken_tenant on ticket_sections");
    expect(r.failed.length).toBeGreaterThan(0);
  });
  it("③取引先の人の柵を外すと赤（会社の人が client を名乗って取引先の守りを通る）", async () => {
    // 先方の人として登録されていなくても、その会社の取引先の人扱いにする（柵と「自分の取引先」を両方ゆるめる）
    await admin.query(
      "create or replace function app.client_ok() returns boolean language sql stable as $$ select coalesce(current_setting('app.role', true), '') = 'client' $$",
    );
    await admin.query(
      "create or replace function app.my_client() returns uuid language sql stable security definer set search_path = public, app as $$ select id from clients where tenant_id = app.tenant_id() order by created_at limit 1 $$",
    );
    const r = await runMatrix(app, admin, casesOf("clients", "client_contacts", "client_requests"), seedAccessMatrix);
    expect(r.failed.length).toBeGreaterThan(0);
  });
});
