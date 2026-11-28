// K-262「画面と口を同じ住所にまとめる」の口の側の単体の試験（DB を使わない）。
//   行 ID（K262-API-…）は 11_tickets/K-262.md の表と 1 対 1。
//   口の入口（apps/api/src/edge.ts の edgeRequest）は、画面の入口（apps/web/middleware.ts）が写した本当の IP と国（x-kaname-client-ip・
//   x-kaname-client-country）を、秘密（x-kaname-edge-secret）が合うときだけ x-forwarded-for・x-real-ip・x-vercel-ip-country に
//   置き換えて中へ渡す。合わない・秘密が無いときは写した頭を消し、元の頭（配り先の Vercel が上書きした本当の値）のまま渡す。
//   IP と国を読む所（packages/auth/src/device.ts・apps/api/src/contract/op.ts・同意し直しの口）は何も変えずに正しい値を読む。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { describe, expect, it } from "vitest";
import { countryOf, ipOf } from "@kaname/auth/device";
import { createApp } from "../src/app.js";
import { Hono } from "hono";
import { edgeRequest } from "../src/edge.js";
import type { Booted } from "../src/server.js";
import { vercelFetch } from "../src/vercel.js";

const SECRET = "k262-edge-secret-0123456789abcdef";
const URL_ = "https://kaname-api.example.com/api/v1/tickets?view=all";

/** 画面の入口を通った要求の形：元の頭は中継した Vercel のもの（国 US・IP 76.76.21.9）、写した頭が本当の利用者（JP・203.0.113.5） */
function proxied(
  o: { secret?: string; clientIp?: string; clientCountry?: string; method?: string; body?: string } = {},
) {
  const h = new Headers({
    "x-forwarded-for": "76.76.21.9",
    "x-real-ip": "76.76.21.9",
    "x-vercel-ip-country": "US",
    authorization: "Bearer tok",
    "user-agent": "Mozilla/5.0 (Macintosh) Chrome/130.0",
  });
  if (o.clientIp !== undefined) h.set("x-kaname-client-ip", o.clientIp);
  if (o.clientCountry !== undefined) h.set("x-kaname-client-country", o.clientCountry);
  if (o.secret !== undefined) h.set("x-kaname-edge-secret", o.secret);
  return new Request(URL_, {
    method: o.method ?? "GET",
    headers: h,
    ...(o.body !== undefined ? { body: o.body } : {}),
  });
}
const KANAME = ["x-kaname-client-ip", "x-kaname-client-country", "x-kaname-edge-secret"];
const left = (r: Request) => KANAME.filter((k) => r.headers.has(k));

describe("K-262 口の入口の置き換え（edgeRequest）", () => {
  it("K262-API-001 秘密が合う：x-forwarded-for・x-real-ip・x-vercel-ip-country を写した値に置き換え、写した頭と秘密は中へ渡さない（IP と国を読む所が利用者の値を読む）", () => {
    const r = edgeRequest(proxied({ secret: SECRET, clientIp: "203.0.113.5", clientCountry: "JP" }), SECRET);
    expect(r.headers.get("x-forwarded-for")).toBe("203.0.113.5");
    expect(r.headers.get("x-real-ip")).toBe("203.0.113.5");
    expect(r.headers.get("x-vercel-ip-country")).toBe("JP");
    expect(left(r)).toEqual([]);
    expect(ipOf(r.headers)).toBe("203.0.113.5");
    expect(countryOf(r.headers)).toBe("JP");
    expect(r.headers.get("authorization")).toBe("Bearer tok");
    expect(r.url).toBe(URL_);
  });

  it("K262-API-002 秘密が違う（同じ長さ・違う長さ・空）：写した頭と秘密を消し、元の頭（中継の値）のまま渡す。長さが違っても投げない", () => {
    for (const bad of [SECRET.replace(/.$/, "x"), "short", `${SECRET}-longer`, ""]) {
      const r = edgeRequest(proxied({ secret: bad, clientIp: "203.0.113.5", clientCountry: "JP" }), SECRET);
      expect(left(r), bad).toEqual([]);
      expect(r.headers.get("x-forwarded-for"), bad).toBe("76.76.21.9");
      expect(r.headers.get("x-vercel-ip-country"), bad).toBe("US");
    }
  });

  it("K262-API-003 口の側に秘密が無い（環境変数が未設定・空）：秘密の頭が何であっても置き換えず、写した頭と秘密を消す（切り替えの①を先に配っても何もしない）", () => {
    for (const env of [undefined, ""]) {
      for (const sent of [SECRET, "", undefined]) {
        const r = edgeRequest(proxied({ secret: sent, clientIp: "203.0.113.5", clientCountry: "JP" }), env);
        expect(left(r)).toEqual([]);
        expect(r.headers.get("x-forwarded-for")).toBe("76.76.21.9");
        expect(r.headers.get("x-vercel-ip-country")).toBe("US");
      }
    }
  });

  it("K262-API-004 直に来て偽った頭（秘密なし・x-kaname-client-country: US・x-kaname-client-ip）：無視して消し、本当の頭のまま読む", () => {
    const direct = new Request(URL_, {
      headers: {
        "x-forwarded-for": "203.0.113.5",
        "x-real-ip": "203.0.113.5",
        "x-vercel-ip-country": "JP",
        "x-kaname-client-country": "US",
        "x-kaname-client-ip": "198.51.100.7",
      },
    });
    const r = edgeRequest(direct, SECRET);
    expect(left(r)).toEqual([]);
    expect(countryOf(r.headers)).toBe("JP");
    expect(ipOf(r.headers)).toBe("203.0.113.5");
  });

  it("K262-API-005 秘密は合うが写した国が 2 文字でない・空：国の頭を消す（中継の国を残さない）。写した IP が無い：IP の頭を消す", async () => {
    const r = edgeRequest(proxied({ secret: SECRET, clientIp: "203.0.113.5", clientCountry: "J1" }), SECRET);
    expect(r.headers.has("x-vercel-ip-country")).toBe(false);
    expect(countryOf(r.headers)).toBeNull();
    expect(ipOf(r.headers)).toBe("203.0.113.5");
    const r2 = edgeRequest(proxied({ secret: SECRET, clientCountry: "JP" }), SECRET);
    expect(r2.headers.has("x-forwarded-for")).toBe(false);
    expect(r2.headers.has("x-real-ip")).toBe(false);
    expect(countryOf(r2.headers)).toBe("JP");
  });

  it("K262-API-006 方法と体は変えない：POST の JSON の体を置き換えた後も読める", async () => {
    const r = edgeRequest(
      proxied({ secret: SECRET, clientIp: "203.0.113.5", clientCountry: "JP", method: "POST", body: '{"a":1}' }),
      SECRET,
    );
    expect(r.method).toBe("POST");
    expect(await r.json()).toEqual({ a: 1 });
  });
});

describe("K-262 答えを貯めさせない・確かめの口・配りの入口", () => {
  it("K262-API-007 口の全部の答え（/health・契約の口の 404・認証の口が素の Response を返す道・投げて 500 になる道）に Cache-Control: private, no-store", async () => {
    // 認証の口（Better Auth の handler）は Hono の外で作った素の Response を返す。頭は await next() の後に答えへ set しないと消える
    const auth = {
      handler: async () => new Response('{"session":null}', { headers: { "content-type": "application/json" } }),
    };
    const boom = new Hono().get("/boom", () => {
      throw new Error("k262 の試し");
    });
    const app = createApp({ auth: auth as never, authExt: boom as never });
    const cases: [string, number | null][] = [
      ["/health", null],
      ["/api/v1/tickets", null],
      ["/api/auth/get-session", 200],
      ["/api/auth-ext/boom", 500],
      ["/api/no-such", null],
    ];
    for (const [p, status] of cases) {
      const r = await app.request(`http://localhost${p}`);
      if (status !== null) expect(r.status, p).toBe(status);
      expect(r.headers.get("cache-control"), p).toBe("private, no-store");
    }
  });

  it("K262-API-008 確かめの口 GET /api/edge/echo：開いているとき（edgeEcho）はログインなしで置き換えた後の IP と国を 200 で返す（テナント文脈より前）。閉じているとき（既定）は 404", async () => {
    // 本番と同じく repo を持つ口（/api/* にテナント文脈が掛かる）で、確かめの口が認証で止まらないこと
    const on = createApp({ edgeEcho: true, repo: {} as never, contract: false });
    const req = edgeRequest(proxied({ secret: SECRET, clientIp: "203.0.113.5", clientCountry: "JP" }), SECRET);
    const r = await on.request(new Request("http://localhost/api/edge/echo", { headers: req.headers }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ip: "203.0.113.5", country: "JP" });
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const off = createApp({ repo: {} as never, contract: false });
    expect((await off.request("http://localhost/api/edge/echo")).status).not.toBe(200);
    expect((await createApp({}).request("http://localhost/api/edge/echo")).status).toBe(404);
  });

  it("K262-API-013 配りの入口（vercelFetch）が口の入口の置き換えを通す：秘密が合えば口は利用者の IP と国を受け取り、口に秘密が無ければ写した頭を消すだけ", async () => {
    const seen: Record<string, string | null>[] = [];
    const echo = new Hono().get("/api/v1/x", (c) => {
      const h = c.req.raw.headers;
      seen.push({
        xff: h.get("x-forwarded-for"),
        country: h.get("x-vercel-ip-country"),
        client: h.get("x-kaname-client-country"),
        secret: h.get("x-kaname-edge-secret"),
      });
      return c.json({});
    });
    const booted = async (): Promise<Booted> => ({
      app: echo as unknown as Booted["app"],
      report: {} as Booted["report"],
      close: async () => undefined,
    });
    const viaProxy = () =>
      new Request("https://kaname-api.example.com/api/v1/x", {
        headers: proxied({ secret: SECRET, clientIp: "203.0.113.5", clientCountry: "JP" }).headers,
      });
    await vercelFetch(booted, SECRET)(viaProxy());
    await vercelFetch(booted, undefined)(viaProxy());
    expect(seen).toEqual([
      { xff: "203.0.113.5", country: "JP", client: null, secret: null },
      { xff: "76.76.21.9", country: "US", client: null, secret: null },
    ]);
  });
});
