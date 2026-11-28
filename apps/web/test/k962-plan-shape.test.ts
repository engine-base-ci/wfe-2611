// K-962「プランを変える小窓と値段が変わるお知らせ（設定の「プランと支払い」の差し込み口）」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（listWorkspacePlans の data と meta）→ 部品の値（features/F12/billing/plan-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-962.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { changeText, confirmView, planRowLine, planViews } from "../features/F12/billing/plan-shape";

type PlanIn = Parameters<typeof planViews>[0][number];
const plan = (over: Partial<PlanIn> = {}): PlanIn =>
  ({
    plan_key: "team",
    name: "チーム",
    price_monthly: 15000,
    member_limit: 10,
    current: true,
    can_choose: false,
    effective_from: "2025-11-01",
    summary: "＋ ゲストを招く",
    recommended: false,
    upgrade: null,
    upcoming: null,
    ...over,
  }) as PlanIn;
const FREE = plan({
  plan_key: "free",
  name: "無料",
  price_monthly: 0,
  member_limit: 3,
  current: false,
  summary: "チケット・承認・ナレッジ",
});
const BIZ = plan({
  plan_key: "business",
  name: "ビジネス",
  price_monthly: 40000,
  member_limit: 30,
  current: false,
  can_choose: true,
  recommended: true,
  summary: "＋ ゲストのグループ",
  upgrade: { days: 9, amount: 7200, invoice_on: "2025-12-01" },
});
// 2025-11-22 12:00 日本時間
const NOW = Date.parse("2025-11-22T03:00:00Z");

describe("K-962 答え → 部品の値", () => {
  it("K962-UN-001 設定の 1 行：いまのプランの名前・上限・いまの人数・次の請求（日本時間の来月 1 日と値段）。無料は次の請求を書かない。月末の日本時間でも来月 1 日", () => {
    expect(planRowLine([FREE, plan(), BIZ], { members: 5, member_limit: 10 }, NOW)).toEqual({
      name: "チーム",
      line: "チーム ・ 10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000",
    });
    expect(
      planRowLine(
        [
          { ...FREE, current: true },
          { ...plan(), current: false },
        ],
        { members: 2, member_limit: 3 },
        NOW,
      ).line,
    ).toBe("無料 ・ 3 人まで ・ いま 2 人");
    // 2025-11-30 23:30 日本時間（UTC ではまだ 11/30 14:30）・2025-12-31 23:30 日本時間
    expect(planRowLine([plan()], { members: 5, member_limit: 10 }, Date.parse("2025-11-30T14:30:00Z")).line).toContain(
      "次の請求 12/01",
    );
    expect(planRowLine([plan()], { members: 5, member_limit: 10 }, Date.parse("2025-12-31T14:30:00Z")).line).toContain(
      "次の請求 01/01",
    );
  });

  it("K962-UN-002 プランの並び：値段は「¥15,000 ／月」で無料は「¥0」・上限と説明は「10 人まで ・ 説明」・いま・おすすめの印・id は plan_key", () => {
    expect(planViews([FREE, plan(), BIZ])).toEqual([
      { id: "free", name: "無料", price: "¥0", limit: "3 人まで ・ チケット・承認・ナレッジ" },
      {
        id: "team",
        name: "チーム",
        price: "¥15,000 ／月",
        limit: "10 人まで ・ ＋ ゲストを招く",
        current: true,
      },
      {
        id: "business",
        name: "ビジネス",
        price: "¥40,000 ／月",
        limit: "30 人まで ・ ＋ ゲストのグループ",
        recommended: true,
      },
    ]);
    expect(planViews([plan({ summary: "" })])[0]!.limit).toBe("10 人まで");
  });

  it("K962-UN-003 値段が変わるお知らせと確かめの字：変わる月・値段（税別）・人数・お知らせの日。予定が無ければ出さない。上げる確かめは残りの日数・金額・請求書の日、下げる確かめは変わる日", () => {
    expect(
      changeText(
        plan({ upcoming: { price_monthly: 18000, member_limit: 12, from_month: "2027-02", noticed_on: "2025-11-05" } }),
      ),
    ).toEqual({
      change: "2027 年 2 月分から ¥18,000（税別）・ 人数は 12 人まで に広がる。それまでは今のまま",
      noticeDate: "11/05",
    });
    expect(
      changeText(
        plan({ upcoming: { price_monthly: 15000, member_limit: 8, from_month: "2027-02", noticed_on: "2025-11-05" } }),
      )!.change,
    ).toBe("2027 年 2 月分から ¥15,000（税別）・ 人数は 8 人まで に変わる。それまでは今のまま");
    expect(changeText(plan())).toBeNull();
    expect(confirmView(BIZ)).toEqual({ mode: "up", plan: "ビジネス", days: 9, amount: "¥7,200", due: "12/01" });
    expect(confirmView({ ...FREE, can_choose: true, effective_from: "2025-12-01" })).toEqual({
      mode: "down",
      plan: "無料",
      from: "12/01",
    });
  });
});
