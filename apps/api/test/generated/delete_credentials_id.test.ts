// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。DELETE /api/v1/credentials/:id
// 消すは DB の関数（行と確かめの仕事を 1 つの取引で止める）と金庫の失効を通る。生成の試験の偽のセッションでは金庫も持ち主も作れない（K-353）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DELETE /api/v1/credentials/:id", () => {
  it("test_delete_credentials_id_ok", () => {
    // EVENT-DRIVEN: WHEN DELETE /api/v1/credentials/:id が「名前を付けて値を入れる。秘密は保存後に見えない」として呼ばれたとき THEN Kaname は「秘密は金庫へ（AI に見せない）。値は層つきで保存」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-018");
  });
  it("test_delete_credentials_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-026");
  });
  it("test_delete_credentials_id_rejected_403", () => {
    // UNWANTED: IF ワークスペースの物を消す権限が無いなら、Kaname は 403 と E-CRED-007 を返し、行も金庫も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-020");
  });
  it("test_delete_credentials_id_not_found", () => {
    // UNWANTED: IF 見えない物・消した物・失効した物を消そうとしたなら、Kaname は 404 を返し、行も金庫も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-021");
  });
  // 当てはまらない（体を受けない。id の形は入口の共通の確かめ（K-144））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_delete_credentials_id_rejected_422");
  it("test_delete_credentials_id_session_unresolved", () => {
    // UNWANTED: IF 行を消す DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、行も金庫も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-024」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-024");
  });
  // 当てはまらない（回数は入口の共通の数えで、同じ表の口の型の確かめは createCredential の K352-API-024 が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_delete_credentials_id_rate_limited");
  it("test_delete_credentials_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_delete_credentials_id_mfa_pending");
  it("test_delete_credentials_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_delete_credentials_id_shape", () => {
    // UBIQUITOUS: DELETE /api/v1/credentials/:id の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-018」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-018");
  });
});
