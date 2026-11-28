// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/credentials/:id/login-check
// 確かめの口は本物の PC の印・本物の預ける口（金庫）・PC が取った仕事・DB の関数の失敗で答えが変わる。生成の試験の偽のセッションでは PC も仕事も作れない（K-355）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/credentials/:id/login-check", () => {
  it("test_post_credentials_id_login_check_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/credentials/:id/login-check が「名前を付けて値を入れる。秘密は保存後に見えない」として呼ばれたとき THEN Kaname は「秘密は金庫へ（AI に見せない）。値は層つきで保存」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-001");
  });
  // 当てはまらない（ログインの印が無い・失効した人の 401 は全部の口で同じ 1 か所の入口（op.ts）が返す。この口は自分で持たない（PC の口の 401 は K355-API-025））：UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
  it.todo("test_post_credentials_id_login_check_rejected_401");
  it("test_post_credentials_id_login_check_rejected_403", () => {
    // UNWANTED: IF 同じワークスペースのほかの人が預けた物なら、Kaname は 403 を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-006");
  });
  it("test_post_credentials_id_login_check_not_found", () => {
    // UNWANTED: IF 見えない物（無い・ほかのワークスペースの物・ほかの人の個人の物・自分の消した物）なら、Kaname は 404 を返し、在るかを漏らさず確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-006");
  });
  it("test_post_credentials_id_login_check_conflict", () => {
    // UNWANTED: IF いま確かめているなら、Kaname は 409 と E-CRED-012 を返し、仕事を増やさない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-004」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-004");
  });
  it("test_post_credentials_id_login_check_rejected_422", () => {
    // UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
    // 本物の試験：apps/api/test/features/contract/k144.d/K-355.ts の「K144-API-067」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144.d/K-355.ts", "utf8")).toContain("K144-API-067");
  });
  it("test_post_credentials_id_login_check_conflict_2", () => {
    // UNWANTED: IF ログインでない物なら、Kaname は 409 と E-CRED-013 を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-005");
  });
  it("test_post_credentials_id_login_check_conflict_3", () => {
    // UNWANTED: IF 失効したか期限が過ぎたなら、Kaname は 409 と E-CRED-011 を返し、確かめの仕事を積まない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-007");
  });
  it("test_post_credentials_id_login_check_session_unresolved", () => {
    // UNWANTED: IF 確かめを積めないなら、Kaname は 503 と E-PAGE-003 を返し、仕事も行の状態も変えない
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-008」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-008");
  });
  it("test_post_credentials_id_login_check_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  // 当てはまらない（上限は全部の口で同じ 1 か所の入口（op.ts・契約の rate_limit 60/分）が数える。この口は上限の振る舞いを自分で持たない）：UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_post_credentials_id_login_check_rate_limited");
  // 当てはまらない（同意し直しの止めは全部の口で同じ 1 か所の入口（op.ts）。この口は止めの振る舞いを自分で持たない（本物のログインで止まることは K-53 の試験が見る））：UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
  it.todo("test_post_credentials_id_login_check_terms_pending");
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_post_credentials_id_login_check_mfa_pending");
  it("test_post_credentials_id_login_check_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_credentials_id_login_check_shape", () => {
    // UBIQUITOUS: POST /api/v1/credentials/:id/login-check の副作用は関門 C2・C8 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F3/credential-login-check.test.ts の「K355-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F3/credential-login-check.test.ts", "utf8")).toContain("K355-API-001");
  });
});
