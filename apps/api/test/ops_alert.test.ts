// T-B-14 上限の知らせ（D-102.5）：秘密の操作が毎分 96 回（上限 120 の 8 割）に来たら運営にメール。1 時間に 1 回まで。送出が無ければログだけ
import { describe, expect, it } from "vitest";
import { InfisicalVault, INFISICAL_FREE_SECRET_PER_MIN } from "@kaname/secrets";
import { NEAR_LIMIT_MAIL_INTERVAL_MS, nearLimitNotifier } from "../src/ops-alert.js";

describe("BRG-14-007 上限の 8 割で運営に知らせる（1 時間に 1 回まで）", () => {
  it("BRG-14-007 1 通目は届く。同じ 1 時間は繰り返さない。1 時間たてばまた届く。ログは毎回", async () => {
    let t = 1_000_000;
    const sent: { to: string; subject: string; text: string }[] = [];
    const logs: string[] = [];
    const notify = nearLimitNotifier({
      mailer: async (m) => void sent.push(m),
      opsEmail: "info@example.com",
      now: () => t,
      log: (l) => logs.push(l),
    });
    notify({ perMinute: 96, limit: 120 });
    notify({ perMinute: 97, limit: 120 });
    t += NEAR_LIMIT_MAIL_INTERVAL_MS - 1;
    notify({ perMinute: 98, limit: 120 });
    await new Promise((r) => setTimeout(r, 0));
    expect(sent, "1 時間の中では 1 通だけ").toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "info@example.com" });
    expect(sent[0]!.subject).toContain("Infisical");
    expect(sent[0]!.text).toContain("96 回");
    expect(sent[0]!.text).toContain("毎分 120 回");
    t += 1;
    notify({ perMinute: 99, limit: 120 });
    await new Promise((r) => setTimeout(r, 0));
    expect(sent, "1 時間たてばまた届く").toHaveLength(2);
    expect(logs.filter((l) => l.includes("上限の 8 割"))).toHaveLength(4);
  });
  it("送出が無ければ（開発）ログだけで落ちない。送れなくてもログに残して落ちない", async () => {
    const logs: string[] = [];
    nearLimitNotifier({ opsEmail: "info@example.com", log: (l) => logs.push(l) })({ perMinute: 96, limit: 120 });
    expect(logs).toHaveLength(1);
    const failing = nearLimitNotifier({
      mailer: async () => {
        throw new Error("Resend が 500");
      },
      opsEmail: "info@example.com",
      log: (l) => logs.push(l),
    });
    failing({ perMinute: 96, limit: 120 });
    await new Promise((r) => setTimeout(r, 0));
    expect(logs.at(-1)).toContain("送れなかった");
  });
  it("BRG-14-007 関門 C8 の実物の数え方：無料枠（毎分 120）で 96 回目の秘密の操作で 1 回だけ呼ばれ、メールが 1 通届く", async () => {
    const sent: string[] = [];
    const v = new InfisicalVault({
      siteUrl: "http://infisical.test",
      clientId: "cid",
      clientSecret: "csecret",
      projectId: "p1",
      environment: "dev",
      // 本物の代わり：入るのは 200・読むのは 404（無い）。通信はしない
      http: async (url) =>
        url.includes("/auth/")
          ? Response.json({ accessToken: "tok", expiresIn: 7200 })
          : Response.json({ message: "not found" }, { status: 404 }),
      onNearLimit: nearLimitNotifier({
        mailer: async (m) => void sent.push(m.subject),
        opsEmail: "info@example.com",
        log: () => undefined,
      }),
    });
    const T = "11111111-1111-4111-8111-111111111111";
    for (let i = 0; i < 95; i++) await v.get(`sec_${i}`, T);
    expect(sent, "95 回ではまだ").toHaveLength(0);
    await v.get("sec_95", T);
    await new Promise((r) => setTimeout(r, 0));
    expect(v.perMinute()).toBe(96);
    expect(sent, `${Math.ceil(INFISICAL_FREE_SECRET_PER_MIN * 0.8)} 回目で 1 通`).toHaveLength(1);
    for (let i = 0; i < 10; i++) await v.get(`sec_x${i}`, T);
    await new Promise((r) => setTimeout(r, 0));
    expect(sent, "続けても同じ 1 分・同じ 1 時間では繰り返さない").toHaveLength(1);
  });
});
