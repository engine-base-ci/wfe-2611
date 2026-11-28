// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/client_requests/:id/draft
// 案の仕事を積む口は、押した人の PC が生きているか（75 秒の知らせ）・依頼の状態と案の状態（pending の 10 分）・見える／直せるで答えが変わる。生成の試験の種では PC のセッション・依頼・ゲストのグループを作れない（K-896）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/client_requests/:id/draft", () => {
  it("test_post_client_requests_id_draft_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/client_requests/:id/draft が「依頼とやり取りを見て、受けてチケットにする／断る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す（自動側：依頼からチケットの案を作る）
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-001");
  });
  it("test_post_client_requests_id_draft_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-007");
  });
  it("test_post_client_requests_id_draft_rejected_403", () => {
    // UNWANTED: IF 依頼を直せない人が案を作ろうとしたなら、Kaname は 403 を返し、仕事も依頼の変更も証跡も作らない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-007");
  });
  it("test_post_client_requests_id_draft_not_found", () => {
    // UNWANTED: IF 依頼が見えないなら、Kaname は 404 と E-GST-100 を返し、在るかを漏らさず何も積まない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-007");
  });
  it("test_post_client_requests_id_draft_conflict", () => {
    // UNWANTED: IF 依頼がもう決まっているなら、Kaname は 409 と E-GST-140 を返し、仕事を積まない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-006");
  });
  it("test_post_client_requests_id_draft_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-015」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-015");
  });
  it("test_post_client_requests_id_draft_conflict_2", () => {
    // UNWANTED: IF 押した人の PC がつながっていないなら、Kaname は 409 と E-GST-141 を返し、仕事も依頼の変更も作らない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-004");
  });
  it("test_post_client_requests_id_draft_conflict_3", () => {
    // UNWANTED: IF 案をもう作っているか出来ているなら、Kaname は 409 と E-GST-142 を返し、仕事を増やさない
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-005");
  });
  it("test_post_client_requests_id_draft_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_client_requests_id_draft_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-017」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-017");
  });
  // 当てはまらない（この口はサーバーの外を呼ばない（仕事を積む／結果を書くのは DB の関数 1 回・関門 C2。AI を動かすのはつないだ PC の上・K-929）。結果が来ない扱いは K-896 の止まった仕事の引き金（K896-API-012）が受ける）：UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
  it.todo("test_post_client_requests_id_draft_upstream_failed");
  it("test_post_client_requests_id_draft_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_client_requests_id_draft_mfa_pending");
  it("test_post_client_requests_id_draft_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_client_requests_id_draft_shape", () => {
    // UBIQUITOUS: POST /api/v1/client_requests/:id/draft の副作用は関門 C2・C3 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F11/client-requests-draft.test.ts の「K896-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/client-requests-draft.test.ts", "utf8")).toContain("K896-API-001");
  });
});
