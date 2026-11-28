// K-971「運営の 1 社の画面：タブ 5 つ」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-1006・K-1005 の形）→ 部品の値（features/F12/ops/ws-tenant-shape.ts）と、URL の tab の読み書き。
//   字は下絵（features/F12/ops/ops-sample.ts の MEMBERS・tenant-tabs.tsx の数と請求書と記録）が正。ブラウザ・口は使わない。
//   時刻の字は日本時間（Asia/Tokyo）。行 ID は 11_tickets/K-971.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  auditView,
  billingView,
  frameView,
  inquiryView,
  memberView,
  statusView,
  tabLabels,
  tabOf,
  tabSearch,
} from "../features/F12/ops/ws-tenant-shape";
import { MEMBERS } from "../features/F12/ops/ops-sample";
import { WS_AUDIT, WS_INQUIRIES, WS_MEMBERS, wsBillingOf, wsOf } from "../tests/k/ops-ws-answers";

describe("K-971 頭といまの状態", () => {
  it("K971-UN-001 頭と 4 つの数：名前・印「ミ」・使っている（success）・「チーム ・ 8 人」（人数は members.count・PC の数ではない）。PC 6 / 8・今月の実行 1,284（上限は持たないので sub なし・D-156.63）・止まった実行 3（先週は 0・warn）・ファイル 2.1 GB（上限の sub なし）。最近のことの 2 行目は口の detail（無ければ無し・D-156.47）。止めている会社は「止めている（MM/DD〜）」danger", () => {
    const f = frameView(wsOf());
    expect([f.name, f.mark, f.status, f.tone, f.sub]).toEqual([
      "合同会社ミナト企画",
      "ミ",
      "使っている",
      "success",
      "チーム ・ 8 人",
    ]);
    // 人数は members.count（PC の数ではない・PM の決め 2026-11-25）
    expect(frameView(wsOf({ members: { count: 9 }, pc: { connected: 2, total: 3 } })).sub).toBe("チーム ・ 9 人");
    expect(frameView(wsOf({ members: { count: 9 }, pc: null })).sub).toBe("チーム ・ 9 人");
    const s = statusView(wsOf());
    expect(s.stats).toEqual([
      { label: "PC がつながる人", value: "6 / 8" },
      { label: "今月の実行", value: "1,284" },
      { label: "止まった実行", value: "3", sub: "この 7 日 ・ 先週は 0", tone: "warn" },
      { label: "ファイル", value: "2.1 GB" },
    ]);
    expect(s.recent.map((r) => [r.at, r.text, r.detail])).toEqual([
      ["11/02 09:40", "問い合わせ「承認したのに動かない」が届いた", "湊 さくら ・ 担当 高本"],
      ["11/01 09:00", "10 月分の請求書を出した ¥16,500", "期限 11/30"],
      ["10/28 15:20", "9 月分の入金を記録した", "佐野"],
      ["10/15 10:00", "メンバーが 1 人増えた（8 人）", undefined],
    ]);
    const st = frameView(
      wsOf({
        state: "stopped",
        stop: { reason_key: "unpaid", stop_on: "2026-11-09", stopped_at: "2026-11-08T15:00:00Z", noticed_at: null },
      }),
    );
    expect([st.status, st.tone]).toEqual(["止めている（11/09〜）", "danger"]);
  });
});

describe("K-971 タブの字", () => {
  it("K971-UN-002 メンバー：下絵の 5 行と同じ字（役割・最後に入った・PC・ログイン・メール・頭文字）。送り直せるのは確かめていない人だけ", () => {
    const got = WS_MEMBERS.map(memberView);
    expect(
      got.map(({ canResend: _c, id: _i, ...r }) => {
        void _c;
        void _i;
        return r;
      }),
    ).toEqual(
      MEMBERS.map((x) => ({
        initial: x.initial,
        name: x.name,
        mail: x.mail,
        role: x.role,
        last: x.last,
        pc: x.pc,
        login: x.login,
      })),
    );
    expect(got.map((r) => r.canResend)).toEqual([false, false, true, true, false]);
  });

  it("K971-UN-003 プランと請求：¥15,000・人数 8 / 10（80%）・請求書は 月・金額・出した日・期限・状態（お支払い待ち warning／払われた success／期限を過ぎた danger）・入金の日", () => {
    const b = billingView(wsBillingOf());
    expect([b.price, b.people, b.peoplePct]).toEqual(["¥15,000", "8 / 10", 80]);
    expect(b.bills[0]).toEqual({
      month: "10 月分",
      amount: "¥16,500",
      issued: "11/01",
      due: "11/30",
      state: "お支払い待ち",
      tone: "warning",
      paid: null,
    });
    expect(b.bills[1]).toEqual({
      month: "9 月分",
      amount: "¥16,500",
      issued: "10/01",
      due: "10/31",
      state: "払われた",
      tone: "success",
      paid: "10/28",
    });
    const over = billingView({ ...wsBillingOf(), invoices: [{ ...wsBillingOf().invoices[0]!, state: "overdue" }] });
    expect([over.bills[0]!.state, over.bills[0]!.tone]).toEqual(["期限を過ぎた", "danger"]);
    expect(billingView({ ...wsBillingOf(), members: { count: 3, limit: null } }).people).toBe("3");
  });

  it("K971-UN-004 問い合わせと記録：種類（使い方・うまく動かない・お金・プラン・ほか）・状態（進行中・返事待ち・後で・済み）・届いた（MM/DD HH:mm）。記録は「<人> が <操作>」と理由・対象の字", () => {
    expect(WS_INQUIRIES.map(inquiryView).map((q) => [q.kind, q.state, q.owner, q.at])).toEqual([
      ["うまく動かない", "進行中", "高本", "11/02 09:40"],
      ["お金・プラン", "済み", "佐野", "10/20 10:00"],
      ["お金・プラン", "済み", "佐野", "10/14 10:00"],
    ]);
    expect(inquiryView({ ...WS_INQUIRIES[0]!, topic: "usage", state: "waiting", owner_name: null }).owner).toBe("—");
    const a = WS_AUDIT.map(auditView);
    expect(a[0]).toEqual({
      at: "11/02 10:12",
      who: "高本",
      text: "が 中を見た",
      detail: "理由：問い合わせ「承認したのに動かない」",
    });
    expect(a[3]).toEqual({
      at: "04/03 11:05",
      who: "高本",
      text: "が 代わりにプランを変えた（無料 → チーム）",
      detail: "理由：問い合わせ「プランを上げたい」",
    });
  });

  it("K971-UN-005 URL の tab：status・members・billing・inquiries・log だけ。知らない値は status。書くときは status を書かない", () => {
    expect(["status", "members", "billing", "inquiries", "log", "gone", null].map((v) => tabOf(v))).toEqual([
      "status",
      "members",
      "billing",
      "inquiries",
      "log",
      "status",
      "status",
    ]);
    expect(tabSearch("status")).toBe("");
    expect(tabSearch("log")).toBe("?tab=log");
  });

  it("K971-UN-006 タブの字：下絵と同じ「いまの状態」「メンバー 8」「プランと請求」「問い合わせ 1」「記録」。数は 1 社の答えの members.count と inquiries.open（問い合わせのタブを開く前から出る）。0 なら数を付けない", () => {
    expect(tabLabels(wsOf())).toEqual({
      status: "いまの状態",
      members: "メンバー 8",
      billing: "プランと請求",
      inquiries: "問い合わせ 1",
      log: "記録",
    });
    const zero = tabLabels(wsOf({ members: { count: 0 }, inquiries: { open: 0 } }));
    expect([zero.members, zero.inquiries]).toEqual(["メンバー", "問い合わせ"]);
    expect(tabLabels(wsOf({ inquiries: { open: 12 } })).inquiries).toBe("問い合わせ 12");
  });
});
