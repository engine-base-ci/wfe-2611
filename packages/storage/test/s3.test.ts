import { describe, expect, it } from "vitest";
import { ensureBucket, s3Driver } from "../src/s3.js";

/** S3 の口を偽物にする（本物は staging の起動時確認で当てる・G-11） */
function fakeS3(hasBucket: boolean) {
  const objects = new Map<string, { body: Uint8Array; ct: string; meta: Record<string, string> }>();
  const calls: string[] = [];
  const client = {
    async send(cmd: unknown) {
      const c = cmd as { constructor: { name: string }; input: Record<string, unknown> };
      calls.push(c.constructor.name);
      const key = String(c.input["Key"] ?? "");
      switch (c.constructor.name) {
        case "HeadBucketCommand":
          if (!hasBucket) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
          return {};
        case "CreateBucketCommand":
          hasBucket = true;
          return {};
        case "PutObjectCommand":
          objects.set(key, {
            body: c.input["Body"] as Uint8Array,
            ct: String(c.input["ContentType"]),
            meta: (c.input["Metadata"] as Record<string, string>) ?? {},
          });
          return {};
        case "GetObjectCommand": {
          const o = objects.get(key);
          if (!o) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" });
          return {
            Body: { transformToByteArray: async () => o.body },
            ContentType: o.ct,
            ContentLength: o.body.byteLength,
            Metadata: o.meta,
          };
        }
        case "DeleteObjectCommand":
          objects.delete(key);
          return {};
        default:
          throw new Error(`unexpected ${c.constructor.name}`);
      }
    },
  };
  return { client, calls, objects };
}

describe("S3 互換ドライバ（関門 C4 の中）", () => {
  it("put → get → delete が同じ鍵で往復し、保持期限は metadata に乗る", async () => {
    const f = fakeS3(true);
    const d = s3Driver(f.client, "b");
    const exp = new Date("2030-01-01T00:00:00.000Z");
    await d.put("tenants/t/k", new Uint8Array([1, 2, 3]), { size: 3, contentType: "text/plain", expiresAt: exp });
    const got = await d.get("tenants/t/k");
    expect(got?.body).toEqual(new Uint8Array([1, 2, 3]));
    expect(got?.meta.contentType).toBe("text/plain");
    expect(got?.meta.expiresAt?.toISOString()).toBe(exp.toISOString());
    expect(await d.delete("tenants/t/k")).toBe(true);
    expect(await d.get("tenants/t/k")).toBeNull();
  });
  it("バケットの存在確認：無ければ false（黙って 502 にしない）・ensureBucket は冪等", async () => {
    const f = fakeS3(false);
    expect(await s3Driver(f.client, "b").exists()).toBe(false);
    expect(await ensureBucket(f.client, "b")).toBe("created");
    expect(await ensureBucket(f.client, "b")).toBe("exists");
    expect(await s3Driver(f.client, "b").exists()).toBe(true);
  });
});
