import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { DEFAULT_MARKER, ProcessGateway, stripEnv } from "../src/index.js";
import { localIsolation } from "../src/local.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let g: ProcessGateway;
const node = process.execPath;

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
  g = new ProcessGateway(repo, localIsolation());
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });

describe("関門 C5（runProcess）", () => {
  it("完了信号を出したプロセスだけ done。結果は JSON で受け取る・証跡が残る", async () => {
    const r = await g.runProcess(
      {
        purpose: "t.ok",
        command: node,
        args: ["-e", `console.log("hello"); console.log("${DEFAULT_MARKER} " + JSON.stringify({ n: 1 }))`],
      },
      boss(),
    );
    expect(r.status).toBe("done");
    if (r.status === "done") {
      expect(r.value.result).toEqual({ n: 1 });
      expect(r.value.exitCode).toBe(0);
    }
    expect(
      (await repo.table("audit_events").list(boss(), { where: { action: "process.done" } })).length,
    ).toBeGreaterThanOrEqual(1);
  });
  it("G-15：exit 0 でも完了信号が無ければ failed（E-SIG-001）", async () => {
    const r = await g.runProcess(
      { purpose: "t.silent", command: node, args: ["-e", "console.log('done?'); process.exit(0)"] },
      boss(),
    );
    expect(r.status).toBe("failed");
    if (r.status === "failed") expect(r.reason).toMatch(/結果を返さず/);
  });
  it("時間を超えたら止める（E-TO-004）。途中までの出力は残る", async () => {
    const r = await g.runProcess(
      {
        purpose: "t.slow",
        command: node,
        args: ["-e", "console.log('start'); setTimeout(()=>{}, 5000)"],
        timeoutMs: 300,
      },
      boss(),
    );
    expect(r.status).toBe("timeout");
    if (r.status === "timeout") {
      expect(r.partial?.stdout).toContain("start");
      expect(r.reason).toMatch(/超えた/);
    }
  });
  it("秘密の環境変数は子プロセスに渡らない", async () => {
    process.env["KANAME_TEST_SECRET_TOKEN"] = "leak";
    const r = await g.runProcess(
      {
        purpose: "t.env",
        command: node,
        args: [
          "-e",
          `console.log("${DEFAULT_MARKER} " + JSON.stringify({ keys: Object.keys(process.env).filter(k => /SECRET|TOKEN|DATABASE_URL|ANTHROPIC/i.test(k)), home: !!process.env.HOME }))`,
        ],
        env: { MY_API_KEY: "x", SAFE_FLAG: "1" },
      },
      boss(),
    );
    expect(r.status).toBe("done");
    if (r.status === "done") {
      const v = r.value.result as { keys: string[]; home: boolean };
      expect(v.keys).toEqual([]);
      expect(v.home).toBe(true);
    }
    expect(Object.keys(stripEnv({ MY_API_KEY: "x", SAFE_FLAG: "1", DATABASE_URL: "u", AUTH_SECRET: "s" }))).toEqual([
      "SAFE_FLAG",
    ]);
  });
  it("出力は上限で切る（truncated）", async () => {
    const r = await g.runProcess(
      {
        purpose: "t.big",
        command: node,
        args: ["-e", `process.stdout.write("x".repeat(5000)); console.log("\\n${DEFAULT_MARKER} 1")`],
        maxOutputBytes: 1000,
      },
      boss(),
    );
    expect(r.status === "done" || r.status === "failed").toBe(true);
    if (r.status === "done") expect(r.value.truncated).toBe(true);
    if (r.status === "failed") expect(r.partial?.truncated).toBe(true); // 印まで切れたら未完了扱い（安全側）
  });
  it("存在しないコマンド・許可されない実行・文脈なしは失敗／denied", async () => {
    expect((await g.runProcess({ purpose: "t.nope", command: "/nonexistent/bin/x" }, boss())).status).toBe("failed");
    const d = new ProcessGateway(repo, localIsolation(), { authorize: async () => false });
    expect((await d.runProcess({ purpose: "t.deny", command: node }, boss())).status).toBe("denied");
    expect(
      (await g.runProcess({ purpose: "t.ctx", command: node }, { tenantId: null, userId: null, role: "anonymous" }))
        .status,
    ).toBe("denied");
  });
});
