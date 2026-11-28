// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。PATCH /api/v1/layers/:id
// 直す口は、権限・同じ名前・並びの動かし方・同時の組み合わせで答えが変わる（K-803）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PATCH /api/v1/layers/:id", () => {
  it("test_patch_layers_id_ok", () => {
    // EVENT-DRIVEN: WHEN PATCH /api/v1/layers/:id が「層に名前を付け、グループを足す・並べる」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-009");
  });
  it("test_patch_layers_id_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-013");
  });
  it("test_patch_layers_id_rejected_403", () => {
    // UNWANTED: IF 層を直す権限が無いなら、Kaname は 403 と FORBIDDEN を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-013");
  });
  it("test_patch_layers_id_not_found", () => {
    // UNWANTED: IF 直す層が見つからないなら、Kaname は 404 と E-GRP-007 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-012");
  });
  it("test_patch_layers_id_rejected_422", () => {
    // UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-012」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-012");
  });
  it("test_patch_layers_id_conflict", () => {
    // UNWANTED: IF ほかの層と名前が重なるなら、Kaname は 409 と E-GRP-019 を返し、何も書かない
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-011」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-011");
  });
  it("test_patch_layers_id_too_large", () => {
    // UNWANTED: IF 1 回に送る内容が 1MB（1,048,576 バイト）を超えたなら、Kaname は 413 と PAYLOAD_TOO_LARGE を返し、振る舞いに届かず何も書かない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-042」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-042");
  });
  it("test_patch_layers_id_rate_limited", () => {
    // UNWANTED: IF 60/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-013」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-013");
  });
  it("test_patch_layers_id_terms_pending", () => {
    // UNWANTED: IF 同意し直しが要るセッションなら、Kaname は 403 と E-AUTH-010 を返し、副作用を起こさない
    // 本物の試験：apps/api/test/features/F1/terms.test.ts の「K53-API-005」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F1/terms.test.ts", "utf8")).toContain("K53-API-005");
  });
  // 当てはまらない（止めは全部の口で同じ 1 か所の入口（op.ts）。本物のログインで印を立てて止まることは apps/api/test/features/F1/mfa-gate.test.ts の K321-API-001〜011、口ごとの止めは作った口の生成の試験 mfa_pending が見る）：UNWANTED: IF 付けるまで進めないの印が立ったセッションなら、Kaname は 403 と MFA_REQUIRED を返し、副作用を起こさない
  it.todo("test_patch_layers_id_mfa_pending");
  it("test_patch_layers_id_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  it("test_patch_layers_id_shape", () => {
    // UBIQUITOUS: PATCH /api/v1/layers/:id の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/admin-layer.test.ts の「K803-API-009」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/admin-layer.test.ts", "utf8")).toContain("K803-API-009");
  });
});
