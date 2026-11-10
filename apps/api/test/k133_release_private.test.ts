// K-133「置き場の中身は全部非公開・目録も署名つきで読む」の試験（実装より先に積む）。
//   目録 kaname-bridge.json を読むのは API だけ（Bridge 本体は置き場を直に読まない）。API は入れ物と同じく、
//   置き場の仕組みの期限つき署名 URL（関門 C4 の signExternal）で目録を読む。署名を作れない置き場（置き場の外の URL）だけ署名なしで読む。
//   偽の S3（./fake-s3.ts）は SigV4 を計算し直して確かめ、public でない物を署名なしで読むと 403 にする。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s3Client, s3Presigner } from "@kaname/storage";
import { releaseState } from "../src/auth/bridge-release.js";
import { FAKE_S3, startFakeS3, type FakeS3 } from "./fake-s3.js";

const MANIFEST = JSON.stringify({
  version: "1.4.0",
  released_at: "2026-11-10T00:00:00Z",
  files: [
    {
      platform: "mac",
      arch: "arm64",
      kind: "installer",
      name: "Kaname-Bridge-1.4.0-arm64.dmg",
      sha256: "a".repeat(64),
      size: 10,
    },
  ],
});

let fake: FakeS3;
let signer: ReturnType<typeof s3Presigner>;
beforeAll(async () => {
  fake = await startFakeS3();
  const client = s3Client({
    endpoint: fake.endpoint,
    region: FAKE_S3.region,
    bucket: "k133-bridge",
    accessKeyId: FAKE_S3.accessKeyId,
    secretAccessKey: FAKE_S3.secretAccessKey,
  });
  signer = s3Presigner(client, fake.endpoint);
});
afterAll(async () => {
  await fake.close();
});

/** 置き場の頭（毎回別の頭にして、目録の 1 分の覚えを試験どうしで混ぜない） */
function base(): string {
  return `${fake.endpoint}/k133-bridge/${randomUUID()}`;
}
const sign =
  (b: string, ttls: number[] = []) =>
  async (name: string, ttl: number) => {
    ttls.push(ttl);
    return signer.presignGet(new URL(`${b}/${name}`), ttl);
  };

describe("K-133 目録も非公開の置き場から署名つきで読む", () => {
  it("K133-API-001 目録が非公開（署名なしでは 403）でも、署名 URL で読んで配布中（ok）と版を返す", async () => {
    const b = base();
    fake.objects.set(`${b.slice(fake.endpoint.length + 1)}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    const unsigned = await fetch(`${b}/kaname-bridge.json`);
    expect(unsigned.status).toBe(403); // 置き場は非公開（前の形の署名なしの読みは通らない）
    const s = await releaseState({ base: b, sign: sign(b) });
    expect(s.state).toBe("ok");
    expect(s.state === "ok" && s.m.version).toBe("1.4.0");
  });
  it("K133-API-002 目録がまだ無い置き場は「配っていない」（none）。届かない（unreachable）と混ぜない", async () => {
    const b = base();
    const s = await releaseState({ base: b, sign: sign(b) });
    expect(s.state).toBe("none");
  });
  it("K133-API-003 置き場に届かない（止まっている）ときは unreachable。覚えずに次の要求でもう一度見に行く", async () => {
    const other = await startFakeS3();
    const b = `${other.endpoint}/k133-bridge/${randomUUID()}`;
    await other.close();
    const s = await releaseState({ base: b, sign: async () => `${b}/kaname-bridge.json?X-Amz-Signature=x` });
    expect(s.state).toBe("unreachable");
  });
  it("K133-API-004 署名の口が無い（開発・置き場の外の URL：sign が null）ときだけ署名なしで読む（今の K-57 の形を壊さない）", async () => {
    const b = base();
    fake.objects.set(`${b.slice(fake.endpoint.length + 1)}/kaname-bridge.json`, {
      body: Buffer.from(MANIFEST),
      public: true,
    });
    const s = await releaseState({ base: b, sign: async () => null });
    expect(s.state).toBe("ok");
  });
  it("K133-API-006 署名つきの読みが断られた（403：鍵の誤り・期限切れ）ときは unreachable（「読み込めませんでした」・決める人 answer=005e60e70a71）。「配っていない」（none）に化けない。覚えない", async () => {
    const b = base();
    fake.objects.set(`${b.slice(fake.endpoint.length + 1)}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    const broken = async (name: string, ttl: number) => {
      const u = new URL((await signer.presignGet(new URL(`${b}/${name}`), ttl))!);
      u.searchParams.set("X-Amz-Signature", "0".repeat(64)); // 鍵の誤りと同じく、置き場が署名を断る
      return u.toString();
    };
    expect((await releaseState({ base: b, sign: broken })).state).toBe("unreachable");
    expect((await releaseState({ base: b, sign: sign(b) })).state).toBe("ok"); // 覚えていない（直った次の要求で読める）
  });
  it("K133-API-008 署名を作るのが失敗した（設定の誤り：sign が例外）ときは unreachable。署名なしの読みに落とさない", async () => {
    const b = base();
    fake.objects.set(`${b.slice(fake.endpoint.length + 1)}/kaname-bridge.json`, {
      body: Buffer.from(MANIFEST),
      public: true,
    });
    const failing = async () => {
      throw new Error("外の置き場の設定が置き場と合いません");
    };
    expect((await releaseState({ base: b, sign: failing })).state).toBe("unreachable");
  });
  it("K133-API-005 目録の署名 URL の期限は 60 秒（入れ物と同じく短い）", async () => {
    const b = base();
    fake.objects.set(`${b.slice(fake.endpoint.length + 1)}/kaname-bridge.json`, { body: Buffer.from(MANIFEST) });
    const ttls: number[] = [];
    const s = await releaseState({ base: b, sign: sign(b, ttls) });
    expect(s.state).toBe("ok");
    expect(ttls).toEqual([60]);
  });
});
