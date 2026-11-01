import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { ObjectStore, refOf } from "../src/index.js";
import { localDriver } from "../src/local.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let store: ObjectStore;

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
  store = new ObjectStore(repo, localDriver(await mkdtemp(join(tmpdir(), "kaname-store-"))), {
    signingSecret: "s3cret-for-test",
    maxBytes: 1024,
  });
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const other = () => ({ tenantId: S.tenantB, userId: S.tenantB, role: "member" as const });
const audits = (action: string) => repo.table("audit_events").list(boss(), { where: { action } });

describe("関門 C4（objectStore）", () => {
  let ref = "";
  it("上げる → 参照はテナントの名前空間・証跡が残る → 取れる", async () => {
    const r = await store.put(boss(), new TextEncoder().encode("hello"), { contentType: "text/plain" });
    expect(r.status).toBe("done");
    if (r.status !== "done") return;
    ref = r.value.ref;
    expect(ref.startsWith(`tenants/${S.tenantA}/`)).toBe(true);
    const g = await store.get(boss(), ref);
    expect(g.status).toBe("done");
    expect((await audits("object.put")).length).toBeGreaterThanOrEqual(1);
  });
  it("上流を壊す：他社の文脈では取れない・消せない・署名できない（証跡に denied）", async () => {
    expect((await store.get(other(), ref)).status).toBe("denied");
    expect((await store.delete(other(), ref)).status).toBe("denied");
    expect((await store.signUrl(other(), ref)).status).toBe("denied");
    expect((await store.get(boss(), refOf(S.tenantB, "x"))).status).toBe("denied"); // 自分の文脈で他社の参照を作っても弾く
  });
  it("大きすぎるファイルは E-LIM-002 の文言で denied", async () => {
    const r = await store.put(boss(), new Uint8Array(2048), {});
    expect(r.status).toBe("denied");
    if (r.status === "denied") expect(r.reason).toMatch(/大きすぎ/);
  });
  it("署名 URL は期限内だけ有効。改ざん・期限切れは弾く", async () => {
    const s = await store.signUrl(boss(), ref, 60);
    expect(s.status).toBe("done");
    if (s.status !== "done") return;
    const u = new URL("http://x" + s.value.url);
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig")!;
    expect(store.verifySigned(ref, exp, sig)).toBe(true);
    expect(store.verifySigned(ref, exp, sig + "x")).toBe(false);
    expect(store.verifySigned(ref, exp, sig, (exp + 1) * 1000)).toBe(false);
    expect(store.verifySigned(refOf(S.tenantB, "x"), exp, sig)).toBe(false);
  });
  it("保持期間を過ぎたものは取れない", async () => {
    const r = await store.put(boss(), new TextEncoder().encode("old"), { retentionDays: -1 });
    if (r.status !== "done") throw new Error("put");
    const g = await store.get(boss(), r.value.ref);
    expect(g.status).toBe("failed");
    if (g.status === "failed") expect(g.reason).toMatch(/保持期間/);
  });
  it("消すと取れなくなる。ローカルのドライバは置き場の外を指せない", async () => {
    expect((await store.delete(boss(), ref)).status).toBe("done");
    expect((await store.get(boss(), ref)).status).toBe("failed");
    await expect(localDriver("/tmp/x").get("../../etc/passwd")).rejects.toThrow(/外/);
  });
});
