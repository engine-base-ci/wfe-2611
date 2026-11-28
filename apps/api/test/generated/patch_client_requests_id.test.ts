// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/client_requests/:id
// 届け先を変える口は、依頼・ゲストのグループ・届け先と見る人の権限で答えが変わる。生成の試験の種では依頼もゲストのグループも作れない（K-893）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/client_requests/:id", () => {
  it("test_patch_client_requests_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/client_requests/:id が「依頼とやり取りを見て、受けてチケットにする／断る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：依頼からチケットの案を作る）
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-001");
  });
  it("test_patch_client_requests_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-007");
  });
  it("test_patch_client_requests_id_rejected_403", () => {
    // UNWANTED: IF 依頼を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-007");
  });
  it("test_patch_client_requests_id_not_found", () => {
    // UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-006");
  });
  it("test_patch_client_requests_id_rejected_422", () => {
    // UNWANTED: IF 入力が契約の形に合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-003");
  });
  it("test_patch_client_requests_id_not_found_2", () => {
    // UNWANTED: IF 選んだ届け先が選べないなら、Kaname は 404 と E-GST-111 を返し、届け先を変えない
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-004");
  });
  it("test_patch_client_requests_id_conflict", () => {
    // UNWANTED: IF 依頼がもう決まっているなら、Kaname は 409 と E-GST-110 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-005");
  });
  it("test_patch_client_requests_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_client_requests_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-022");
  });
  // 当てはまらない（外を呼ばない（届け先を変えるときはメールも受け箱も送らない・K893-API-001））：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_patch_client_requests_id_upstream_failed");
  it("test_patch_client_requests_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_client_requests_id_mfa_pending");
  it("test_patch_client_requests_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_client_requests_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/client_requests/:id の副作用は関門 C2・C3 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/client-requests-route-reply.test.ts の「K893-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-route-reply.test.ts", "utf8")).toContain("K893-API-001");
  });
});
