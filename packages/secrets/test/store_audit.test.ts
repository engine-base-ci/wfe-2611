// K-348「金庫に置いた後の証跡が落ちたら失効させる（秘密の関門 C8）」の試験（本物の DB の証跡・金庫はメモリの写し）。
//   store は、金庫に置いた後の証跡が落ちたら失効させて failed を返す（例外で落ちない）。失効も落ちたら、それでも failed を返す（1 段まで）。
//   行 ID（K348-SEC-…）は 11_tickets/K-348.md の表と 1 対 1。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway, type StoredSecret } from "../src/index.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
const T = 60_000;
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
}, T);
afterAll(async () => {
  await app.end();
  await admin.end();
});

/** 置いた参照と失効の回数を数える金庫（失効を落とすこともできる） */
class SpyVault extends MemoryVault {
  readonly puts: string[] = [];
  readonly revokes: string[] = [];
  constructor(private readonly failRevoke = false) {
    super();
  }
  override async put(ref: string, s: StoredSecret): Promise<void> {
    this.puts.push(ref);
    return super.put(ref, s);
  }
  override async revoke(ref: string): Promise<boolean> {
    this.revokes.push(ref);
    if (this.failRevoke) throw new Error("金庫の失効に届かない（試験）");
    return super.revoke(ref);
  }
}
/** 証跡（audit）だけが例外を投げる repository（ほかは本物のまま） */
const auditDown = (r: Repository): Repository =>
  new Proxy(r, {
    get(target, p, recv) {
      if (p === "audit")
        return async () => {
          throw new Error("証跡に書けない（試験）");
        };
      const v = Reflect.get(target, p, recv) as unknown;
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const SECRET = "k348-作り物の値";

describe("K-348 秘密の関門 store の証跡の失敗", () => {
  it(
    "K348-SEC-001 手順 S2 の失敗：証跡が落ちると failed を返し（例外で落ちない）、金庫に置いた参照は失効している（取り出せない）",
    async () => {
      const vault = new SpyVault();
      const key = randomBytes(32);
      const g = new SecretsGateway(auditDown(repo), vault, key);
      const r = await g.store(boss(), "login_password", SECRET);
      expect(r.status).toBe("failed");
      if (r.status === "done") return;
      expect("value" in r).toBe(false);
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.handoff.length).toBeGreaterThan(0);
      expect(JSON.stringify(r)).not.toContain(SECRET);
      expect(vault.puts).toHaveLength(1);
      expect(vault.revokes).toEqual(vault.puts);
      const stored = await vault.get(vault.puts[0]!);
      expect(stored?.revokedAt).toBeTruthy();
      const good = new SecretsGateway(repo, vault, key);
      const v = await good.resolve(vault.puts[0]!, { ...boss(), caller: "executor" });
      expect(v.status).not.toBe("done");
    },
    T,
  );
  it(
    "K348-SEC-002 S2 の後片付けの失敗：証跡も失効も落ちても failed を返す（例外で落ちない）・失効は 1 回だけ試した",
    async () => {
      const vault = new SpyVault(true);
      const g = new SecretsGateway(auditDown(repo), vault, randomBytes(32));
      const r = await g.store(boss(), "login_password", SECRET);
      expect(r.status).toBe("failed");
      expect(vault.puts).toHaveLength(1);
      expect(vault.revokes).toHaveLength(1);
    },
    T,
  );
  it(
    "K348-SEC-003 証跡が書けるときは前と同じ：done・参照は sec_ で始まる・auditId が在る・失効は呼ばない・証跡に値は載らない",
    async () => {
      const vault = new SpyVault();
      const g = new SecretsGateway(repo, vault, randomBytes(32));
      const r = await g.store(boss(), "login_password", SECRET);
      expect(r.status).toBe("done");
      if (r.status !== "done") return;
      const ref = (r.value as { ref: string }).ref;
      expect(ref.startsWith("sec_")).toBe(true);
      expect(r.auditId).toBeTruthy();
      expect(vault.revokes).toHaveLength(0);
      const ev = await admin.query<{ d: unknown }>(
        "select to_jsonb(a) as d from audit_events a where a.action = 'secret.store' and a.target_id::text = $1",
        [ref],
      );
      expect(ev.rowCount).toBeGreaterThan(0);
      expect(JSON.stringify(ev.rows)).not.toContain(SECRET);
    },
    T,
  );
});
