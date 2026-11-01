import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway, mask } from "../src/index.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let g: SecretsGateway;
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
  g = new SecretsGateway(repo, new MemoryVault(), randomBytes(32));
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const other = () => ({ tenantId: S.tenantB, userId: S.tenantB, role: "member" as const });

describe("関門 C8（secrets）", () => {
  let ref = "";
  it("預けると参照 ID だけが返り、証跡に値は載らない。実行器だけが取り出せる", async () => {
    const r = await g.store(boss(), "login_password", "p@ssw0rd-very-secret");
    expect(r.status).toBe("done");
    if (r.status !== "done") return;
    ref = (r.value as { ref: string }).ref;
    expect(ref.startsWith("sec_")).toBe(true);
    const ev = await repo.table("audit_events").list(boss(), { where: { action: "secret.store" } });
    expect(JSON.stringify(ev)).not.toContain("p@ssw0rd");
    const v = await g.resolve(ref, { ...boss(), caller: "executor" });
    expect(v.status).toBe("done");
    if (v.status === "done") expect(v.value).toBe("p@ssw0rd-very-secret");
  });
  it("BRG-14-002 上流を壊す：AI や画面の文脈には渡さない。他社の文脈では見られない（A の文脈で B の参照 ID を解く → この参照は見られない）", async () => {
    expect((await g.resolve(ref, { ...boss(), caller: "ai" })).status).toBe("denied");
    expect((await g.resolve(ref, { ...boss(), caller: "screen" })).status).toBe("denied");
    expect((await g.resolve(ref, { ...other(), caller: "executor" })).status).toBe("denied");
  });
  it("鍵はテナントごと：同じ暗号文を別のテナントの鍵では復号できない（実装上は参照で弾かれるが、鍵の分離も確かめる）", async () => {
    const vault = new MemoryVault();
    const g2 = new SecretsGateway(repo, vault, randomBytes(32));
    const r = await g2.store(boss(), "x", "abc");
    if (r.status !== "done") throw new Error("store");
    const s = (await vault.get((r.value as { ref: string }).ref))!;
    await vault.put("sec_forged", { ...s, tenantId: S.tenantB });
    const v = await g2.resolve("sec_forged", { ...other(), caller: "executor" });
    expect(v.status).toBe("failed"); // 参照は他社に見えるよう偽装しても、鍵が違うので読めない
  });
  it("失効は即時（E-AUTH-005）。会社全体の失効も", async () => {
    expect(await g.revoke(boss(), ref)).toBe(true);
    const v = await g.resolve(ref, { ...boss(), caller: "executor" });
    expect(v.status).toBe("denied");
    if (v.status === "denied") expect(v.reason).toMatch(/失効/);
    const r2 = await g.store(boss(), "totp", "JBSWY3DP");
    if (r2.status !== "done") throw new Error("store");
    expect(await g.revokeAll(boss())).toBeGreaterThanOrEqual(1);
    expect((await g.resolve((r2.value as { ref: string }).ref, { ...boss(), caller: "executor" })).status).toBe(
      "denied",
    );
  });
  it("マスク：ログには先頭 2 文字だけ", () => {
    expect(mask("p@ssw0rd")).toBe("p@******…");
    expect(mask("ab")).toBe("**");
    expect(mask("")).toBe("");
  });
  it("鍵が短いと作れない", () => {
    expect(() => new SecretsGateway(repo, new MemoryVault(), randomBytes(16))).toThrow(/32/);
  });
});
