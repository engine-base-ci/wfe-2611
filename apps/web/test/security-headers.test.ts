// 画面の守りの見出し（ZT11・K-23）
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce, securityHeaders } from "../lib/security-headers";

const prod = { nonce: "abc123", apiBase: "https://api.kaname.example/", dev: false };

describe("画面の守りの見出し（ZT11）", () => {
  it("4 つの見出しが全部付く（本番）", () => {
    const h = securityHeaders(prod);
    expect(Object.keys(h)).toEqual(
      expect.arrayContaining(["Content-Security-Policy", "Referrer-Policy", "Strict-Transport-Security"]),
    );
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
  });
  it("ほかのサイトに埋め込ませない・スクリプトは nonce つきだけ・読み込み先は画面と API だけ", () => {
    const csp = contentSecurityPolicy(prod);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https://api.kaname.example");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("開発（next dev）だけ eval と ws を許し、HSTS を付けない", () => {
    const h = securityHeaders({ ...prod, dev: true });
    expect(h["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(h["Content-Security-Policy"]).toContain("ws:");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });
  it("nonce は要求ごとに変わる", () => {
    const a = new Set(Array.from({ length: 50 }, () => newNonce()));
    expect(a.size).toBe(50);
  });
});
