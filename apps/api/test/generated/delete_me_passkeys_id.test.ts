// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/me/passkeys/:id
// パスキーの名前を変える・外す口は、本物のログインの部品（Better Auth のセッション・kaname_auth.passkey の表・2 段階とパスワードの行）で確かめる。生成の試験の偽のセッションでは部品のセッションも認証の表も無い（K-309）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/me/passkeys/:id", () => {
  it("test_delete_me_passkeys_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/me/passkeys/:id が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-014");
  });
  it("test_delete_me_passkeys_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-023");
  });
  it("test_delete_me_passkeys_id_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-018");
  });
  it("test_delete_me_passkeys_id_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-012");
  });
  // 当てはまらない（体を受けない。id の形は入口の共通の確かめ（K-144））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_me_passkeys_id_rejected_422");
  it("test_delete_me_passkeys_id_conflict", () => {
    // UNWANTED: IF 外すと入り方が無くなるか、パスワードだけで 2 段階が無い状態になるなら、Kaname は 409 と E-AUTH-015・E-AUTH-016 を返し、パスキーを外さない
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-016");
  });
  // 当てはまらない（回数は入口の共通の数えで、同じ口の型の確かめは renamePasskey の K309-API-024 が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_me_passkeys_id_rate_limited");
  it("test_delete_me_passkeys_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_delete_me_passkeys_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_me_passkeys_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/me/passkeys/:id の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-014");
  });
});
