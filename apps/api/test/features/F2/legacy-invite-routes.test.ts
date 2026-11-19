// K-337「前の道すじ /api/auth-ext/invitations/* を消す」の単体の試験（本番と同じ bootApi）。
// 名前の頭の行 ID（K337-API-…）は 11_tickets/K-337.md の表に 1 対 1 で結ぶ。招待の下見と受諾は契約の口（K-331〜K-333）へ移った（K-21 の行き先の表 08_api/auth-ext-routes.json）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { K337_ANY_INVITE_TOKEN } from "../../_fake/secrets.js";
import { PW, setupLogin } from "../F1/login.harness.js";

const h = setupLogin("k337");

describe("K-337 前の道すじを消した", () => {
  it("K337-API-001 前の道すじの下見 GET /api/auth-ext/invitations/:token と受諾 POST …/accept は どちらも 404（下見も受諾もできない）", async () => {
    expect((await h.req("GET", `/api/auth-ext/invitations/${K337_ANY_INVITE_TOKEN}`)).status).toBe(404);
    expect(
      (
        await h.req("POST", `/api/auth-ext/invitations/${K337_ANY_INVITE_TOKEN}/accept`, {
          name: "佐藤 健",
          password: PW,
        })
      ).status,
    ).toBe(404);
  });
});
