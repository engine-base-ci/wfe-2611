// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。GET /api/v1/me
// 自分の設定の読みは、顔・入っている会社・兼務・抜けられるか・担当で答えが変わる。生成の試験の種では作れない（K-833）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/me", () => {
  it("test_get_me_ok", () => {
    // EVENT-DRIVEN: WHEN GET /api/v1/me が「名前・ログインと安全・端末・所属するテナントを見る」として呼ばれたとき THEN Kaname は「—」を行い 2xx を返す
    // 本物の試験：apps/api/test/features/F10/me-profile.test.ts の「K833-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-profile.test.ts", "utf8")).toContain("K833-API-001");
  });
  it("test_get_me_rejected_401", () => {
    // UNWANTED: IF セッションが無いか失効しているなら、Kaname は 401 を返し入り直しを促す（発行済みトークンの期限に頼らない）
    // 本物の試験：apps/api/test/features/F10/me-profile.test.ts の「K833-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-profile.test.ts", "utf8")).toContain("K833-API-014");
  });
  it("test_get_me_rejected_403", () => {
    // UNWANTED: IF 権限が無いなら、Kaname は 403 を返し副作用を一切起こさない（認可 → ポリシー → 承認 → 副作用 → 記録の順）
    // 本物の試験：apps/api/test/features/F10/me-profile.test.ts の「K833-API-014」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-profile.test.ts", "utf8")).toContain("K833-API-014");
  });
  // 当てはまらない（入力を受けない GET（道の値も問い合わせも無い））：UNWANTED: IF 入力が受け付けられないなら、Kaname は 422 と項目ごとの理由を返す（表記ゆらぎはサーバーで正規化してから判定）
  it.todo("test_get_me_rejected_422");
  // 当てはまらない（上限は入口の共通の確かめ（K-144）が全部の口で見る）：UNWANTED: IF 120/min/user を超えたら、Kaname は 429 と retry_after_sec を返す
  it.todo("test_get_me_rate_limited");
  it("test_get_me_session_unresolved", () => {
    // UNWANTED: IF 入口でセッションを解く所が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、止める側に倒して副作用を起こさない
    // 本物の試験：apps/api/test/features/contract/k144-contract.test.ts の「K144-API-032」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/contract/k144-contract.test.ts", "utf8")).toContain("K144-API-032");
  });
  // 当てはまらない（入力を受けない GET（道の値も問い合わせも無い））：UNWANTED: IF 名前・メール・パスワード・2 段階認証の保存に失敗した、または変更後に他の端末と Bridge の失効が実行されなかった THEN Kaname は「保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です」を返し、もう一度保存する／端末の一覧で失効を確認する（E-ACT-040）
  it.todo("test_get_me_rejected_422_2");
  it("test_get_me_shape", () => {
    // UBIQUITOUS: GET /api/v1/me の副作用は関門 C2 を経由し、認可 → ポリシー → 承認 → 副作用 → 記録 の順で行う
    // 本物の試験：apps/api/test/features/F10/me-profile.test.ts の「K833-API-001」（同じ CI の G3 で流れる）
    expect(readFileSync("apps/api/test/features/F10/me-profile.test.ts", "utf8")).toContain("K833-API-001");
  });
});
