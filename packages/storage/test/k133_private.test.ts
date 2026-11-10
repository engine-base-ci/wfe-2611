// K-133「provision:bucket が置き場の非公開を確かめる」の試験（実装より先に積む）。
//   Supabase の公開・非公開はバケット単位。公開の読みの口（/object/public/<バケット>/<鍵>）は、非公開のバケットでも
//   公開のバケットで物が無いときでも 400 を返す（supabase/storage の getPublicObject・error-handler）。だから在る物で確かめる：
//   確かめ用の物を置く → 署名つきで読めること（200）と、署名なしの公開の口で読めないこと（200 以外）の両方を見る → 物を消す。
import { describe, expect, it } from "vitest";
import { bucketPublicUrl, checkBucketPrivate, ensureBucket, provisionBucket } from "../src/s3.js";

const PROBE = ".kaname-private-probe";

/** 偽の S3（送った命令を数える）と偽の署名の口と偽の fetch（受けた URL と頭を残す） */
function rig(o: { publicStatus?: number; signedStatus?: number; hasBucket?: boolean; fetchThrows?: boolean } = {}) {
  let has = o.hasBucket ?? false;
  const calls: string[] = [];
  const keys: string[] = [];
  const client = {
    async send(cmd: unknown) {
      const c = cmd as { constructor: { name: string }; input: Record<string, unknown> };
      calls.push(c.constructor.name);
      if (c.input["Key"]) keys.push(`${c.constructor.name}:${String(c.input["Key"])}`);
      if (c.constructor.name === "HeadBucketCommand" && !has)
        throw Object.assign(new Error("NotFound"), { name: "NotFound" });
      if (c.constructor.name === "CreateBucketCommand") has = true;
      return {};
    },
  };
  const presigner = {
    async presignGet(url: URL, ttl: number) {
      return `${url.toString()}?X-Amz-Signature=t&X-Amz-Expires=${ttl}`;
    },
  };
  const seen: { url: string; auth: string | null }[] = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    if (o.fetchThrows) throw new Error("ECONNREFUSED");
    if (url.includes("X-Amz-Signature")) return new Response("x", { status: o.signedStatus ?? 200 });
    return new Response("", { status: o.publicStatus ?? 400 });
  };
  return { client, presigner, fetchImpl, calls, keys, seen };
}
const SB = "https://abc.storage.supabase.co/storage/v1/s3";

describe("K-133 置き場は非公開", () => {
  it("K133-CI-001 署名なしで確かめる先：Supabase の S3 の口は公開の読みの口（/object/public/<バケット>/<鍵>）、ほかは <口>/<バケット>/<鍵>", () => {
    expect(bucketPublicUrl(SB, "kaname-staging", "kaname-bridge.json")).toBe(
      "https://abc.storage.supabase.co/storage/v1/object/public/kaname-staging/kaname-bridge.json",
    );
    expect(bucketPublicUrl("http://127.0.0.1:9000/", "b", "kaname-bridge.json")).toBe(
      "http://127.0.0.1:9000/b/kaname-bridge.json",
    );
  });
  it("K133-CI-002 確かめ用の物を置き、署名つきで読めて（200）、署名なしの公開の口では読めない（400）なら private。公開の口は頭なしで叩き、物は後で消す", async () => {
    const r = rig({ publicStatus: 400 });
    expect(await checkBucketPrivate({ ...r, endpoint: SB, bucket: "kaname-staging" })).toBe("private");
    expect(r.keys).toEqual([`PutObjectCommand:${PROBE}`, `DeleteObjectCommand:${PROBE}`]);
    const pub = r.seen.find((s) => !s.url.includes("X-Amz-Signature"));
    expect(pub).toEqual({ url: bucketPublicUrl(SB, "kaname-staging", PROBE), auth: null });
    expect(r.seen.some((s) => s.url.startsWith(`${SB}/kaname-staging/${PROBE}?`))).toBe(true);
  });
  it("K133-CI-003 在る物が署名なしの公開の口で読める（200）なら public。物は消す", async () => {
    const r = rig({ publicStatus: 200 });
    expect(await checkBucketPrivate({ ...r, endpoint: SB, bucket: "kaname-staging" })).toBe("public");
    expect(r.keys).toContain(`DeleteObjectCommand:${PROBE}`);
  });
  it("K133-CI-004 確かめ用の物を署名つきで読めない（403）なら確かめられないので例外（private と言わない）。物は消す", async () => {
    const r = rig({ signedStatus: 403 });
    await expect(checkBucketPrivate({ ...r, endpoint: SB, bucket: "kaname-staging" })).rejects.toThrow(/確かめ/);
    expect(r.keys).toContain(`DeleteObjectCommand:${PROBE}`);
  });
  it("K133-CI-005 置き場に届かないときは例外（黙って通さない）", async () => {
    const r = rig({ fetchThrows: true });
    await expect(checkBucketPrivate({ ...r, endpoint: SB, bucket: "kaname-staging" })).rejects.toThrow("ECONNREFUSED");
  });
  it("K133-CI-006 provision を 2 回流しても同じ：2 回目は作らない（CreateBucket は 1 回だけ）", async () => {
    const r = rig();
    expect(await ensureBucket(r.client, "b")).toBe("created");
    expect(await ensureBucket(r.client, "b")).toBe("exists");
    expect(r.calls.filter((c) => c === "CreateBucketCommand")).toHaveLength(1);
  });
  it("K133-CI-007 provisionBucket：非公開なら 0 を返し「<バケット> @ <口>: created・private」を出す。公開なら 1 を返し、非公開に戻すよう出す", async () => {
    const out: string[] = [];
    const ok = rig({ publicStatus: 400 });
    expect(
      await provisionBucket({
        ...ok,
        endpoint: SB,
        bucket: "kaname-staging",
        releaseBase: "",
        log: (s) => out.push(s),
      }),
    ).toBe(0);
    expect(out.join("\n")).toContain(`[provision bucket] kaname-staging @ ${SB}: created・private`);
    const bad: string[] = [];
    const pub = rig({ publicStatus: 200, hasBucket: true });
    expect(
      await provisionBucket({
        ...pub,
        endpoint: SB,
        bucket: "kaname-staging",
        releaseBase: "",
        log: (s) => bad.push(s),
      }),
    ).toBe(1);
    expect(bad.join("\n")).toContain("置き場が公開になっています");
  });
  it("K133-CI-008 provisionBucket：配布物の頭（BRIDGE_RELEASE_BASE）が作って確かめた置き場（<口>/<STORAGE_BUCKET>/…）の下でなければ 1（別のバケットは作られず確かめられない）", async () => {
    const out: string[] = [];
    const r = rig({ publicStatus: 400 });
    expect(
      await provisionBucket({
        ...r,
        endpoint: SB,
        bucket: "kaname-staging",
        releaseBase: `${SB}/other-bucket/bridge`,
        log: (s) => out.push(s),
      }),
    ).toBe(1);
    expect(out.join("\n")).toContain("BRIDGE_RELEASE_BASE");
    const ok = rig({ publicStatus: 400 });
    expect(
      await provisionBucket({
        ...ok,
        endpoint: SB,
        bucket: "kaname-staging",
        releaseBase: `${SB}/kaname-staging/bridge`,
        log: () => {},
      }),
    ).toBe(0);
  });
});
