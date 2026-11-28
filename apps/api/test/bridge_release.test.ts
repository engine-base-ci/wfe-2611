// Bridge の配布物の目録と自分で入れ替える口（D-109・T-B-06）。目録に載ったものだけ配り、指紋と大きさを返す。
//   K-57 で前の道すじ（/api/auth-ext/bridge/latest・download・file）を契約の口（GET /api/v1/bridge/releases/…）に移した。
//   新しい版を見る・落とすは、ログインしている人か、つないだ PC の印（D-128.137）
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture, type Fixture, type Person } from "./features/fixture.js";

let f: Fixture;
let me: Person;
const REL = mkdtempSync(join(tmpdir(), "kaname-rel-"));
const get = (path: string) => f.req("GET", path, { headers: me.auth });
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;

beforeAll(async () => {
  f = await makeFixture();
  const c = await f.company("配布物の試験");
  me = await f.person(c.tenantId, c.rootScope);
  f.release.dir = REL;
  f.release.base = "";
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const ZIP = Buffer.from("fake-app-zip-contents");
const DMG = Buffer.from("fake-dmg");
function writeRelease(
  files: { platform: string; arch: string; kind: string; name: string; body: Buffer }[],
  version = "0.260928.1530",
) {
  for (const x of files) writeFileSync(join(REL, x.name), x.body);
  writeFileSync(
    join(REL, "kaname-bridge.json"),
    JSON.stringify({
      version,
      released_at: "2026-09-28T15:30:00Z",
      files: files.map(({ body, ...x }) => ({ ...x, sha256: sha(body), size: body.length })),
    }),
  );
}

describe("BRG-06-016 Bridge の配布物の目録（D-109）", () => {
  it("目録が無ければ released:false（Bridge は何もしない）", async () => {
    const d = await json<{ released: boolean }>(get("/bridge/releases/latest?os=mac&arch=arm64"));
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
    }>(get("/bridge/releases/latest?os=mac&arch=arm64"));
    expect(d.released).toBe(true);
    expect(d.version).toBe("0.260928.1530");
    expect(d.update).toEqual({
      name: "Kaname-Bridge-0.260928.1530-arm64-mac.zip",
      url: "/api/v1/bridge/releases/Kaname-Bridge-0.260928.1530-arm64-mac.zip/file",
      sha256: sha(ZIP),
      size: ZIP.length,
    });
    const r = await get(d.update.url.replace("/api/v1", ""));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-length")).toBe(String(ZIP.length));
    expect(sha(Buffer.from(await r.arrayBuffer()))).toBe(d.update.sha256);
  });
  it("その CPU の中身が無ければ update:null（別の CPU の中身は渡さない）", async () => {
    const d = await json<{ released: boolean; update: unknown }>(get("/bridge/releases/latest?os=mac&arch=x64"));
    expect(d.released).toBe(true);
    expect(d.update).toBeNull();
  });
  it("人が受け取るインストーラは目録のものを配る", async () => {
    const r = await get("/bridge/releases/mac/file");
    expect(r.status).toBe(200);
    expect(decodeURIComponent(r.headers.get("content-disposition") ?? "")).toContain(
      "Kaname-Bridge-0.260928.1530-arm64.dmg",
    );
    expect(sha(Buffer.from(await r.arrayBuffer()))).toBe(sha(DMG));
  });
  it("目録に無い名前・置き場の外を指す名前は 404（フォルダの中身を勝手に配らない）", async () => {
    writeFileSync(join(REL, "secret.txt"), "x");
    expect((await get("/bridge/releases/secret.txt/file")).status).toBe(404);
    expect((await get("/bridge/releases/..%2F..%2Fetc%2Fpasswd/file")).status).toBe(404);
    expect((await get("/bridge/releases/kaname-bridge.json/file")).status).toBe(404);
  });
  it("壊れた目録（指紋が無い・名前に / がある）は無いものとして扱う", async () => {
    writeFileSync(
      join(REL, "kaname-bridge.json"),
      JSON.stringify({
        version: "0.260928.1600",
        files: [{ platform: "mac", arch: "arm64", kind: "app", name: "a/b.zip", sha256: "x", size: 1 }],
      }),
    );
    expect(await json(get("/bridge/releases/latest?os=mac&arch=arm64"))).toEqual({ released: false });
  });
});
