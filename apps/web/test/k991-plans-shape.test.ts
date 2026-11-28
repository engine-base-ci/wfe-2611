// K-991「配るもの › プランの画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-987 の PlanOps・PlanHistoryRow・K-989 の影響）→ 部品の値（features/F12/ops2/plans-shape.ts）。
//   字は下絵（features/F12/ops2/views-plans.tsx・ops2-sample.ts の IMPACT_ROWS）が正。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-991.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { historyItem, impactView, planBox, reviewFacts, reviewHead } from "../features/F12/ops2/plans-shape";
import { IMPACT_ROWS } from "../features/F12/ops2/ops2-sample";
import { HISTORY_A, IMPACT_A, ME, PLANS_A, proposalOf, SANO } from "../tests/k/ops-plans-mock";

describe("K-991 箱と記録の字", () => {
  it("K991-UN-001 箱の字：3 つの箱の name・ver・places・price・rows・proposal（値段のあるプランは無料期間の行：0 は「なし」・N は「N 日」）", () => {
    expect(PLANS_A.map((p) => planBox(p))).toEqual([
      {
        name: "無料",
        ver: "v1",
        places: 21,
        price: "¥0",
        rows: [
          ["人数", "3 人まで"],
          ["使えるもの", "チケット・承認・ナレッジ"],
        ],
      },
      {
        name: "チーム",
        ver: "v1",
        places: 19,
        price: "¥15,000",
        rows: [
          ["人数", "10 人まで"],
          ["使えるもの", "＋ ゲストを招く"],
          ["無料期間", "なし"],
        ],
        proposal: "v2 ¥18,000 ・ 決める人を待っている",
      },
      {
        name: "ビジネス",
        ver: "v1",
        places: 8,
        price: "¥40,000",
        rows: [
          ["人数", "30 人まで"],
          ["使えるもの", "＋ ゲストのグループ"],
          ["無料期間", "なし"],
        ],
      },
    ]);
    expect(planBox({ ...PLANS_A[1]!, proposal: { ...PLANS_A[1]!.proposal!, state: "draft" } }).proposal).toBe(
      "v2 ¥18,000 ・ 下書き",
    );
    expect(planBox({ ...PLANS_A[2]!, trial_days: 14 }).rows.at(-1)).toEqual(["無料期間", "14 日"]);
  });

  it("K991-UN-002 記録の字：回した・差し戻した・作った・決めたの字と detail・時刻は日本時間", () => {
    const items = HISTORY_A.map((r) => historyItem(r));
    expect(items[0]).toEqual({
      at: "11/04 16:40",
      who: "佐野",
      text: "が チーム v2 の案を直して、決める人に回した",
      detail: "値段 ¥20,000 → ¥18,000 ・ 人数 10 → 12 人",
    });
    expect(items[1]).toEqual({
      at: "11/04 15:10",
      who: "高本",
      text: "が チーム v2 の案を差し戻した",
      detail: "理由：上げ幅が大きい。人数の上限を広げるなら考える",
    });
    expect(items[2]).toEqual({
      at: "11/04 11:20",
      who: "佐野",
      text: "が チーム v2 の案を作った",
      detail: "値段 ¥15,000 → ¥20,000",
    });
    expect(items[3]!.text).toBe("が ビジネス v1 を決めた");
  });
});

describe("K-991 影響と決める人の字", () => {
  it("K991-UN-003 影響の字：上の数 3 つ・行の字（止めている会社は「止めている／再開した月〜」）・ほか 15 か所", () => {
    const v = impactView(IMPACT_A, { price_monthly: 18000 });
    expect(v.stats).toEqual([
      { label: "いまのチームの顧客", value: "19 か所", sub: "止めている 1 を含む" },
      { label: "月の売上（税別）", value: "+ ¥57,000", sub: "2027 年 2 月分から" },
      { label: "新しく入る人", value: "12/01 から", sub: "¥18,000 で始まる" },
    ]);
    expect(v.rows.map(({ ws, people, now, after }) => ({ ws, people, now, after }))).toEqual([...IMPACT_ROWS]);
    expect(v.rest).toBe("ほか 15 か所も同じ");
    expect(
      impactView(
        { ...IMPACT_A, existing_from: null, monthly_revenue_diff: 0, new_from: null },
        { price_monthly: 18000 },
      ).stats.map((s) => s.sub),
    ).toEqual(["止めている 1 を含む", "変わらない", "¥18,000 で始まる"]);
  });

  it("K991-UN-004 決める人の字：90 日たった最初の月（2027 年 2 月分）から・ずっと今の値段のまま・決めたらすぐ・無料期間の前後・変えない無料期間は今の版の値・見出しの 2 行目", () => {
    const team = PLANS_A.find((x) => x.plan_key === "team")!;
    const f = reviewFacts(proposalOf(), IMPACT_A, team);
    expect(f.existing).toBe("お知らせから 90 日たった最初の月（2027 年 2 月分）から");
    expect(f.newcomer).toBe("12/01 から");
    expect(f.trial).toBe("なし（変えない）");
    expect(
      reviewFacts(
        proposalOf({
          before: { price_monthly: 15000, member_limit: 10, trial_days: 0 },
          changes: { price_monthly: 18000, member_limit: 12, trial_days: 14 },
        }),
        IMPACT_A,
        team,
      ).trial,
    ).toBe("なし → 14 日");
    expect(reviewFacts(proposalOf(), IMPACT_A, { ...team, trial_days: 30 }).trial).toBe("30 日（変えない）");
    expect(reviewHead(proposalOf(), ME.member_id)).toBe("決める人を待っている ・ 佐野 ・ 11/04 16:40 に回した");
    expect(reviewHead(proposalOf(), SANO.member_id)).toBe("自分が作った案 ・ 佐野 ・ 11/04 16:40 に回した");
    const keep = reviewFacts(
      proposalOf({ existing_policy: "keep", notice_days: null, new_from: null }),
      { ...IMPACT_A, existing_from: null },
      team,
    );
    expect([keep.existing, keep.newcomer]).toEqual(["ずっと今の値段のまま", "決めたらすぐ"]);
  });
});
