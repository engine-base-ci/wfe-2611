// K-913「ゲストの『初めて』の印はホームを開いたときだけ」の口の試験（代表の決め answer=b187f0c59dec・PM の決め：口に印を付けるかの入力を足す）
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K913-API-…）は 11_tickets/K-913.md の表の行と 1 対 1。
// 試験が決める口の形（K-906 の getPortalHome に問い合わせ visit を 1 つ足す・契約は 05_flow/screen_api.d/K-913.py）:
//   getPortalHome  GET /api/v1/portal?visit=elsewhere  200・答えの形は K-906 のまま。first_visit は「まだ開いた記録が無いか」を返すだけで、記録（audit_events・portal.first_visit）を書かない
//                  GET /api/v1/portal（visit なし）     K-906 のまま（ホームを開いた読み：初めてなら true を返し、同じ取引で記録を 1 行書く）
//                  visit が elsewhere 以外の値           口（home.ts）が DB を呼ぶ前に 422（入口の 422 と同じ形：code VALIDATION_ERROR・details に欄 visit）。記録を書かない
//                  空の値 ?visit=                       指定なしと同じ（ホームの読み：初めてなら true と記録 1 行）
//   入口（contract/op.ts の list の枝）は limit・cursor・scope_id・sort しか見ないので、visit の読み分けは口が自分でする（R-2308 の 1）
// DB：app.portal_home(p_mark boolean default true)（K-913 の migration で、印を付けるかを受ける形に替える。引数なしの呼び方は K-906 と同じ振る舞い）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture } from "../fixture.js";
import { asG, asJson, count, guest, useHooks, world } from "./portal-world.js";

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  await useHooks(f, "portal-read");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type G = Awaited<ReturnType<typeof guest>>;
const home = (p: G, q = "") => f.req("GET", `/portal${q}`, { headers: asG(f, p) });
const firstOf = async (r: Response): Promise<boolean> => {
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await asJson(r)).data as { first_visit: boolean }).first_visit;
};
const marks = (tenantId: string, memberId: string) =>
  count(f, "audit_events", "tenant_id = $1 and action = 'portal.first_visit' and actor_member_id = $2", [
    tenantId,
    memberId,
  ]);

describe("K-913 ゲストの「初めて」の印はホームを開いたときだけ（getPortalHome の visit）", () => {
  it("K913-API-001 visit=elsewhere（ホーム以外の画面の外枠が読む）は first_visit を返すだけで記録を書かない。何度読んでも true のまま。そのあと visit なし（ホーム）で読むと true と記録 1 行、次から false", async () => {
    const w = await world(f, "v01");
    const a = await guest(f, w, "甲", w.gA);
    expect(await firstOf(await home(a, "?visit=elsewhere"))).toBe(true);
    expect(await firstOf(await home(a, "?visit=elsewhere"))).toBe(true);
    expect(await marks(w.tenantId, a.id)).toBe(0);
    expect(await firstOf(await home(a))).toBe(true);
    expect(await marks(w.tenantId, a.id)).toBe(1);
    expect(await firstOf(await home(a))).toBe(false);
    expect(await firstOf(await home(a, "?visit=elsewhere"))).toBe(false);
    expect(await marks(w.tenantId, a.id)).toBe(1);
  });

  it("K913-API-002 visit が elsewhere 以外（home・大文字・知らない字）は口が 422（入口と同じ形・code VALIDATION_ERROR・details に欄 visit）で、記録を書かない。空の値 ?visit= は指定なしと同じ＝ホームの読み（200・true・記録 1 行）", async () => {
    const w = await world(f, "v02");
    const a = await guest(f, w, "乙", w.gA);
    for (const q of ["?visit=home", "?visit=ELSEWHERE", "?visit=x"]) {
      const r = await home(a, q);
      expect(r.status, q).toBe(422);
      const j = await asJson(r);
      expect(j["code"], q).toBe("VALIDATION_ERROR");
      expect(
        ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field),
        q,
      ).toContain("visit");
    }
    expect(await marks(w.tenantId, a.id)).toBe(0);
    expect(await firstOf(await home(a, "?visit="))).toBe(true);
    expect(await marks(w.tenantId, a.id)).toBe(1);
  });
});
