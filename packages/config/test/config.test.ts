import { describe, expect, it } from "vitest";
import { ENV_KEYS, loadConfig } from "../src/index.js";
const ok = {
  DATABASE_URL: "postgres://u:p@h/d",
  AUTH_DATABASE_URL: "postgres://a:p@h/d",
  AUTH_SECRET: "s".repeat(32),
  BASE_URL: "http://x",
  STORAGE_ENDPOINT: "http://s",
  STORAGE_REGION: "r",
  STORAGE_BUCKET: "b",
  STORAGE_ACCESS_KEY_ID: "k",
  STORAGE_SECRET_ACCESS_KEY: "k",
  SECRETS_MASTER_KEY: Buffer.alloc(32, 1).toString("base64"),
};
describe("起動設定（X-002）", () => {
  it("揃っていれば型付きで返す", () => {
    const c = loadConfig({ ...ok, NODE_ENV: "test", PORT: "4000" });
    expect(c.env).toBe("test");
    expect(c.port).toBe(4000);
    expect(c.storage.bucket).toBe("b");
    expect(c.resendApiKey).toBeNull();
  });
  it("足りなければ名前を全部挙げて落ちる（黙って起動しない・G-11）", () => {
    expect(() => loadConfig({ DATABASE_URL: "x" })).toThrow(/AUTH_DATABASE_URL.*SECRETS_MASTER_KEY/);
  });
  it("鍵が短い・NODE_ENV が不明なら落ちる", () => {
    expect(() => loadConfig({ ...ok, SECRETS_MASTER_KEY: "c2hvcnQ=" })).toThrow(/32/);
    expect(() => loadConfig({ ...ok, NODE_ENV: "prod" })).toThrow(/NODE_ENV/);
  });
  it("読む名前の一覧を公開している（G13 が突き合わせる）", () => {
    expect(ENV_KEYS).toContain("DATABASE_URL");
  });
});

describe("資格情報の預かり先 Infisical（D-101）", () => {
  const inf = { INFISICAL_CLIENT_ID: "cid", INFISICAL_CLIENT_SECRET: "cs", INFISICAL_PROJECT_ID: "p", INFISICAL_ENVIRONMENT: "staging" };
  it("無ければ null（開発はメモリ）", () => {
    expect(loadConfig(ok).infisical).toBeNull();
  });
  it("そろえば使う。地域の既定は us、末尾の / は落とす", () => {
    expect(loadConfig({ ...ok, ...inf }).infisical).toEqual({ siteUrl: "https://us.infisical.com", clientId: "cid", clientSecret: "cs", projectId: "p", environment: "staging" });
    expect(loadConfig({ ...ok, ...inf, INFISICAL_SITE_URL: "https://eu.infisical.com/" }).infisical?.siteUrl).toBe("https://eu.infisical.com");
  });
  it("半端なら起動しない（黙ってメモリに落とさない）", () => {
    expect(() => loadConfig({ ...ok, INFISICAL_CLIENT_ID: "cid" })).toThrow(/INFISICAL_CLIENT_SECRET/);
  });
});
