// K-994「配るもの › ひな形と操作の画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-992 の OpsTemplateRow・K-1010 の OpsOperation）→ 部品の値（features/F12/ops2/templates-shape.ts）。
//   字は下絵（features/F12/ops2/views-skills.tsx の TEMPLATES と操作の箱）が正。行 ID は 11_tickets/K-994.md。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { operationCard, templateRow } from "../features/F12/ops2/templates-shape";
import { OPERATIONS_A, TEMPLATES_A } from "../tests/k/ops-templates-mock";

describe("K-994 字", () => {
  it("K994-UN-001 ひな形の行の字：下絵の TEMPLATES と同じ id・name・body・ver・using・took・last", () => {
    expect(TEMPLATES_A.map((r) => templateRow(r))).toEqual([
      {
        id: "kind",
        name: "種別",
        body: "タスク・QA・課題・会議 の名前・色・本文のひな形",
        ver: "v3",
        using: "48",
        took: "31 ／ 46",
        last: "10/20",
      },
      {
        id: "state",
        name: "状態",
        body: "未着手・作業中・確認中・承認待ち・実行中・完了",
        ver: "v2",
        using: "48",
        took: "48 ／ 48",
        last: "09/15",
      },
      {
        id: "field",
        name: "項目",
        body: "チケットの欄の並び・必須。種別ごとに持つ",
        ver: "v1",
        using: "48",
        took: "—",
        last: "09/01",
      },
    ]);
  });

  it("K994-UN-002 操作の字：passed は「検査 通った」・failed は「検査 落ちた」・none は札なし・aside は「v1.4 ・ 読むだけ」", () => {
    const o = OPERATIONS_A[0]!;
    expect(operationCard(o)).toEqual({
      title: "ブラウザで操作する",
      aside: "v1.4 ・ 読むだけ",
      body: "汎用の操作 1 つ。初めてのサイトも動かし、うまくいったら動かし方を記録して次から使う",
      badge: "検査 通った",
    });
    expect(operationCard({ ...o, check_state: "failed" }).badge).toBe("検査 落ちた");
    expect(operationCard({ ...o, check_state: "none" }).badge).toBeNull();
  });

  it("K994-UN-003 境目の字：took null は —・offered 0 は 0 ／ 0・last null は —・日本の日付で日をまたぐ", () => {
    const r = TEMPLATES_A[0]!;
    expect(templateRow({ ...r, took: null }).took).toBe("—");
    expect(templateRow({ ...r, took: { changed: 0, offered: 0 } }).took).toBe("0 ／ 0");
    expect(templateRow({ ...r, last_released_at: null }).last).toBe("—");
    expect(templateRow({ ...r, last_released_at: "2026-10-19T15:30:00Z" }).last).toBe("10/20");
  });
});
