// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/me/security
// 安全の設定を読む口は、本物のログインの部品（Better Auth のセッション・パスキーの表・2 段階とバックアップコード）と sessions の印（mfa_pending）で確かめる。生成の試験の偽のセッションでは部品のセッションが無く、入り方の数も印も作れない（K-308）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/me/security", () => {
  it("test_get_me_security_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/me/security が「認証アプリを登録する」として呼ばれたとき THEN Kaname は「TOTPシークレットを暗号化保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/my-security.test.ts の「K308-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/my-security.test.ts", "utf8")).toContain("K308-API-001");
  });
  it("test_get_me_security_ok_2", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/me/security が「端末でパスキーを登録する／認証アプリを登録してバックアップコードを保管する」として呼ばれたとき THEN Kaname は「パスキーの公開鍵・TOTP の鍵を暗号化して保管」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F1/my-security.test.ts の「K308-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/my-security.test.ts", "utf8")).toContain("K308-API-002");
  });
  it("test_get_me_security_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F1/my-security.test.ts の「K308-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/my-security.test.ts", "utf8")).toContain("K308-API-008");
  });
  // 当てはまらない（本人だけの口で役を見ない（権限を何も持たない人も自分の分は読める・受けは K308-API-006））：UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
  it.todo("test_get_me_security_rejected_403");
  // 当てはまらない（入力を受けない GET（一覧の問い合わせは形だけ確かめて無視する））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_me_security_rejected_422");
  it("test_get_me_security_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F1/my-security.test.ts の「K308-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/my-security.test.ts", "utf8")).toContain("K308-API-009");
  });
  it("test_get_me_security_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  it("test_get_me_security_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_get_me_security_shape", () => {
    // UBIQUITOUS: GET /api/v1/me/security の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F1/my-security.test.ts の「K308-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/my-security.test.ts", "utf8")).toContain("K308-API-004");
  });
});
