// K-235「口へ先につなぐ（preconnect）」の単体の試験。行 ID（K235-UT-…）は 11_tickets/K-235.md の表と 1 対 1。
//   先につなぐ先は、口の住所（WEB_ENV.apiBase）の出どころ。画面と同じ住所（apiBase が空・K-262 の後）なら要らない（null）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { describe, expect, it } from "vitest";
import { apiPreconnect } from "../lib/preconnect";

describe("K-235 口へ先につなぐ", () => {
  it("K235-UT-001 別の住所の口：出どころ（道と最後の / を除く）を返す", () => {
    expect(apiPreconnect("https://kaname-api.example.com")).toBe("https://kaname-api.example.com");
    expect(apiPreconnect("https://kaname-api.example.com/")).toBe("https://kaname-api.example.com");
    expect(apiPreconnect("http://127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
    expect(apiPreconnect("https://kaname-api.example.com/base/v1")).toBe("https://kaname-api.example.com");
  });
  it("K235-UT-002 画面と同じ住所（apiBase が空）・形が違う住所・http と https 以外：先につながない（null・文字の「null」も返さない）", () => {
    expect(apiPreconnect("")).toBeNull();
    expect(apiPreconnect("not a url")).toBeNull();
    // URL.origin が文字の "null" になる形（http・https 以外）も出さない
    expect(apiPreconnect("javascript:alert(1)")).toBeNull();
    expect(apiPreconnect("ftp://kaname-api.example.com")).toBeNull();
  });
});
