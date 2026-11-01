// T-B-14 本物の Infisical で確かめる（手元の .env の INFISICAL_*＝dev の環境）。偽物（infisical.test.ts）は本物の返しを写したものなので、
// 一覧を読む口（revokeTenant）・会社ごとのフォルダ・暗号文だけが置かれること を本物でも 1 回通す（L-021：偽物の緑だけで done にしない）。
// KANAME_INFISICAL_LIVE=1 のときだけ流す（CI には鍵が無い）。置いたものは dev の環境の /tenants/<試験の uuid> に残る（dev の QA の会社と同じ扱い）
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { InfisicalVault, type StoredSecret } from "../src/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function envFromDotenv(): Record<string, string> {
  const out: Record<string, string> = {};
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return out;
  for (const ln of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*(INFISICAL_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(ln);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...envFromDotenv(), ...process.env } as Record<string, string | undefined>;
const live = process.env["KANAME_INFISICAL_LIVE"] === "1" && !!env["INFISICAL_CLIENT_ID"];

describe.skipIf(!live)("本物の Infisical（dev の環境・KANAME_INFISICAL_LIVE=1）", () => {
  const vault = () =>
    new InfisicalVault({
      siteUrl: (env["INFISICAL_SITE_URL"] || "https://us.infisical.com").replace(/\/$/, ""),
      clientId: env["INFISICAL_CLIENT_ID"]!,
      clientSecret: env["INFISICAL_CLIENT_SECRET"]!,
      projectId: env["INFISICAL_PROJECT_ID"]!,
      environment: env["INFISICAL_ENVIRONMENT"]!,
    });
  const sec = (tenantId: string, data: string): StoredSecret => ({ tenantId, iv: "aXYxMjM0NTY3OA==", tag: "dGFndGFndGFndGFndGFn", data, kind: "basic", revokedAt: null });

  it("入れる（Machine Identity）。初めての会社でもフォルダを作って預け、同じ会社で読める。別の会社の置き場からは読めない", async () => {
    const v = vault();
    await v.ping();
    const A = randomUUID();
    const B = randomUUID();
    await v.put("sec_live-a1", sec(A, "Y2lwaGVyMQ=="));
    expect(await v.get("sec_live-a1", A)).toMatchObject({ tenantId: A, data: "Y2lwaGVyMQ==", revokedAt: null });
    expect(await v.get("sec_live-a1", B), "別の会社の置き場には無い").toBeNull();
  }, 60_000);

  it("会社の置き場の 2 件を一度に失効させると 2 件とも revokedAt が付き、別の会社の分は触らない。失効済みは二度目 0", async () => {
    const v = vault();
    const A = randomUUID();
    const B = randomUUID();
    await v.put("sec_live-a1", sec(A, "Y2lwaGVyMQ=="));
    await v.put("sec_live-a2", sec(A, "Y2lwaGVyMg=="));
    await v.put("sec_live-b1", sec(B, "Y2lwaGVyMw=="));
    expect(await v.revokeTenant(A)).toBe(2);
    expect((await v.get("sec_live-a1", A))?.revokedAt).toBeTruthy();
    expect((await v.get("sec_live-a2", A))?.revokedAt).toBeTruthy();
    expect((await v.get("sec_live-b1", B))?.revokedAt, "別の会社は触らない").toBeNull();
    expect(await v.revokeTenant(A), "二度目は 0").toBe(0);
    expect(await v.revokeTenant(randomUUID()), "何も預けていない会社は 0（404 を数えない）").toBe(0);
  }, 90_000);
});
