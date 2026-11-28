// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/portal/notices
// お知らせは、運営の表の公開の状態・向け先・置き場・保守の期限で答えが変わる。生成の試験の種では作れない（K-906）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/portal/notices", () => {
  it("test_get_portal_notices_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/portal/notices が「題・本文・詳細・チャットと段の札を見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F11/portal-read.test.ts の「K906-API-020」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-read.test.ts", "utf8")).toContain("K906-API-020");
  });
  it("test_get_portal_notices_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F11/portal-read.test.ts の「K906-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-read.test.ts", "utf8")).toContain("K906-API-010");
  });
  it("test_get_portal_notices_rejected_403", () => {
    // UNWANTED: IF 呼んだ人がゲストのグループに入った今のゲストでないなら、Kaname は 403 を返し、何も返さず何も書かない
    // 本物の試験：apps/api/test/features/F11/portal-read.test.ts の「K906-API-010」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F11/portal-read.test.ts", "utf8")).toContain("K906-API-010");
  });
  // 当てはまらない（体も問い合わせも道の値も持たない口で、形の誤りの出し方が無い（K-906））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_portal_notices_rejected_422");
  // 本物の試験はまだ無い（apps/api/test/features/F11/portal-read.test.ts）：UNWANTED: IF 先方の人の場所が読めないなら、Kaname は 404 を返し、中身を返さない
  it.todo("test_get_portal_notices_not_found");
  // 当てはまらない（読むだけの全員同じ答えの口で、数え方は入口の共通（K-144）。ホームの上限は K906-API-011 が受ける）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_portal_notices_rate_limited");
  it("test_get_portal_notices_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_get_portal_notices_mfa_pending");
  it("test_get_portal_notices_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
});
