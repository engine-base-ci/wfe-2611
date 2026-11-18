// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/me/passkeys/:id
// パスキーの名前を変える・外す口は、本物のログインの部品（Better Auth のセッション・kaname_auth.passkey の表・2 段階とパスワードの行）で確かめる。生成の試験の偽のセッションでは部品のセッションも認証の表も無い（K-309）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/me/passkeys/:id", () => {
  it("test_patch_me_passkeys_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/me/passkeys/:id が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-008");
  });
  it("test_patch_me_passkeys_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-023」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-023");
  });
  // 当てはまらない（本人だけの口で役を見ない。取り直しも要らない。他人の行は 404（K309-API-012））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_patch_me_passkeys_id_rejected_403");
  it("test_patch_me_passkeys_id_not_found", () => {
    // UNWANTED: IF 対象が無いか他社の行なら、Kaname は 404 を返す（存在を漏らさない）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-012");
  });
  it("test_patch_me_passkeys_id_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-009");
  });
  it("test_patch_me_passkeys_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_me_passkeys_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-024");
  });
  it("test_patch_me_passkeys_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_patch_me_passkeys_id_mfa_pending", () => {
    // UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/mfa-gate.test.ts の「K321-API-001」（入口 1 か所の止め・同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/mfa-gate.test.ts", "utf8")).toContain("K321-API-001");
  });
  it("test_patch_me_passkeys_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_me_passkeys_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/me/passkeys/:id の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/passkeys.test.ts の「K309-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/passkeys.test.ts", "utf8")).toContain("K309-API-008");
  });
});
