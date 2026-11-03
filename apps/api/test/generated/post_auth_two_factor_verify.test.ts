// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。POST /api/v1/auth/two-factor/verify
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf("verifySignInCode");
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe("POST /api/v1/auth/two-factor/verify", () => {
  it("not_implemented_501", async () => {
    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）
    const who = e.auth === "ops" ? "ops" : "boss";
    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;
    const before = await h.count("audit_events");
    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });
    expect(r.status).toBe(501);
    expect(await h.count("audit_events")).toBe(before);
  });
  // まだ作っていない口。作ったら本物の試験になる：EVENT-DRIVEN: WHEN POST /api/v1/auth/two-factor/verify が「パスキーで入る／メールとパスワードと 6 桁で入る」として呼ばれたとき THEN Kaname は「セッション（操作が無ければ 12 時間・長くて 7 日）。5 回失敗で 15 分止める」を行い 2xx を返す
  it.todo("test_post_auth_two_factor_verify_ok");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
  it.todo("test_post_auth_two_factor_verify_rejected_422");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_auth_two_factor_verify_rejected_422_2");
  // まだ作っていない口。作ったら本物の試験になる：UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_auth_two_factor_verify_rate_limited");
  // まだ作っていない口。作ったら本物の試験になる：UBIQUITOUS: POST /api/v1/auth/two-factor/verify の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
  it.todo("test_post_auth_two_factor_verify_shape");
});
