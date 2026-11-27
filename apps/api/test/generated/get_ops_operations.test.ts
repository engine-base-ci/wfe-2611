// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/ops/operations
// 操作の行は運営の会社の種の行（K-1010）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/ops/operations", () => {
  it("test_get_ops_operations_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/ops/operations が「配るもの › 操作で、ブラウザで操作する の版と中身を見る（上げる・版を出すは押せない形）」として呼ばれたとき THEN Kaname は「操作の版はコードで出す（運営の画面からは上げない）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F12/ops-templates-release.test.ts の「K1010-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-templates-release.test.ts", "utf8")).toContain("K1010-API-001");
  });
  it("test_get_ops_operations_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F12/ops-templates-release.test.ts の「K1010-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-templates-release.test.ts", "utf8")).toContain("K1010-API-002");
  });
  it("test_get_ops_operations_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F12/ops-templates-release.test.ts の「K1010-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-templates-release.test.ts", "utf8")).toContain("K1010-API-002");
  });
  // 当てはまらない（入力を受けない GET）：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_ops_operations_rejected_422");
  it("test_get_ops_operations_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F12/ops-templates-release.test.ts の「K1010-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F12/ops-templates-release.test.ts", "utf8")).toContain("K1010-API-013");
  });
  // 当てはまらない（運営の人は顧客の規約の同意を持たない（K-944））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_get_ops_operations_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_ops_operations_mfa_pending");
  it("test_get_ops_operations_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（入力を受けない GET）：UNWANTED: IF スキルの一式に資格情報・会社名・個人名が混ざっている、テストの場面が 1 つでも失敗している、または版のメモが空のまま「出す」を押した THEN Kaname は「この版は出せません。テストで失敗した場面があります（外部サービスの規約変更）。直して再テストしてください」を返し、失敗した場面を見る／直して「上げてテストで動かす」（E-ACT-041）
  it.todo("test_get_ops_operations_rejected_422_2");
});
