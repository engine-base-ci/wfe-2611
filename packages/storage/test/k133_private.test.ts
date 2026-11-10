// K-133「provision:bucket が置き場の非公開を確かめる」の試験（実装より先に積む）。
//   置き場（Supabase の S3 互換）は公開・非公開をバケットで決める。中身は全部非公開にし、受け取りは期限つき署名 URL（D-128.153・D-128.160）。
//   provision は作った後（冪等）に、署名なしで中身を取りに行き、断られる（400・401・403）ことを確かめる。通ったら（200・404）止める。
import { describe, expect, it } from "vitest";
import { bucketPublicUrl, checkBucketPrivate, ensureBucket } from "../src/s3.js";

describe("K-133 置き場は非公開", () => {
  it("K133-CI-001 署名なしで確かめる先：Supabase の S3 の口は公開の読みの口（/object/public/<バケット>/<鍵>）、ほかは <口>/<バケット>/<鍵>", () => {
    expect(
      bucketPublicUrl("https://abc.storage.supabase.co/storage/v1/s3", "kaname-staging", "kaname-bridge.json"),
    ).toBe("https://abc.storage.supabase.co/storage/v1/object/public/kaname-staging/kaname-bridge.json");
    expect(bucketPublicUrl("http://127.0.0.1:9000/", "b", "kaname-bridge.json")).toBe(
      "http://127.0.0.1:9000/b/kaname-bridge.json",
    );
  });
  it("K133-CI-002 署名なしの読みが断られる（400・401・403）なら private", async () => {
    for (const status of [400, 401, 403]) {
      const r = await checkBucketPrivate("http://s3.test", "b", async () => new Response("", { status }));
      expect(r, String(status)).toBe("private");
    }
  });
  it("K133-CI-003 署名なしの読みが通る（200）・在る無しを答える（404）なら public（provision はこれで止める）", async () => {
    for (const status of [200, 404]) {
      const r = await checkBucketPrivate("http://s3.test", "b", async () => new Response("", { status }));
      expect(r, String(status)).toBe("public");
    }
  });
  it("K133-CI-004 置き場に届かないときは例外（黙って通さない・provision は失敗で止まる）", async () => {
    await expect(
      checkBucketPrivate("http://s3.test", "b", async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toThrow("ECONNREFUSED");
  });
  it("K133-CI-005 provision を 2 回流しても同じ：2 回目は作らない（CreateBucket は 1 回だけ）", async () => {
    let has = false;
    const calls: string[] = [];
    const client = {
      async send(cmd: unknown) {
        const n = (cmd as { constructor: { name: string } }).constructor.name;
        calls.push(n);
        if (n === "HeadBucketCommand" && !has) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
        if (n === "CreateBucketCommand") has = true;
        return {};
      },
    };
    expect(await ensureBucket(client, "b")).toBe("created");
    expect(await ensureBucket(client, "b")).toBe("exists");
    expect(calls.filter((c) => c === "CreateBucketCommand")).toHaveLength(1);
  });
});
