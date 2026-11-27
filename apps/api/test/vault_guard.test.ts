// 資格情報の預かり先が決まっていない間（段階 1・D-097.8）：staging／本番では預からない（E-SEC-002）。
// K-358：預ける前の道すじ（/api/auth-ext/vault/credentials）を消したので、預ける口の守り（E-SEC-001〜003・消える保管先）は契約の口 createCredential の
//   K352-API-016・017 が見る。ここには起動時の確認（startup.ts の secrets:vault）だけを残した
import { describe, expect, it } from "vitest";
import { MemoryVault } from "@kaname/secrets";
import { startupChecks } from "../src/startup.js";
type Env = "development" | "staging" | "production" | "test";

// 起動時の確認（D-101・G-11）：staging／本番は消えない預かり先に入れないと起動しない
describe("起動時の確認 secrets:vault（D-101）", () => {
  const cfg = (env: Env) =>
    ({ env, secretsMasterKey: Buffer.alloc(32).toString("base64"), resendApiKey: "x" }) as never;
  const base = { repo: {} as never, bucketExists: async () => true };
  it("staging でメモリの預かり先なら落ちる", async () => {
    expect(await startupChecks({ ...base, config: cfg("staging"), vault: new MemoryVault() })["secrets:vault"]!()).toBe(
      false,
    );
  });
  it("staging で入れる預かり先なら通る。入れなければ例外", async () => {
    const ok = Object.assign(new MemoryVault(), { durable: true, ping: async () => true as const });
    expect(await startupChecks({ ...base, config: cfg("staging"), vault: ok })["secrets:vault"]!()).toBe(true);
    const ng = Object.assign(new MemoryVault(), {
      durable: true,
      ping: async (): Promise<true> => {
        throw new Error("Infisical で入ることができない（401）");
      },
    });
    await expect(startupChecks({ ...base, config: cfg("production"), vault: ng })["secrets:vault"]!()).rejects.toThrow(
      /401/,
    );
  });
  it("開発はメモリでよい", async () => {
    expect(
      await startupChecks({ ...base, config: cfg("development"), vault: new MemoryVault() })["secrets:vault"]!(),
    ).toBe(true);
  });
});
