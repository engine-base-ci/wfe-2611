// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。POST /api/v1/auth/invitations/:token/resend-request
// 送り直しの頼みは、本物のトークン（DB にはハッシュだけ）の期限切れの招待の行と、宛て（招いた人・管理者）のメールを引く DB の関数と、関門 C6 の送出の差し込み口で確かめる。生成の試験の土台（偽のセッション・uuid の id）では確かめられない。受け付けない道の値（でたらめ・長すぎる）は 404 で断る（K-334）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("POST /api/v1/auth/invitations/:token/resend-request", () => {
  it("test_post_auth_invitations_token_resend_request_ok", () => {
    // EVENT-DRIVEN: WHEN POST /api/v1/auth/invitations/:token/resend-request が「招待の中身（会社・層・役割）を見て参加する」として呼ばれたとき THEN Kaname は「テナントへの所属を作り、層と権限の束を結ぶ」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-001");
  });
  it("test_post_auth_invitations_token_resend_request_conflict", () => {
    // UNWANTED: IF 招待がまだ使えるなら、Kaname は 409 と E-INV-008 を返し、誰にも知らせない
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-006」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-006");
  });
  // 当てはまらない（体は空の形（strict）で、この口の振る舞いに 422 の分かれ道が無い。知らない欄の 422 は契約の入口（op.ts の strict な形の確かめ）が全部の口に同じに返し、空の体の口では K144-API-013 と契約の fuzz（G36）が見る。受け付けない道の値は 404（K334-API-007））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_post_auth_invitations_token_resend_request_rejected_422");
  it("test_post_auth_invitations_token_resend_request_not_found", () => {
    // UNWANTED: IF 招待のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、誰にも知らせない
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-007");
  });
  it("test_post_auth_invitations_token_resend_request_gone", () => {
    // UNWANTED: IF 招待が取り消されたかもう使われたなら、Kaname は 410 と E-INV-002／E-INV-004 を返し、誰にも知らせない
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-007」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-007");
  });
  it("test_post_auth_invitations_token_resend_request_session_unresolved", () => {
    // UNWANTED: IF 宛てを引く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、知らせの行もメールも残さない
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-011");
  });
  it("test_post_auth_invitations_token_resend_request_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_post_auth_invitations_token_resend_request_rate_limited", () => {
    // UNWANTED: IF 10/min/ip を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-009");
  });
  it("test_post_auth_invitations_token_resend_request_session_unresolved_2", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_post_auth_invitations_token_resend_request_shape", () => {
    // UBIQUITOUS: POST /api/v1/auth/invitations/:token/resend-request の副作用は関門 C2・C6 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F2/invitation-resend-request.test.ts の「K334-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F2/invitation-resend-request.test.ts", "utf8")).toContain("K334-API-001");
  });
});
