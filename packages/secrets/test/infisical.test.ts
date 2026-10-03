// 資格情報の預かり先 Infisical（D-101）を、同じ形の偽の Infisical（HTTP）に向けて確かめる。本物の口はアカウントができたら staging で流す（T-B-14）。
//   偽物は本物と同じく、フォルダが無い置き場への預け入れを 404 にする（2026-09-29 本物で実測：偽物が受け付けていたので、フォルダを作らない穴を見逃した）
//   ・入って（Universal Auth）、会社ごとの置き場に預け・読み・失効させる
//   ・別の会社の置き場は見に行かない／鍵が途中で切れたら 1 回だけ入り直す／届かないときは預かったことにしない
//   ・失敗の理由に中身（暗号文も）を入れない
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { InfisicalVault, RateLimited, type StoredSecret } from "../src/index.js";

type Rec = { key: string; path: string; value: string };
const store: Rec[] = [];
/** ある置き場（フォルダ）。本物と同じく「/」だけが最初からある */
const folders = new Set<string>(["/"]);
const seen: { method: string; url: string; auth: string | undefined; body: unknown }[] = [];
let tokenN = 0;
let expireNext = false;
let down = false;
let limited = false;
let srv: http.Server;
let base = "";

beforeAll(async () => {
  srv = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    seen.push({ method: req.method ?? "", url: req.url ?? "", auth: req.headers.authorization, body });
    const send = (code: number, j: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(j));
    };
    if (down) return send(503, { message: "down" });
    if (limited && !req.url?.includes("/auth/"))
      return send(429, {
        statusCode: 429,
        message: "Rate limit exceeded. Please try again in 42 seconds",
        error: "RateLimitExceeded",
      });
    const u = new URL(req.url ?? "/", "http://x");
    if (u.pathname === "/api/v1/auth/universal-auth/login") {
      if (body.clientId !== "cid" || body.clientSecret !== "csecret") return send(401, { message: "bad" });
      tokenN++;
      return send(200, { accessToken: `tok${tokenN}`, expiresIn: 7200, tokenType: "Bearer" });
    }
    if (req.headers.authorization !== `Bearer tok${tokenN}` || expireNext) {
      expireNext = false;
      return send(401, { message: "expired" });
    }
    // フォルダを作る（本物：workspaceId が要る・既にあれば 400「already exists」・親が無ければ 404）
    if (u.pathname === "/api/v1/folders" && req.method === "POST") {
      if (!body?.workspaceId) return send(422, { message: [{ path: ["workspaceId"], message: "Required" }] });
      const parent = body.path as string;
      const full = parent === "/" ? `/${body.name}` : `${parent}/${body.name}`;
      if (!folders.has(parent)) return send(404, { message: `Folder with path '${parent}' not found` });
      if (folders.has(full))
        return send(400, {
          message: `Folder with name '${body.name}' already exists in path '${parent}'`,
          error: "BadRequest",
        });
      folders.add(full);
      return send(200, { folder: { name: body.name } });
    }
    const m = /^\/api\/v4\/secrets(?:\/([^/]+))?$/.exec(u.pathname);
    if (!m) return send(404, { message: "no route" });
    const path = (body?.secretPath as string) ?? u.searchParams.get("secretPath") ?? "/";
    if (req.method === "POST") {
      if (!folders.has(path)) return send(404, { message: `Folder with path '${path}' not found` });
      store.push({ key: m[1]!, path, value: body.secretValue });
      return send(200, { secret: { secretKey: m[1] } });
    }
    if (req.method === "PATCH") {
      const r = store.find((x) => x.key === m[1] && x.path === path);
      if (!r) return send(404, {});
      r.value = body.secretValue;
      return send(200, { secret: {} });
    }
    if (req.method === "GET" && m[1]) {
      const r = store.find((x) => x.key === m[1] && x.path === path);
      return r
        ? send(200, { secret: { secretKey: r.key, secretValue: r.value } })
        : send(404, { message: "not found" });
    }
    if (req.method === "GET") {
      const rs = store.filter((x) => x.path === path);
      return rs.length
        ? send(200, { secrets: rs.map((r) => ({ secretKey: r.key, secretValue: r.value })) })
        : send(404, {});
    }
    return send(405, {});
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => srv.close(() => r())));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const sec = (tenantId: string): StoredSecret => ({
  tenantId,
  iv: "aXY=",
  tag: "dGFn",
  data: "Y2lwaGVy",
  kind: "basic",
  revokedAt: null,
});
const vault = () =>
  new InfisicalVault({
    siteUrl: base,
    clientId: "cid",
    clientSecret: "csecret",
    projectId: "p1",
    environment: "staging",
  });

describe("預ける・読む・失効（D-101）", () => {
  it("会社ごとの置き場（/tenants/<会社>）に預け、同じ会社で読める。名前の - は _ に", async () => {
    const v = vault();
    await v.put("sec_0190-abc", sec(A));
    expect(store.at(-1)).toMatchObject({ key: "sec_0190_abc", path: `/tenants/${A}` });
    expect(await v.get("sec_0190-abc", A)).toMatchObject({ tenantId: A, data: "Y2lwaGVy" });
  });
  it("BRG-14-002 別の会社の置き場は見に行かない（B として読むと無い）", async () => {
    expect(await vault().get("sec_0190-abc", B)).toBeNull();
  });
  it("失効すると revokedAt が付き、二度目は false。会社ごと失効は、その会社の分だけ", async () => {
    const v = vault();
    await v.put("sec_a2", sec(A));
    await v.put("sec_b1", sec(B));
    expect(await v.revoke("sec_0190-abc", A)).toBe(true);
    expect(await v.revoke("sec_0190-abc", A)).toBe(false);
    expect(await v.revokeTenant(A)).toBe(1); // sec_a2 だけ（sec_0190-abc は失効済み）
    expect((await v.get("sec_b1", B))?.revokedAt, "別の会社は触らない").toBeNull();
  });
});

describe("会社ごとの置き場のフォルダ（T-B-14・2026-09-29 本物で実測）", () => {
  it("初めての会社は /tenants/<会社> のフォルダが無いので、作ってから預ける。2 社目・2 回目は既にあるフォルダを作り直さない", async () => {
    const C = "33333333-3333-4333-8333-333333333333";
    const D = "44444444-4444-4444-8444-444444444444";
    const v = vault();
    const before = seen.length;
    await v.put("cr_c1", sec(C));
    expect(await v.get("cr_c1", C)).toMatchObject({ tenantId: C });
    expect(folders.has(`/tenants/${C}`)).toBe(true);
    await v.put("cr_c2", sec(C));
    await v.put("cr_d1", sec(D));
    expect(await v.get("cr_d1", D)).toMatchObject({ tenantId: D });
    const made = seen.slice(before).filter((x) => x.url === "/api/v1/folders" && x.method === "POST");
    // C で /tenants と /tenants/C、D で /tenants（既にある）と /tenants/D。C の 2 回目はフォルダに触らない
    expect(made.map((x) => (x.body as { name: string }).name)).toEqual(["tenants", C, "tenants", D]);
  });
});

describe("入り方と失敗（D-101・G-11）", () => {
  it("鍵は使い回し、途中で切れたら 1 回だけ入り直す", async () => {
    const v = vault();
    await v.ping();
    const before = tokenN;
    await v.get("sec_b1", B);
    expect(tokenN, "期限内は入り直さない").toBe(before);
    expireNext = true;
    expect(await v.get("sec_b1", B)).not.toBeNull();
    expect(tokenN, "切れたら入り直す").toBe(before + 1);
  });
  it("鍵が違えば ping で落ちる（起動時に分かる）", async () => {
    const bad = new InfisicalVault({
      siteUrl: base,
      clientId: "cid",
      clientSecret: "wrong",
      projectId: "p1",
      environment: "staging",
    });
    await expect(bad.ping()).rejects.toThrow(/入る/);
  });
  it("届かないときは投げる。理由に中身（暗号文）を入れない", async () => {
    down = true;
    try {
      await expect(vault().put("sec_x", sec(A))).rejects.toThrow(/503/);
      await vault()
        .put("sec_x", sec(A))
        .catch((e: Error) => expect(e.message).not.toContain("Y2lwaGVy"));
    } finally {
      down = false;
    }
  });
  it("設定が足りなければ作れない", () => {
    expect(
      () => new InfisicalVault({ siteUrl: base, clientId: "", clientSecret: "x", projectId: "p", environment: "s" }),
    ).toThrow(/INFISICAL/);
  });
});

describe("上限（D-102.4・D-102.5）", () => {
  it("直近 1 分の秘密の操作が上限の 8 割に来たら 1 回だけ知らせる", async () => {
    const hits: { perMinute: number; limit: number }[] = [];
    const v = new InfisicalVault({
      siteUrl: base,
      clientId: "cid",
      clientSecret: "csecret",
      projectId: "p1",
      environment: "staging",
      secretPerMinute: 5,
      onNearLimit: (u) => hits.push(u),
    });
    for (let i = 0; i < 6; i++) await v.get("sec_b1", B);
    expect(v.perMinute()).toBe(6);
    expect(hits, "8 割（4 回目）で 1 回。同じ 1 分の中では繰り返さない").toEqual([{ perMinute: 4, limit: 5 }]);
  });
  it("1 分たてば数え直し、また 8 割に来たら知らせる", async () => {
    let t = 1_000_000;
    const hits: number[] = [];
    const v = new InfisicalVault({
      siteUrl: base,
      clientId: "cid",
      clientSecret: "csecret",
      projectId: "p1",
      environment: "staging",
      secretPerMinute: 5,
      now: () => t,
      onNearLimit: (u) => hits.push(u.perMinute),
    });
    for (let i = 0; i < 4; i++) await v.get("sec_b1", B);
    t += 61_000;
    expect(v.perMinute()).toBe(0);
    for (let i = 0; i < 4; i++) await v.get("sec_b1", B);
    expect(hits).toEqual([4, 4]);
  });
  it("当たったら（429）待つ秒数つきの RateLimited。読めたことにしない", async () => {
    limited = true;
    try {
      const e = await vault()
        .get("sec_b1", B)
        .catch((x: unknown) => x);
      expect(e).toBeInstanceOf(RateLimited);
      expect((e as RateLimited).retryAfterSec).toBe(42);
    } finally {
      limited = false;
    }
  });
});
