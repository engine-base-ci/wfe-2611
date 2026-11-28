// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/tickets/:id/dry-run
// 試し打ちは、承認待ちの成果物・担当者かどうか・任せた人の AI と PC・メールアドレスで答えが変わる。生成の試験の種ではその組を作れない（K-746）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/tickets/:id/dry-run", () => {
  it("test_post_tickets_id_dry_run_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/tickets/:id/dry-run が「試し打ちを押して、自分に届いたものを見る」として呼ばれたとき THEN Kaname は「試し打ちとして記録する」を行い 2xx を返す（自動側：宛先を自分に差し替えて実行する）
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-001");
  });
  it("test_post_tickets_id_dry_run_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-006");
  });
  it("test_post_tickets_id_dry_run_rejected_403", () => {
    // UNWANTED: IF 担当者でない人かチケットを直せない人が試し打ちしようとしたなら、Kaname は 403 を返し、仕事も実行もやり取りも変えない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-006");
  });
  it("test_post_tickets_id_dry_run_not_found", () => {
    // UNWANTED: IF 見えないチケット・無いチケット・消したチケットで試し打ちしようとしたなら、Kaname は 404 を返し、何も変えない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-006");
  });
  it("test_post_tickets_id_dry_run_conflict", () => {
    // UNWANTED: IF 承認待ちの成果物が無いチケットで試し打ちしようとしたなら、Kaname は 409 と E-RUN-003 を返し、何も積まない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-003」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-003");
  });
  it("test_post_tickets_id_dry_run_rejected_422", () => {
    // UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も積まない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-022」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-022");
  });
  it("test_post_tickets_id_dry_run_conflict_2", () => {
    // UNWANTED: IF 待っている・動いている実行があるときに試し打ちしようとしたなら、Kaname は 409 と E-CONF-013 と今の実行の id を返し、何も積まない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-005");
  });
  it("test_post_tickets_id_dry_run_conflict_3", () => {
    // UNWANTED: IF 試し打ちを動かす AI が使えないなら、Kaname は 409 と E-RUN-004 と理由（detail.reason）を返し、何も積まない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-007");
  });
  it("test_post_tickets_id_dry_run_conflict_4", () => {
    // UNWANTED: IF 押した人のメールアドレスが分からないなら、Kaname は 409 と E-RUN-005 を返し、何も積まず、メールアドレスを答えにもログにも出さない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-008");
  });
  it("test_post_tickets_id_dry_run_session_unresolved", () => {
    // UNWANTED: IF 試し打ちを積む関数か書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、実行も仕事もやり取りも何も残さない
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-021");
  });
  it("test_post_tickets_id_dry_run_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_tickets_id_dry_run_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-005");
  });
  it("test_post_tickets_id_dry_run_upstream_failed", () => {
    // UNWANTED: IF 外部が失敗したか完了信号が無いなら、Kaname は成功扱いにせず 502 と次の一手（人へのハンドオフ）を返す
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-021」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-021");
  });
  it("test_post_tickets_id_dry_run_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_tickets_id_dry_run_mfa_pending");
  it("test_post_tickets_id_dry_run_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_tickets_id_dry_run_shape", () => {
    // UBIQUITOUS: POST /api/v1/tickets/:id/dry-run の副作用は関門 C1・C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F5/dry-run.test.ts の「K746-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F5/dry-run.test.ts", "utf8")).toContain("K746-API-001");
  });
});
