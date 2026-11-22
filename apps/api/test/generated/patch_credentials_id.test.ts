// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/credentials/:id
// 上書きは本物の秘密の関門（金庫の入れ替え・失効）・行の守り・権限・本人確認の取り直しの時刻で答えが変わる。生成の試験の偽のセッションでは作れない（K-353）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/credentials/:id", () => {
  it("test_patch_credentials_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/credentials/:id が「名前を付けて値を入れる。秘密は保存後に見えない」として呼ばれたとき THEN Kaname は「秘密は金庫へ（AI に見せない）。値は層つきで保存」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-001");
  });
  it("test_patch_credentials_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-026」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-026");
  });
  it("test_patch_credentials_id_rejected_403", () => {
    // UNWANTED: IF ワークスペースの物を直す権限が無いなら、Kaname は 403 と E-CRED-007 を返し、金庫に置かず行も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-011");
  });
  it("test_patch_credentials_id_not_found", () => {
    // UNWANTED: IF 見えない物・消した物・失効した物を上書きしようとしたなら、Kaname は 404 を返し、金庫に置かず行も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-010");
  });
  it("test_patch_credentials_id_rejected_422", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、金庫に置かず行も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-005");
  });
  it("test_patch_credentials_id_rejected_403_2", () => {
    // UNWANTED: IF 取り直しが直前 15 分の内に無く、ログインからも 15 分を過ぎているなら、Kaname は 403 と STEP_UP_REQUIRED を返し、金庫に置かず行も変えない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-009");
  });
  it("test_patch_credentials_id_conflict", () => {
    // UNWANTED: IF 同じ物の中身をほかの画面が先に上書きしたなら、Kaname は 409 と E-CRED-009 を返し、置いた金庫の物を失効させて行は先の上書きのままにする
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-016」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-016");
  });
  // 本物の試験はまだ無い（apps/api/test/features/F3/credentials-update-delete.test.ts）：UNWANTED: IF 期限が日本の今日より前なら、Kaname は 409 と E-CRED-004 を返し、金庫に置かず行も変えない
  it.todo("test_patch_credentials_id_conflict_2");
  // 本物の試験はまだ無い（apps/api/test/features/F3/credentials-update-delete.test.ts）：UNWANTED: IF 預けた物の種類や 2 段階の状態と合わない中身なら、Kaname は 409 と E-CRED-015 を返し、金庫に置かず行も変えない
  it.todo("test_patch_credentials_id_conflict_3");
  it("test_patch_credentials_id_upstream_failed", () => {
    // UNWANTED: IF 新しい中身を預かり先に置けなかったなら、Kaname は 502 と E-SEC-001 を返し、行は前の中身のままにする
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-012");
  });
  it("test_patch_credentials_id_session_unresolved", () => {
    // UNWANTED: IF 預かれない・預かり先が混んでいる・行を書く DB が落ちたなら、Kaname は 503 と E-SEC-002／E-SEC-003／E-PAGE-003 を返し、行は前の中身のままにして新しい金庫の物を生かしたまま残さない
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-013");
  });
  it("test_patch_credentials_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（回数は入口の共通の数えで、同じ表の口の型の確かめは createCredential の K352-API-024 が持つ）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_patch_credentials_id_rate_limited");
  it("test_patch_credentials_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_credentials_id_mfa_pending");
  it("test_patch_credentials_id_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_credentials_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/credentials/:id の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/credentials-update-delete.test.ts の「K353-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credentials-update-delete.test.ts", "utf8")).toContain("K353-API-001");
  });
});
