import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { BillingGateway } from "../src/index.js";

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

describe("関門 C7（billing）", () => {
  it("同じ冪等性キーの 2 回目は実行せず最初の結果を返す（二重課金なし）。証跡が残る", async () => {
    let calls = 0;
    const g = new BillingGateway(repo, {
      execute: async () => {
        calls++;
        return { invoice: "inv-1" };
      },
    });
    const a = await g.run("issueInvoice", { idempotencyKey: "k1", amount: 30000 }, boss());
    const b = await g.run("issueInvoice", { idempotencyKey: "k1", amount: 30000 }, boss());
    expect(a.status).toBe("done");
    expect(b.status).toBe("done");
    if (b.status === "done") expect(b.replayed).toBe(true);
    expect(calls).toBe(1);
    expect(
      (await repo.table("audit_events").list(boss(), { where: { action: "billing.done:issueInvoice" } })).length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("上流を壊す：鍵なし・認可なし・プラン不整合・金額不正は denied で実行されない", async () => {
    let calls = 0;
    const g = new BillingGateway(repo, {
      execute: async () => {
        calls++;
        return {};
      },
      authorize: async (op) => op !== "cancel",
      planAllows: async (_o, i) => ({ ok: (i.planKey ?? "s") !== "entry", reason: "エントリーには収まらない" }),
    });
    expect((await g.run("issueInvoice", { idempotencyKey: "", amount: 1 }, boss())).status).toBe("denied");
    expect((await g.run("cancel", { idempotencyKey: "k2" }, boss())).status).toBe("denied");
    expect((await g.run("changePlan", { idempotencyKey: "k3", planKey: "entry" }, boss())).status).toBe("denied");
    expect((await g.run("recordPayment", { idempotencyKey: "k4", amount: -5 }, boss())).status).toBe("denied");
    expect(calls).toBe(0);
  });
  it("実体が失敗したら failed（冪等性の記憶には残さない → やり直せる）", async () => {
    let n = 0;
    const g = new BillingGateway(repo, {
      execute: async () => {
        n++;
        if (n === 1) throw new Error("provider down");
        return { ok: true };
      },
    });
    expect((await g.run("issueInvoice", { idempotencyKey: "k5", amount: 1 }, boss())).status).toBe("failed");
    expect((await g.run("issueInvoice", { idempotencyKey: "k5", amount: 1 }, boss())).status).toBe("done");
  });
  it("Webhook の署名：合うときだけ true。改ざん・古い timestamp・秘密なしは false", () => {
    const g = new BillingGateway(repo, { execute: async () => ({}) }, "whsec");
    const ts = Math.floor(Date.now() / 1000);
    const body = '{"type":"invoice.paid"}';
    const sig = g.signWebhook(body, ts);
    expect(g.verifyWebhook(body, sig, ts)).toBe(true);
    expect(g.verifyWebhook(body + " ", sig, ts)).toBe(false);
    expect(g.verifyWebhook(body, sig, ts - 3600)).toBe(false);
    expect(new BillingGateway(repo, { execute: async () => ({}) }).verifyWebhook(body, sig, ts)).toBe(false);
  });
});
