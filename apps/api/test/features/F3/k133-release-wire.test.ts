// K-133：PC をつなぐ画面の口（GET /bridge/releases/latest）が、非公開の置き場の目録を署名つきで読むことを、
//   口から確かめる（hooks.ts の配線）。前からの K-57 の試験は目録を public で置いているので、配線が無くても緑になる。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s3Client, s3Presigner } from "@kaname/storage";
import { makeFixture, type Fixture } from "../fixture.js";
import { FAKE_S3, startFakeS3, type FakeS3 } from "../../fake-s3.js";

const FIXED_IP = "198.51.100.133";
const MANIFEST = JSON.stringify({
  version: "1.4.0",
  released_at: "2026-11-10T00:00:00Z",
  files: [
    {
      platform: "mac",
      arch: "arm64",
      kind: "app",
      name: "Kaname-Bridge-1.4.0-arm64-mac.zip",
      sha256: "b".repeat(64),
      size: 10,
    },
  ],
});
let f: Fixture;
let T1: { tenantId: string; rootScope: string };
let fake: FakeS3;
const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
const newPerson = () => f.person(T1.tenantId, T1.rootScope, {});

beforeAll(async () => {
  f = await makeFixture();
  T1 = await f.company("K133 の会社");
  fake = await startFakeS3();
  f.signer.current = s3Presigner(
    s3Client({
      endpoint: fake.endpoint,
      region: FAKE_S3.region,
      bucket: "k133-bridge",
      accessKeyId: FAKE_S3.accessKeyId,
      secretAccessKey: FAKE_S3.secretAccessKey,
    }),
    fake.endpoint,
  );
}, 60_000);
afterAll(async () => {
  f.signer.current = null;
  f.release.base = "";
  await fake?.close();
  await f?.close();
});

describe("K-133 PC をつなぐ画面の口は、非公開の置き場の目録を署名つきで読む", () => {
  it("K133-API-007 目録を非公開で置いても、新しい版の口が released:true・版 1.4.0 を返す（hooks.ts が sign を渡している）", async () => {
    const prefix = `k133-${randomUUID()}`;
    fake.objects.set(`k133-bridge/${prefix}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    f.release.dir = "";
    f.release.base = `${fake.endpoint}/k133-bridge/${prefix}`;
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/latest?os=mac&arch=arm64", { headers: p.auth, ip: FIXED_IP });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await json(r)).data!;
    expect(d["released"]).toBe(true);
    expect(d["version"]).toBe("1.4.0");
  });
  it("K133-API-009 目録を読むための署名は証跡（object.sign_external）を残さず、入れ物の署名は今までどおり 1 行残す（決める人 answer=005e60e70a71）", async () => {
    const prefix = `k133-${randomUUID()}`;
    fake.objects.set(`k133-bridge/${prefix}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    f.release.dir = "";
    f.release.base = `${fake.endpoint}/k133-bridge/${prefix}`;
    const p = await newPerson();
    const r = await f.req("GET", "/bridge/releases/latest?os=mac&arch=arm64", { headers: p.auth, ip: FIXED_IP });
    expect(r.status).toBe(200);
    const rows = await f.admin.query<{ name: string | null }>(
      "select payload->>'name' as name from audit_events where actor_member_id = $1 and action = 'object.sign_external'",
      [p.id],
    );
    const names = rows.rows.map((x) => x.name);
    expect(names.filter((n) => n === "kaname-bridge.json")).toHaveLength(0); // 目録の署名は残さない（D-138.2）
    expect(names.filter((n) => n === "Kaname-Bridge-1.4.0-arm64-mac.zip")).toHaveLength(1); // 入れ物の署名は今までどおり残す
  });
  it("K133-API-010 置き場が目録の署名つきの読みを断る（鍵の誤り）と、新しい版の口は 503・E-PAGE-007（「読み込めませんでした」）。「まだ配布していません」と混ぜない", async () => {
    const prefix = `k133-${randomUUID()}`;
    fake.objects.set(`k133-bridge/${prefix}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    const keep = f.signer.current;
    f.signer.current = s3Presigner(
      s3Client({
        endpoint: fake.endpoint,
        region: FAKE_S3.region,
        bucket: "k133-bridge",
        accessKeyId: FAKE_S3.accessKeyId,
        secretAccessKey: "wrong-secret-only-for-tests",
      }),
      fake.endpoint,
    );
    try {
      f.release.dir = "";
      f.release.base = `${fake.endpoint}/k133-bridge/${prefix}`;
      const p = await newPerson();
      const r = await f.req("GET", "/bridge/releases/latest?os=mac&arch=arm64", { headers: p.auth, ip: FIXED_IP });
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-007");
    } finally {
      f.signer.current = keep;
    }
  });
});
