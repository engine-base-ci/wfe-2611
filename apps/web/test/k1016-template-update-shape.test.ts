// K-1016「会社の側の『ひな形がこう変わります』の頁」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-993 の KindTemplateUpdate 7 欄）→ 部品の値（features/F12/ops2/template-update-shape.ts）。
//   字は下絵（features/F12/ops2/views-skills.tsx の DIFFS と TemplateUpdatePage の副題）が正。行 ID は 11_tickets/K-1016.md。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { diffRow, updateHead } from "../features/F12/ops2/template-update-shape";
import { UPDATES_A } from "../tests/k/ops-templates-mock";

describe("K-1016 字", () => {
  it("K1016-UN-001 差の字：下絵の DIFFS と同じ kind・target・detail（id は key）", () => {
    const rows = UPDATES_A[0]!.diffs.map((d) => diffRow(d));
    expect(
      rows.map(({ id: _id, ...rest }) => {
        void _id;
        return rest;
      }),
    ).toEqual([
      { kind: "足す", target: "種別「会議」", detail: "欄「議事録のリンク」を足す（必須ではありません）" },
      { kind: "足す", target: "種別「課題」", detail: "色「橙」を足す" },
      { kind: "足す", target: "本文のひな形「QA」", detail: "「再現の手順」の見出しを足す" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["minutes_link", "issue", "qa"]);
    expect(diffRow({ ...UPDATES_A[0]!.diffs[0]!, change: "change" }).kind).toBe("変える");
  });

  it("K1016-UN-002 副題の字：種別 v3 → v4 …・出した日は日本の MM/DD・項目の名", () => {
    expect(updateHead(UPDATES_A[0]!)).toBe(
      "種別 v3 → v4 ・ 手を付けていない所だけ ・ 出した日 10/20 ・ Kaname 運営より",
    );
    expect(
      updateHead({
        ...UPDATES_A[0]!,
        part_name: "項目",
        from_version: 1,
        to_version: 2,
        released_at: "2026-10-19T15:30:00Z",
      }),
    ).toBe("項目 v1 → v2 ・ 手を付けていない所だけ ・ 出した日 10/20 ・ Kaname 運営より");
  });
});
