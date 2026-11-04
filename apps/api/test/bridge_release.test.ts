// Bridge の配布物の目録と自分で入れ替える口（D-109・T-B-06）。目録に載ったものだけ配り、指紋と大きさを返す。
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
let app: ReturnType<typeof createApp>;
const REL = mkdtempSync(join(tmpdir(), "kaname-rel-"));
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001",
    webBaseURL: "http://localhost:3123",
    mailer: async () => undefined,
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets,
      objects,
      mailer: async () => undefined,
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
        bridgeReleaseDir: REL,
      },
    }),
  });
}, 60_000);

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const ZIP = Buffer.from("fake-app-zip-contents");
const DMG = Buffer.from("fake-dmg");
function writeRelease(
  files: { platform: string; arch: string; kind: string; name: string; body: Buffer }[],
  version = "0.260928.1530",
) {
  for (const f of files) writeFileSync(join(REL, f.name), f.body);
  writeFileSync(
    join(REL, "kaname-bridge.json"),
    JSON.stringify({
      version,
      released_at: "2026-09-28T15:30:00Z",
      files: files.map(({ body, ...f }) => ({ ...f, sha256: sha(body), size: body.length })),
    }),
  );
}

describe("BRG-06-016 Bridge の配布物の目録（D-109）", () => {
  it("目録が無ければ released:false（Bridge は何もしない）", async () => {
    const d = await json<{ released: boolean }>(req("GET", "/bridge/latest?os=mac&arch=arm64"));
    expect(d).toEqual({ released: false });
  });
  it("その OS・CPU の中身の場所・指紋・大きさを返し、その場所から同じ中身が落ちてくる", async () => {
    writeRelease([
      { platform: "mac", arch: "arm64", kind: "app", name: "Kaname-Bridge-0.260928.1530-arm64-mac.zip", body: ZIP },
      { platform: "mac", arch: "arm64", kind: "installer", name: "Kaname-Bridge-0.260928.1530-arm64.dmg", body: DMG },
    ]);
    const d = await json<{
      released: boolean;
      version: string;
      update: { url: string; sha256: string; size: number; name: string };
    }>(req("GET", "/bridge/latest?os=mac&arch=arm64"));
    expect(d.released).toBe(true);
    expect(d.version).toBe("0.260928.1530");
    expect(d.update).toEqual({
      name: "Kaname-Bridge-0.260928.1530-arm64-mac.zip",
      url: "/api/auth-ext/bridge/file/Kaname-Bridge-0.260928.1530-arm64-mac.zip",
      sha256: sha(ZIP),
      size: ZIP.length,
    });
    const r = await app.request(`http://localhost${d.update.url}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-length")).toBe(String(ZIP.length));
    expect(sha(Buffer.from(await r.arrayBuffer()))).toBe(d.update.sha256);
  });
  it("その CPU の中身が無ければ update:null（別の CPU の中身は渡さない）", async () => {
    const d = await json<{ released: boolean; update: unknown }>(req("GET", "/bridge/latest?os=mac&arch=x64"));
    expect(d.released).toBe(true);
    expect(d.update).toBeNull();
  });
  it("人が受け取るインストーラは目録のものを配る", async () => {
    const r = await req("GET", "/bridge/download?os=mac");
    expect(r.status).toBe(200);
    expect(decodeURIComponent(r.headers.get("content-disposition") ?? "")).toContain(
      "Kaname-Bridge-0.260928.1530-arm64.dmg",
    );
    expect(sha(Buffer.from(await r.arrayBuffer()))).toBe(sha(DMG));
  });
  it("目録に無い名前・置き場の外を指す名前は 404（フォルダの中身を勝手に配らない）", async () => {
    writeFileSync(join(REL, "secret.txt"), "x");
    expect((await req("GET", "/bridge/file/secret.txt")).status).toBe(404);
    expect((await req("GET", "/bridge/file/..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await req("GET", "/bridge/file/kaname-bridge.json")).status).toBe(404);
  });
  it("壊れた目録（指紋が無い・名前に / がある）は無いものとして扱う", async () => {
    writeFileSync(
      join(REL, "kaname-bridge.json"),
      JSON.stringify({
        version: "0.260928.1600",
        files: [{ platform: "mac", arch: "arm64", kind: "app", name: "a/b.zip", sha256: "x", size: 1 }],
      }),
    );
    expect(await json(req("GET", "/bridge/latest?os=mac&arch=arm64"))).toEqual({ released: false });
  });
});
