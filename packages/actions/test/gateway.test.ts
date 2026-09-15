import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { ActionGateway, RateLimiter } from "../src/index.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let server: Server;
let base = "";
let slow = false;

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
  server = createServer((req, res) => {
    if (slow) return; // 完了信号を出さない外部（G-15）
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ path: req.url, ok: true }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  server.close();
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const staff = () => ({ tenantId: S.tenantA, userId: S.staffA, role: "member" as const });
function gateway(hooks = {}, limiter = new RateLimiter(30), timeout = 30_000) {
  const g = new ActionGateway(repo, hooks, limiter, timeout);
  g.register("http.get", async (input, t) => {
    const r = await t.fetch(`${base}${String(input["path"])}`, { signal: t.signal });
    return r.json();
  });
  return g;
}
const audits = (action: string) => repo.table("audit_events").list(boss(), { where: { action } });

describe("関門 C1（executeAction）", () => {
  it("auto の行為は実行され、証跡が残る", async () => {
    const g = gateway({ policy: async () => "auto" });
    const r = await g.executeAction<{ ok: boolean }>(
      { actionRef: "http.get", input: { path: "/x" }, destination: "127.0.0.1" },
      boss(),
    );
    expect(r.status).toBe("done");
    expect(r.output?.ok).toBe(true);
    expect((await audits("action.done:http.get")).length).toBeGreaterThanOrEqual(1);
  });
  it("既定は approve：承認が無ければ pending で外に出ない（副作用は承認の後）", async () => {
    let called = false;
    const g = new ActionGateway(repo, {});
    g.register("http.get", async () => {
      called = true;
      return {};
    });
    const r = await g.executeAction({ actionRef: "http.get", input: {} }, boss());
    expect(r.status).toBe("pending_approval");
    expect(called).toBe(false);
  });
  it("上流を壊す：認可 NG・off・台帳 NG・宛先 NG はどれも外に出ず、理由と一手が返り、証跡に denied が残る", async () => {
    let called = 0;
    const mk = (hooks: object) => {
      const g = new ActionGateway(repo, hooks);
      g.register("http.get", async () => {
        called++;
        return {};
      });
      return g;
    };
    const cases = [
      { authorize: async () => false },
      { policy: async () => "off" as const },
      { policy: async () => "auto" as const, serviceAllowed: async () => false },
      { policy: async () => "auto" as const, destinationAllowed: async () => false },
    ];
    for (const h of cases) {
      const r = await mk(h).executeAction({ actionRef: "http.get", input: {}, destination: "evil.example" }, staff());
      expect(r.status).toBe("denied");
      expect(r.handoff).toBeTruthy();
    }
    expect(called).toBe(0);
    expect((await audits("action.denied:http.get")).length).toBeGreaterThanOrEqual(4);
  });
  it("未登録の行為は denied", async () => {
    const r = await new ActionGateway(repo, { policy: async () => "auto" }).executeAction(
      { actionRef: "nope", input: {} },
      boss(),
    );
    expect(r.status).toBe("denied");
  });
  it("レート制限：テナント×宛先で上限を超えたら denied", async () => {
    const g = gateway({ policy: async () => "auto" }, new RateLimiter(2));
    const req = { actionRef: "http.get", input: { path: "/r" }, destination: "127.0.0.1" };
    expect((await g.executeAction(req, boss())).status).toBe("done");
    expect((await g.executeAction(req, boss())).status).toBe("done");
    expect((await g.executeAction(req, boss())).status).toBe("denied");
  });
  it("G-15：完了信号を出さない外部は成功にしない（タイムアウト → failed ＋ 人への一手）", async () => {
    slow = true;
    try {
      const g = gateway({ policy: async () => "auto" }, new RateLimiter(30), 300);
      const r = await g.executeAction(
        { actionRef: "http.get", input: { path: "/slow" }, destination: "127.0.0.1" },
        boss(),
      );
      expect(r.status).toBe("failed");
      expect(r.reason).toMatch(/時間内/);
      expect(r.handoff).toBeTruthy();
    } finally {
      slow = false;
    }
  });
  it("承認済みなら approve でも実行される", async () => {
    const g = gateway({ approval: async () => true });
    const r = await g.executeAction(
      { actionRef: "http.get", input: { path: "/ok" }, destination: "127.0.0.1" },
      boss(),
    );
    expect(r.status).toBe("done");
  });
});
