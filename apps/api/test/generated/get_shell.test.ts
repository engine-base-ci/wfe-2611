// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/shell
// 外枠の数と帯は、行の守り（見えるグループ・チケット）・承認・知らせ・PC・障害の帯の組み合わせで答えが変わる。生成の試験の種ではそれらを作れない（K-465）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/shell", () => {
  it("test_get_shell_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/shell が「タブで切り替える・絞り込みを保存する」として呼ばれたとき THEN Kaname は「外枠の数と帯（自分・会社・承認待ち・未読・グループの件数・PC・はじめにやること・障害の帯・保存した検索条件）を 1 本で返す（外枠が読む口を 1 本にまとめる・D-151.7）」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F7/shell.test.ts の「K465-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/shell.test.ts", "utf8")).toContain("K465-API-001");
  });
  it("test_get_shell_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F7/shell.test.ts の「K465-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/shell.test.ts", "utf8")).toContain("K465-API-012");
  });
  it("test_get_shell_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F7/shell.test.ts の「K465-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/shell.test.ts", "utf8")).toContain("K465-API-012");
  });
  // 当てはまらない（入力を受けない GET（問い合わせ・体の形の確かめは入口の共通・K-144））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_shell_rejected_422");
  it("test_get_shell_rate_limited", () => {
    // UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F7/shell.test.ts の「K465-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F7/shell.test.ts", "utf8")).toContain("K465-API-013");
  });
  it("test_get_shell_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_shell_mfa_pending");
  it("test_get_shell_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
});
