// K-984「運営の請求の画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-1005 の形）→ 部品の値（features/F12/ops2/bills-shape.ts）と、URL の月・状態の読み書きと、入金の体。
//   字は下絵（features/F12/ops2/views-bills.tsx・ops2-sample.ts）が正（食い違いは 11_tickets/K-984.md の「下絵をそろえる」の後の字）。時刻は日本時間。
//   行 ID は 11_tickets/K-984.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  billRowView,
  billsQuery,
  billsSearch,
  issueView,
  monthOptions,
  payBody,
  payView,
  reverseBody,
  statsView,
} from "../features/F12/ops2/bills-shape";
import { BILLS_A, DRAFT_A, KITA_PAY, NOW } from "../tests/k/ops-bills-mock";

describe("K-984 一覧の字", () => {
  it("K984-UN-001 1 行：月・状態の字と色（期限を過ぎた N 日は danger・7 日以上は止める案の行き先・お支払い待ち ・ 期限 MM/DD は warning・払われた は success）・額は ¥ と 3 けた区切り・入金は合計か —", () => {
    const got = BILLS_A.map((r) => billRowView(r, NOW));
    expect(
      got.map(({ ws, plan, amount, state, tone, paid, canPay, stopHref }) => [
        ws,
        plan,
        amount,
        state,
        tone,
        paid,
        canPay,
        stopHref,
      ]),
    ).toEqual([
      [
        "北村デザイン事務所",
        "チーム",
        "¥16,500",
        "9 月分 期限を過ぎた 9 日",
        "danger",
        "—",
        true,
        `/ops/tenants/${BILLS_A[0]!.workspace.id}`,
      ],
      [
        "株式会社ハル製作所",
        "チーム",
        "¥33,000",
        "8 月分 期限を過ぎた 40 日",
        "danger",
        "—",
        true,
        `/ops/tenants/${BILLS_A[1]!.workspace.id}`,
      ],
      ["合同会社ミナト企画", "チーム", "¥16,500", "10 月分 お支払い待ち ・ 期限 11/30", "warning", "—", true, null],
      ["株式会社サクラ会計", "ビジネス", "¥44,000", "10 月分 払われた", "success", "¥44,000", false, null],
      ["株式会社オオタ物流", "ビジネス", "¥44,000", "10 月分 払われた", "success", "¥44,000", false, null],
    ]);
    const six = billRowView({ ...BILLS_A[0]!, due_on: "2026-11-03" }, NOW);
    expect([six.state, six.stopHref]).toEqual(["9 月分 期限を過ぎた 6 日", null]);
    expect(billRowView({ ...BILLS_A[2]!, paid_total: 10_000, difference: 6_500 }, NOW).paid).toBe(
      "¥10,000（差 ¥6,500）",
    );
    expect(billRowView({ ...BILLS_A[2]!, plan_name: null }, NOW).plan).toBe("—");
  });

  it("K984-UN-002 札と上の数：すべて・お支払い待ち・払われた・期限を過ぎた（前の月の分）の数と、月の合計（その月の行だけ）・お支払い待ちの件数・期限を過ぎた額", () => {
    const s = statsView(BILLS_A, "2026-10");
    expect(s.chips).toEqual([
      { key: "all", label: "すべて", count: 5 },
      { key: "unpaid", label: "お支払い待ち", count: 1 },
      { key: "paid", label: "払われた", count: 2 },
      { key: "overdue", label: "期限を過ぎた（前の月の分）", count: 2 },
    ]);
    expect(s.stats).toEqual([
      { label: "10 月分", value: "¥ 104,500", sub: "税込 ・ 3 件 ・ 無料は請求なし" },
      { label: "お支払い待ち", value: "1 件", sub: "期限 11/30 ・ 払われた 2 件" },
      { label: "期限を過ぎた", value: "¥ 49,500", sub: "2 件 ・ 前の月の分", tone: "danger" },
    ]);
    expect(statsView([], "2026-10").stats[2]).toEqual({
      label: "期限を過ぎた",
      value: "¥ 0",
      sub: "0 件",
      tone: "danger",
    });
  });

  it("K984-UN-003 月と状態の URL：知らない値は既定（月は日本の先月・状態はすべて）。既定は書かない・順は month・state。月の選び肢は先月から 12 か月（新しい順・「10 月分」）", () => {
    expect(billsQuery(new URLSearchParams("month=2026-09&state=overdue"), NOW)).toEqual({
      month: "2026-09",
      state: "overdue",
    });
    expect(billsQuery(new URLSearchParams("month=2026-13&state=late"), NOW)).toEqual({
      month: "2026-10",
      state: "all",
    });
    expect(billsSearch({ month: "2026-10", state: "all" }, NOW)).toBe("");
    expect(billsSearch({ month: "2026-09", state: "paid" }, NOW)).toBe("?month=2026-09&state=paid");
    expect(billsSearch({ month: "2026-10", state: "overdue" }, NOW)).toBe("?state=overdue");
    const o = monthOptions(NOW);
    expect(o).toHaveLength(12);
    expect(o.slice(0, 2)).toEqual([
      { value: "2026-10", label: "10 月分" },
      { value: "2026-09", label: "9 月分" },
    ]);
    expect(o[11]).toEqual({ value: "2025-11", label: "11 月分（2025 年）" });
  });
});

describe("K-984 小窓の字と体", () => {
  it("K984-UN-004 まとめて出す：ボタンは「<先月> 月分をまとめて出す」・確かめの題・件数・合計（¥ と区切り）・期限は月の翌月の末日（MM/DD）", () => {
    expect(issueView(DRAFT_A)).toEqual({
      title: "10 月分の請求書をまとめて出す",
      count: "46 件",
      total: "¥ 1,207,800",
      due: "期限 11/30",
    });
    expect(issueView({ ...DRAFT_A, month: "2026-12", count: 0, total: 0 }).due).toBe("期限 01/31");
  });

  it("K984-UN-005 入金の小窓：対象の字・これまでの入金の並び（入金日 MM/DD・額・名義・取り消し済み）・差（同じなら「差 ¥0 ・ 請求額と同じ → 払われた にする」・足りないなら赤の字・多いなら「請求額より多いです」の赤の字）。体は額（¥ と区切りを外した整数）・入金日・名義（空なら入れない）。額が読めなければ null。取り消しの体は同じ額・今日・reverses_payment_id", () => {
    const kita = BILLS_A[0]!;
    expect(payView(kita, "16500").target).toBe("北村デザイン事務所 ・ 9 月分 ¥16,500（期限 10/31）");
    expect(payView(kita, "16500").payments).toEqual([
      { id: KITA_PAY.id, paidOn: "11/01", amount: "¥16,500", payer: "キタムラデザイン", reversed: true },
    ]);
    expect(payView(BILLS_A[2]!, "16500").payments).toEqual([]);
    expect(reverseBody({ ...KITA_PAY, reversed: false }, NOW)).toEqual({
      amount: 16_500,
      paid_on: "2026-11-09",
      reverses_payment_id: KITA_PAY.id,
    });
    expect(payView(kita, "¥16,500")).toMatchObject({ diff: "差 ¥0 ・ 請求額と同じ → 払われた にする", alert: false });
    expect(payView(kita, "10000")).toMatchObject({
      diff: "差 ¥6,500 ・ 請求額より足りません。差を残して「お支払い待ち」のままにします",
      alert: true,
    });
    expect(payView(kita, "20000")).toMatchObject({
      diff: "差 ¥3,500 ・ 請求額より多いです。差を残して「お支払い待ち」のままにします",
      alert: true,
    });
    expect(payBody({ amount: "¥16,500", paidOn: "2026-11-02", payer: "キタムラデザイン" })).toEqual({
      amount: 16_500,
      paid_on: "2026-11-02",
      payer_name: "キタムラデザイン",
    });
    expect(payBody({ amount: "10000", paidOn: "2026-11-02", payer: "  " })).toEqual({
      amount: 10_000,
      paid_on: "2026-11-02",
    });
    expect(payBody({ amount: "1.5", paidOn: "2026-11-02", payer: "" })).toBeNull();
    expect(payBody({ amount: "1000", paidOn: "", payer: "" })).toBeNull();
  });
});
