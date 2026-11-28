// K-1012 止めた会社の入口（前の道すじ /api/auth-ext/*）：契約の口の入口 op.ts を通らない前の道すじも、
//   止めた会社の会社の人は止めない道（外枠が読む /me）のほかを 403 E-OPS-007 で止める（D-156.23・Q10 の指摘 2）。
//   止めた会社かは、画面のログインの解決が流す 1 本の文（packages/auth/src/resolver.ts）で一緒に引く（文は増やさない・K-237）。
//   土台は本物の Postgres・本物の Better Auth のログイン・authExt（k145_fixture.ts）。止める印は DB に直に置く（K-970 の口を通さない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, bootK145, closeK145, jobsOf, jsonOf, ready, req } from "../../k145_fixture.js";

beforeAll(async () => {
  await bootK145();
});
afterAll(async () => {
  await closeK145();
});

/** 前の道すじの止める口の代表（AI に話す・会話の一覧・ファイルを読む・はじめの設定を進める）。記憶を直す前の道は段10 の K-712 が道ごと消した（統合の枝） */
const BLOCKED_EXT: [string, string, unknown?][] = [
  ["POST", "/agent/say", { text: "止めた後に話す" }],
  ["GET", "/agent/conversations"],
  ["GET", "/files/00000000-0000-4000-8000-0000000000ac"],
  ["POST", "/setup-step", { step: 1 }],
];

describe("K-1012 止めた会社の入口（前の道すじ）", () => {
  it("K1012-API-009 止めた会社の会社の人：/api/auth-ext/* の AI に話す・会話の一覧・ファイル・記憶を直す・はじめの設定は 403・E-OPS-007（体は error と code だけ）・仕事は増えない。/me は 200。印を消すと通る", async () => {
    const r = await ready();
    await admin.query("update tenants set stopped_at = now(), stop_reason_key = 'unpaid' where id = $1", [r.tenant]);
    try {
      const jobs0 = await jobsOf(r.member);
      for (const [m, p, b] of BLOCKED_EXT) {
        const res = await req(m, p, b, r.H);
        const j = await jsonOf(res);
        expect(res.status, `${m} ${p} ${JSON.stringify(j).slice(0, 160)}`).toBe(403);
        expect(j.code, `${m} ${p}`).toBe("E-OPS-007");
        expect(Object.keys(j).sort(), `${m} ${p}`).toEqual(["code", "error"]);
      }
      expect(await jobsOf(r.member)).toBe(jobs0);
      const me = await req("GET", "/me", undefined, r.H);
      expect(me.status).toBe(200);
    } finally {
      await admin.query("update tenants set stopped_at = null, stop_reason_key = null where id = $1", [r.tenant]);
    }
    const again = await req("GET", "/agent/conversations", undefined, r.H);
    expect(again.status, JSON.stringify(await jsonOf(again)).slice(0, 160)).toBe(200);
  });
});
