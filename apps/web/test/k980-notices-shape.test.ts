// K-980「運営のお知らせの画面（一覧・1 件・障害の続報）」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-1004・K-977 の形）→ 部品の値（features/F12/ops2/notices-shape.ts）と、URL の絞り込みの読み書き。
//   字は下絵（features/F12/ops2/views-notices.tsx の ROWS・NoticePage）が正。時刻は日本時間。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-980.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  feedOf,
  headSub,
  noticeRowView,
  noticesQuery,
  noticesSearch,
  placeView,
  stepsOf,
  updateBody,
} from "../features/F12/ops2/notices-shape";
import { incidentOf, maintOf, NOTICES_A } from "../tests/k/ops-notices-mock";

describe("K-980 一覧の字", () => {
  it("K980-UN-001 一覧の 1 行：下絵の 5 行と同じ字（種類・題・誰に・状態と札の色・出した人）。プランは名前を「・」でつなぐ・ワークスペースは 2 つまで名前・3 つからは「<1 つ目> ほか N か所」・直った障害は「直った ・ MM/DD HH:mm〜」", () => {
    expect(NOTICES_A.map((r) => noticeRowView(r))).toEqual([
      {
        id: NOTICES_A[0]!.id,
        kind: "障害",
        title: "分身の実行が遅れています",
        to: "全部",
        state: "原因が分かった ・ 11/02 09:40〜",
        tone: "warning",
        by: "高本",
      },
      {
        id: NOTICES_A[1]!.id,
        kind: "メンテ",
        title: "11/10（月）2:00〜3:00 メンテナンス",
        to: "全部",
        state: "予定 ・ 11/03 10:00 に出す",
        tone: "progress",
        by: "高本",
      },
      {
        id: NOTICES_A[2]!.id,
        kind: "リリース",
        title: "チケットにスレッドができました",
        to: "全部",
        state: "出した 10/28",
        tone: "success",
        by: "高本",
      },
      {
        id: NOTICES_A[3]!.id,
        kind: "リリース",
        title: "先方の人を招けるようにしました",
        to: "チーム・ビジネス",
        state: "出した 10/14",
        tone: "success",
        by: "佐野",
      },
      {
        id: NOTICES_A[4]!.id,
        kind: "リリース",
        title: "ナレッジの取り込み（Obsidian・Notion）",
        to: "全部",
        state: "下書き",
        tone: "neutral",
        by: "佐野",
      },
    ]);
    const ws = (n: number) => ({ id: `w${n}`, name: `会社${n}` });
    const pick = (k: number) =>
      noticeRowView({
        ...NOTICES_A[2]!,
        audience: { mode: "workspaces", plans: [], workspaces: [1, 2, 3].slice(0, k).map(ws) },
      }).to;
    expect([pick(2), pick(3)]).toEqual(["会社1・会社2", "会社1 ほか 2 か所"]);
    const fixed = noticeRowView({ ...NOTICES_A[0]!, state: "resolved", incident_state: "resolved" });
    expect([fixed.state, fixed.tone]).toEqual(["直った ・ 11/02 09:40〜", "success"]);
    expect(noticeRowView({ ...NOTICES_A[0]!, author_name: null }).by).toBe("—");
  });
});

describe("K-980 1 件の字", () => {
  it("K980-UN-002 頭の下・状態の段・これまで：「障害 ・ 全部のワークスペース ・ 11/02 09:40〜」・今は 2 つ目・これまでは新しい順で時刻 MM/DD HH:mm と状態の字と本文", () => {
    const d = incidentOf();
    expect(headSub(d)).toBe("障害 ・ 全部のワークスペース ・ 11/02 09:40〜");
    expect(stepsOf(d)).toEqual({ labels: ["調べている", "原因が分かった", "様子を見ている", "直った"], current: 1 });
    expect(feedOf(d.updates)).toEqual([
      { at: "11/02 10:20", text: "原因が分かった", detail: d.updates[1]!.body },
      { at: "11/02 09:40", text: "調べている", detail: d.updates[0]!.body },
    ]);
    expect(stepsOf(incidentOf({ incident_state: "resolved" }))!.current).toBe(3);
    expect(stepsOf({ ...d, kind: "release", incident_state: null })).toBeNull();
    expect(headSub({ ...d, kind: "release", state: "draft", published_at: null })).toBe(
      "リリース ・ 全部のワークスペース ・ 下書き",
    );
  });

  it("K980-UN-003 URL の絞り込み：すべて＝何も書かない・障害 kind=incident・メンテ kind=maintenance・リリース kind=release・下書き state=draft。知らない値は すべて", () => {
    expect(noticesQuery(new URLSearchParams(""))).toEqual({ chip: "all" });
    expect(noticesQuery(new URLSearchParams("kind=incident"))).toEqual({ chip: "incident" });
    expect(noticesQuery(new URLSearchParams("state=draft"))).toEqual({ chip: "draft" });
    expect(noticesQuery(new URLSearchParams("kind=urgent"))).toEqual({ chip: "all" });
    expect(
      ["all", "incident", "maintenance", "release", "draft"].map((c) => noticesSearch({ chip: c as never })),
    ).toEqual(["", "?kind=incident", "?kind=maintenance", "?kind=release", "?state=draft"]);
  });

  it("K980-UN-004 続報の体：前後の空白を落とす・空（空白だけ）なら null・状態の選び肢 原因が分かった／様子を見ている／直った は identified／monitoring／resolved", () => {
    expect(updateBody({ step: "様子を見ている", body: "  動いています  " })).toEqual({
      state: "monitoring",
      body: "動いています",
    });
    expect(updateBody({ step: "原因が分かった", body: "x" })!.state).toBe("identified");
    expect(updateBody({ step: "直った", body: "直りました" })!.state).toBe("resolved");
    expect(updateBody({ step: "様子を見ている", body: "  \n " })).toBeNull();
  });

  it("K980-UN-005 障害でない 1 件の場所の字：メンテの下書きは「メンテの時間 11/10 02:00〜03:00」と「まだ出していません」・障害は時間なしで「お知らせの一覧 ・ 上の帯」・一覧だけのリリースは「お知らせの一覧」", () => {
    expect(placeView(maintOf())).toEqual({ maint: "メンテの時間 11/10 02:00〜03:00", where: "まだ出していません" });
    expect(placeView(incidentOf({ placements: ["list", "band"] }))).toEqual({
      maint: null,
      where: "お知らせの一覧 ・ 上の帯",
    });
    expect(placeView(incidentOf({ kind: "release", incident_state: null, placements: ["list"] })).where).toBe(
      "お知らせの一覧",
    );
  });
});
