// K-337「前の道すじ /api/auth-ext/invitations/* を消す」の単体の試験（本番と同じ bootApi）。
// 名前の頭の行 ID（K337-API-…）は 11_tickets/K-337.md の表に 1 対 1 で結ぶ。招待の下見と受諾は契約の口（K-331〜K-333）へ移った（K-21 の行き先の表 08_api/auth-ext-routes.json）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { describe, expect, it } from "vitest";
import { K337_ANY_INVITE_TOKEN } from "../../_fake/secrets.js";
import { PW, setupLogin } from "../F1/login.harness.js";

const h = setupLogin("k337");

describe("K-337 前の道すじを消した", () => {
  it("K337-API-001 前の道すじの下見 GET /api/auth-ext/invitations/:token と受諾 POST …/accept は どちらも 404（下見も受諾もできない）", async () => {
    // 前の下見の口は、無い札にも 404（E-INV-001）を返していた。口そのものが無いことは、答えの code が NOT_FOUND（当たる口が無い）で見分ける
    const preview = await h.req("GET", `/api/auth-ext/invitations/${K337_ANY_INVITE_TOKEN}`);
    expect(preview.status).toBe(404);
    expect((await h.json(preview))["code"], "下見：当たる口が無い（前の口の E-INV-001 でない）").toBe("NOT_FOUND");
    const accept = await h.req("POST", `/api/auth-ext/invitations/${K337_ANY_INVITE_TOKEN}/accept`, {
      name: "佐藤 健",
      password: PW,
    });
    expect(accept.status).toBe(404);
    expect((await h.json(accept))["code"], "受諾：当たる口が無い（前の口は無い札に 410・E-INV-002）").toBe("NOT_FOUND");
  });
});
