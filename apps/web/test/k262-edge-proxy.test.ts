// K-262「画面と口を同じ住所にまとめる」の画面の側の単体の試験（vitest）。行 ID（K262-WEB-…）は 11_tickets/K-262.md の表と 1 対 1。
//   画面の入口（apps/web/middleware.ts）は /api/* を口の住所（サーバーだけの環境変数 KANAME_API_ORIGIN）へ中継し、
//   配り先の Vercel が上書きした本当の値（x-real-ip・x-vercel-ip-country）を x-kaname-client-ip・x-kaname-client-country に
//   上書き（set）して、秘密（KANAME_EDGE_SECRET・NEXT_PUBLIC にしない）を x-kaname-edge-secret に set する。
//   中継の計画は apps/web/lib/edge-proxy.ts の proxyPlan（純粋な関数・環境変数は呼ぶたびに読む）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { proxyPlan } from "../lib/edge-proxy";
import { contentSecurityPolicy } from "../lib/security-headers";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "k262-edge-secret-0123456789abcdef";
const ORIGIN = "https://kaname-api.example.com";
const req = (path: string, h: Record<string, string> = {}) =>
  new Request(`https://kaname-web.example.com${path}`, {
    headers: { "x-real-ip": "203.0.113.5", "x-vercel-ip-country": "JP", ...h },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("K-262 中継の計画（proxyPlan）", () => {
  it("K262-WEB-001 /api/* は口の住所の同じ道と問い合わせへ。写す頭 3 つ（利用者の IP・国・秘密）を set する", () => {
    const p = proxyPlan(req("/api/v1/tickets?view=all&limit=50"), { apiOrigin: ORIGIN, secret: SECRET });
    expect(p).not.toBeNull();
    expect(p!.target).toBe(`${ORIGIN}/api/v1/tickets?view=all&limit=50`);
    expect(p!.set).toEqual({
      "x-kaname-client-ip": "203.0.113.5",
      "x-kaname-client-country": "JP",
      "x-kaname-edge-secret": SECRET,
    });
  });

  it("K262-WEB-002 利用者が自分で付けた同じ名前の頭は上書きされる（値は本当の値と秘密）。本当の値が無い頭は消す（利用者の値を残さない）", () => {
    const forged = req("/api/auth-ext/me", {
      "x-kaname-client-ip": "198.51.100.7",
      "x-kaname-client-country": "US",
      "x-kaname-edge-secret": "guess",
    });
    const p = proxyPlan(forged, { apiOrigin: ORIGIN, secret: SECRET })!;
    expect(p.set["x-kaname-client-ip"]).toBe("203.0.113.5");
    expect(p.set["x-kaname-client-country"]).toBe("JP");
    expect(p.set["x-kaname-edge-secret"]).toBe(SECRET);
    const bare = new Request("https://kaname-web.example.com/api/auth-ext/me", {
      headers: { "x-kaname-client-ip": "198.51.100.7", "x-kaname-client-country": "US" },
    });
    const q = proxyPlan(bare, { apiOrigin: ORIGIN, secret: SECRET })!;
    expect(q.remove).toEqual(expect.arrayContaining(["x-kaname-client-ip", "x-kaname-client-country"]));
    expect(q.set["x-kaname-client-ip"]).toBeUndefined();
    expect(q.set["x-kaname-client-country"]).toBeUndefined();
  });

  it("K262-WEB-003 口の住所か秘密が無い（未設定・空）・/api/* でない道：中継しない（null）", () => {
    expect(proxyPlan(req("/api/v1/tickets"), { apiOrigin: "", secret: SECRET })).toBeNull();
    expect(proxyPlan(req("/api/v1/tickets"), { apiOrigin: ORIGIN, secret: "" })).toBeNull();
    expect(proxyPlan(req("/api/v1/tickets"), { apiOrigin: undefined, secret: undefined })).toBeNull();
    expect(proxyPlan(req("/tickets"), { apiOrigin: ORIGIN, secret: SECRET })).toBeNull();
    expect(proxyPlan(req("/apix/v1"), { apiOrigin: ORIGIN, secret: SECRET })).toBeNull();
  });
});

describe("K-262 画面の入口（middleware）", () => {
  it("K262-WEB-004 /api/* は中継（rewrite）し、写した頭を要求に載せ、画面の守りの頭（CSP・nonce）を付けない", async () => {
    vi.stubEnv("KANAME_API_ORIGIN", ORIGIN);
    vi.stubEnv("KANAME_EDGE_SECRET", SECRET);
    const { middleware } = await import("../middleware");
    const res = middleware(
      new NextRequest("https://kaname-web.example.com/api/v1/scopes", {
        headers: { "x-real-ip": "203.0.113.5", "x-vercel-ip-country": "JP" },
      }),
    );
    expect(res.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/api/v1/scopes`);
    expect(res.headers.get("x-middleware-request-x-kaname-client-country")).toBe("JP");
    expect(res.headers.get("x-middleware-request-x-kaname-client-ip")).toBe("203.0.113.5");
    expect(res.headers.get("x-middleware-request-x-kaname-edge-secret")).toBe(SECRET);
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-nonce")).toBeNull();
  });

  it("K262-WEB-005 画面の道（/tickets）は今までどおり：中継せず、CSP を付ける", async () => {
    vi.stubEnv("KANAME_API_ORIGIN", ORIGIN);
    vi.stubEnv("KANAME_EDGE_SECRET", SECRET);
    const { middleware } = await import("../middleware");
    const res = middleware(new NextRequest("https://kaname-web.example.com/tickets"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

describe("K-262 同じ住所・貯めさせない・秘密を出さない", () => {
  it("K262-WEB-006 口の住所が空（画面と同じ住所・④の後）：CSP の connect-src・img-src・media-src は 'self' と Bridge だけで、空の出どころを書かず投げない", () => {
    const csp = contentSecurityPolicy({ nonce: "n", apiBase: "", dev: false });
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:38617;");
    expect(csp).toMatch(/img-src 'self' data: blob:(;|$)/);
    expect(csp).toMatch(/media-src 'self' blob:(;|$)/);
  });

  it("K262-WEB-007 画面の配りの設定（apps/web/vercel.json）：/api/:path* の中継の答えを配り先に貯めさせない頭（x-vercel-enable-rewrite-caching: 0）がある・地域は hnd1 のまま", () => {
    const v = JSON.parse(readFileSync(join(WEB, "vercel.json"), "utf8")) as {
      regions: string[];
      headers?: { source: string; headers: { key: string; value: string }[] }[];
    };
    expect(v.regions).toEqual(["hnd1"]);
    const rule = (v.headers ?? []).find((h) => h.source === "/api/:path*");
    expect(rule?.headers).toEqual(expect.arrayContaining([{ key: "x-vercel-enable-rewrite-caching", value: "0" }]));
  });

  it("K262-WEB-008 秘密は画面に出さない：KANAME_EDGE_SECRET を読むのは lib/edge-proxy.ts だけ。NEXT_PUBLIC_ の付いた秘密の名前は無く、'use client' のファイルは edge-proxy を読まない", () => {
    // 版に入っているファイルだけを歩く（手元の組み立ての出力 .next-prod・playwright-report などを読まない）
    const files = execFileSync("git", ["ls-files", "--", "."], { cwd: WEB, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/^(test|tests)\//.test(f))
      .map((f) => join(WEB, f));
    const readers = files
      .filter((f) => readFileSync(f, "utf8").includes("KANAME_EDGE_SECRET"))
      .map((f) => relative(WEB, f));
    expect(readers).toEqual(["lib/edge-proxy.ts"]);
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s, relative(WEB, f)).not.toMatch(/NEXT_PUBLIC_KANAME_EDGE_SECRET|NEXT_PUBLIC_[A-Z_]*SECRET/);
      if (/^\s*["']use client["']/.test(s)) expect(s, relative(WEB, f)).not.toMatch(/edge-proxy/);
    }
  });

  it("K262-WEB-009 NEXT_PUBLIC_API_BASE が「/」か空（同じ住所・K-263 は「/」を入れる）なら口の住所は空（相対の道で呼ぶ）。未設定なら今までどおり手元の口", async () => {
    for (const v of ["/", ""]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_API_BASE", v);
      expect((await import("../lib/env")).WEB_ENV.apiBase, v).toBe("");
    }
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env["NEXT_PUBLIC_API_BASE"];
    expect((await import("../lib/env")).WEB_ENV.apiBase).toBe("http://127.0.0.1:3001");
  });
});
