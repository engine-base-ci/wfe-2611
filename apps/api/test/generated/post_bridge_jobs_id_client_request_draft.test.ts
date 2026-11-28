// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/bridge/jobs/:id/client-request-draft
// 結果を返す口は本物の PC の印・その PC が受け取った動いている案の仕事・依頼の状態（決まった・押し直された）で答えが変わる。生成の試験の偽のセッションでは PC も仕事も作れない（K-897）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/bridge/jobs/:id/client-request-draft", () => {
  it("test_post_bridge_jobs_id_client_request_draft_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/bridge/jobs/:id/client-request-draft が「依頼とやり取りを見て、受けてチケットにする／断る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：依頼からチケットの案を作る）
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-001");
  });
  it("test_post_bridge_jobs_id_client_request_draft_rejected_401", () => {
    // UNWANTED: IF PC の印が無いか失効しているなら、Kaname は 401 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-007");
  });
  it("test_post_bridge_jobs_id_client_request_draft_rejected_403", () => {
    // UNWANTED: IF PC の印でない人が結果を返そうとしたなら、Kaname は 403 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-007");
  });
  it("test_post_bridge_jobs_id_client_request_draft_not_found", () => {
    // UNWANTED: IF この PC が受け取った動いている案の仕事でないなら、Kaname は 404 と E-GST-150 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-006");
  });
  it("test_post_bridge_jobs_id_client_request_draft_rejected_422", () => {
    // UNWANTED: IF 同じ冪等キーで二度来たら、Kaname は最初の結果を返し副作用を繰り返さない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-008");
  });
  it("test_post_bridge_jobs_id_client_request_draft_rejected_422_2", () => {
    // UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-002」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-002");
  });
  it("test_post_bridge_jobs_id_client_request_draft_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_bridge_jobs_id_client_request_draft_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-014");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（仕事を積む／結果を書くのは DB の関数 1 回・関門 C2。AI を動かすのはつないだ PC の上・K-929）。結果が来ない扱いは K-896 の止まった仕事の引き金（K896-API-012）が受ける）：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_bridge_jobs_id_client_request_draft_upstream_failed");
  it("test_post_bridge_jobs_id_client_request_draft_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_bridge_jobs_id_client_request_draft_shape", () => {
    // UBIQUITOUS: POST /api/v1/bridge/jobs/:id/client-request-draft の副作用は関門 C2・C3 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/client-requests-draft-result.test.ts の「K897-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft-result.test.ts", "utf8")).toContain("K897-API-001");
  });
});
