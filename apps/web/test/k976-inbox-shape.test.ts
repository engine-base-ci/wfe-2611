// K-976「運営の受信箱の画面」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（K-948 の形）→ 部品の値（features/F12/ops2/inbox-shape.ts）と、URL の箱・種類・1 件の読み書き。
//   字は下絵（features/F12/ops2/ops2-sample.ts の INBOX_ROWS・views-inbox.tsx）が正。時刻は日本時間。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-976.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { inboxQuery, inboxSearch, laterOf, messageView, rowView, sideView } from "../features/F12/ops2/inbox-shape";
import { INBOX_ROWS } from "../features/F12/ops2/ops2-sample";
import { detailOf, INBOX_A, ME } from "../tests/k/ops-inbox-mock";

const NOW = new Date("2026-11-02T01:00:00Z"); // 日本の 11/02 10:00

describe("K-976 一覧と 1 件の字", () => {
  it("K976-UN-001 一覧の 1 行：下絵の 3 行と同じ字（題・人・ワークスペース・届いた（今日は HH:mm・昨日は「昨日」・ほかは MM/DD）・種類・状態）。自分の担当の印", () => {
    const got = INBOX_A.map((r) => rowView(r, ME, NOW));
    const drop = <T extends { id: unknown }>({ id: _i, ...x }: T) => {
      void _i;
      return x;
    };
    expect(got.map(drop)).toEqual(INBOX_ROWS.map(drop));
    const free = rowView({ ...INBOX_A[0]!, owner: null, state: "later", topic: "other" }, ME, NOW);
    expect([free.mine, free.state, free.kind]).toEqual([false, "後で", "ほか"]);
    expect(rowView({ ...INBOX_A[0]!, state: "done", topic: "usage" }, ME, NOW).state).toBe("済み");
  });

  it("K976-UN-002 やり取りの字：customer は「<人> ・ HH:mm」、reply は「<人>（運営） ・ HH:mm」、note は社内メモの印。付いてきた情報は「画面 <道> ・ <ブラウザ> ・ PC つながっている」", () => {
    const d = detailOf();
    expect(d.messages.map((m) => messageView(m, NOW))).toEqual([
      { head: "湊 さくら ・ 09:40", body: d.messages[0]!.body, memo: false },
      { head: "高本（運営） ・ 09:58", body: d.messages[1]!.body, memo: true },
    ]);
    expect(messageView({ ...d.messages[1]!, kind: "reply" }, NOW).memo).toBe(false);
    expect(sideView(d).context).toBe("付いてきた情報：画面 /tickets/KN-212 ・ Chrome 130 ・ PC つながっている");
  });

  it("K976-UN-003 右の様子：プラン・人数・PC・止まった実行・請求（0 件は「期限を過ぎた請求なし」）の 5 行", () => {
    expect(sideView(detailOf()).rows).toEqual([
      ["プラン", "チーム ・ 8 人"],
      ["この人の PC", "つながっている"],
      ["止まった実行（7 日）", "3 件"],
      ["請求", "期限を過ぎた請求なし"],
    ]);
    expect(
      sideView({
        ...detailOf(),
        workspace_status: { plan_name: null, members: 2, pc: "never", stuck_runs: 0, overdue: 2 },
      }).rows,
    ).toEqual([
      ["プラン", "— ・ 2 人"],
      ["この人の PC", "まだつないでいない"],
      ["止まった実行（7 日）", "0 件"],
      ["請求", "期限を過ぎた請求 2 件"],
    ]);
  });
});

describe("K-976 URL と後で", () => {
  it("K976-UN-004 URL：box は unassigned（既定・書かない）・mine・waiting・later・done、topic は usage・trouble・billing・other、id は uuid の形だけ。知らない値は既定。書く順は box・topic・id", () => {
    expect(inboxQuery(new URLSearchParams("box=mine&topic=billing&id=0193c5a0-0000-7000-8000-000000009761"))).toEqual({
      box: "mine",
      topic: "billing",
      id: "0193c5a0-0000-7000-8000-000000009761",
    });
    expect(inboxQuery(new URLSearchParams("box=all&topic=bug&id=abc"))).toEqual({
      box: "unassigned",
      topic: null,
      id: null,
    });
    expect(inboxSearch({ box: "unassigned", topic: null, id: null })).toBe("");
    expect(inboxSearch({ box: "mine", topic: "billing", id: null })).toBe("?box=mine&topic=billing");
  });

  it("K976-UN-005 後での選び肢：明日の朝は翌日 9:00（日本時間）・来週は次の月曜 9:00。選び直しは null（後でを外す）", () => {
    expect(laterOf("tomorrow", NOW)).toBe("2026-11-03T09:00:00+09:00");
    expect(laterOf("week", NOW)).toBe("2026-11-09T09:00:00+09:00");
    expect(laterOf("none", NOW)).toBeNull();
  });
});
