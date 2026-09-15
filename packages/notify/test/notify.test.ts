import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { NotifyGateway, type Recipient, type Transport } from "../src/index.js";

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
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const people = (): Recipient[] => [
  { memberId: S.bossA, kind: "human", address: "boss@example.test" },
  { memberId: S.staffA, kind: "human", address: null },
  { memberId: "00000000-0000-4000-8000-0000000000aa", kind: "ai_employee", address: null },
];
function transport(failTimes = 0): Transport & { sent: string[] } {
  let fails = failTimes;
  const t = {
    sent: [] as string[],
    async send(ch: string, addr: string | null, m: string) {
      if (fails > 0) {
        fails--;
        throw new Error("smtp 4xx");
      }
      t.sent.push(`${ch}:${ch === "email" ? addr : m}`);
    },
  };
  return t as Transport & { sent: string[] };
}

describe("関門 C6（notify）", () => {
  it("宛先解決：人間は inapp＋email（住所が無ければ email は skip）、AI社員は inapp だけ。証跡が残る", async () => {
    const tr = transport();
    const g = new NotifyGateway(repo, tr, { resolve: async () => people() });
    const r = await g.notify({ kind: "approval.requested", payload: { id: 1 } }, { role: "all" }, boss());
    expect(tr.sent.sort()).toEqual(
      [
        "email:boss@example.test",
        `inapp:${S.bossA}`,
        `inapp:${S.staffA}`,
        "inapp:00000000-0000-4000-8000-0000000000aa",
      ].sort(),
    );
    expect(r.deliveries.find((d) => d.memberId === S.staffA && d.channel === "email")?.status).toBe("skipped");
    expect(
      (await repo.table("audit_events").list(boss(), { where: { action: "notify" } })).length,
    ).toBeGreaterThanOrEqual(1);
  });
  it("購読設定で受け取らない経路は送らない", async () => {
    const tr = transport();
    const g = new NotifyGateway(repo, tr, {
      resolve: async () => [people()[0]!],
      prefers: async (_m, _k, ch) => ch !== "email",
    });
    await g.notify({ kind: "goal.overdue", payload: {} }, { role: "owner" }, boss());
    expect(tr.sent).toEqual([`inapp:${S.bossA}`]);
  });
  it("重複抑止：同じ出来事は二度送らない（dedupeKey）", async () => {
    const tr = transport();
    const g = new NotifyGateway(repo, tr, { resolve: async () => [people()[0]!] });
    await g.notify({ kind: "x", payload: { a: 1 }, dedupeKey: "ev-1" }, { role: "owner" }, boss());
    const r2 = await g.notify({ kind: "x", payload: { a: 1 }, dedupeKey: "ev-1" }, { role: "owner" }, boss());
    expect(tr.sent).toHaveLength(2);
    expect(r2.deliveries.every((d) => d.status === "skipped" && d.reason === "重複")).toBe(true);
  });
  it("失敗したら再送し、それでも駄目なら failed で理由と「書いたものは残っています」", async () => {
    const tr = transport(5);
    const g = new NotifyGateway(
      repo,
      tr,
      { resolve: async () => [people()[0]!] },
      { maxAttempts: 3, backoffMs: 1, channelsOf: () => ["email"] },
    );
    const r = await g.notify({ kind: "mail.followup", payload: {} }, { role: "owner" }, boss());
    expect(r.deliveries[0]?.status).toBe("failed");
    expect(r.deliveries[0]?.attempts).toBe(3);
    expect(r.deliveries[0]?.reason).toMatch(/残っています/);
    const ok = new NotifyGateway(
      repo,
      transport(1),
      { resolve: async () => [people()[0]!] },
      { maxAttempts: 3, backoffMs: 1, channelsOf: () => ["email"] },
    );
    const r2 = await ok.notify({ kind: "mail.followup", payload: {} }, { role: "owner" }, boss());
    expect(r2.deliveries[0]?.status).toBe("sent");
    expect(r2.deliveries[0]?.attempts).toBe(2);
  });
  it("文脈が無ければ投げる", async () => {
    await expect(
      new NotifyGateway(repo, transport(), { resolve: async () => [] }).notify(
        { kind: "x", payload: {} },
        { role: "all" },
        { tenantId: null, userId: null, role: "anonymous" },
      ),
    ).rejects.toThrow(/文脈/);
  });
});
