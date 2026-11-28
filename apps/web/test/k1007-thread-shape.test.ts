// K-1007「問い合わせ 1 件のやり取り」の単体の試験（画面の外の、決まった形だけ）：getMyInquiry の答え → やり取りの部品の値
//   （features/F12/help/thread-shape.ts）。ブラウザ・口は使わない。行 ID は 11_tickets/K-1007.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { attachLine, replyProblem, threadView } from "../features/F12/help/thread-shape";

type In = Parameters<typeof threadView>[0];
const base = (over: Partial<In> = {}): In =>
  ({
    id: "q1",
    title: "PC をつけているのに実行待ちのまま",
    topic: "trouble",
    state: "replied",
    created_at: "2025-11-02T00:40:00Z",
    last_reply_at: "2025-11-02T01:15:00Z",
    has_unread_reply: true,
    context: {
      path: "/tickets/abc",
      screen: "チケット EG-128",
      browser: "Chrome 130",
      pc: true,
      at: "2025-11-02T00:38:00Z",
    },
    messages: [
      {
        id: "m1",
        from: "me",
        author_name: "高本 聖斗",
        body: "動きません",
        attachments: [],
        created_at: "2025-11-02T00:40:00Z",
      },
      {
        id: "m2",
        from: "ops",
        author_name: "Kaname 運営（佐野）",
        body: "預け直してください",
        attachments: [],
        created_at: "2025-11-02T01:15:00Z",
      },
    ],
    ...over,
  }) as In;

describe("K-1007 答え → やり取りの部品の値", () => {
  it("K1007-UN-001 見出し・何について・送った日時・状態（返事を待っている・返事あり・済み）・やり取りの並び（頭文字＝自分は名前の 1 字・運営は「運」・名前・日時・本文）", () => {
    const v = threadView(base());
    expect(v).toMatchObject({
      title: "PC をつけているのに実行待ちのまま",
      kind: "うまく動かない",
      sentAt: "11/02 09:40",
      state: "replied",
    });
    expect(v.done).toBeUndefined();
    expect(v.messages.map((m) => [m.from, m.initial, m.name, m.when, m.text])).toEqual([
      ["me", "高", "高本 聖斗", "11/02 09:40", "動きません"],
      ["ops", "運", "Kaname 運営（佐野）", "11/02 10:15", "預け直してください"],
    ]);
    expect(threadView(base({ state: "done" })).done).toBe(true);
    expect(threadView(base({ state: "waiting" })).state).toBe("waiting");
  });

  it("K1007-UN-002 付けた情報の行：最初の自分の書き込みだけに、画面の情報（画面・ブラウザ・PC・時刻）と付けたファイルの名前", () => {
    expect(attachLine(base().context, [])).toBe("画面 チケット EG-128 ・ Chrome 130 ・ PC つながっている（09:38）");
    expect(
      attachLine({ path: "/tickets/abc", browser: "Firefox 132", pc: false, at: "2025-11-02T00:38:00Z" }, []),
    ).toBe("画面 /tickets/abc ・ Firefox 132 ・ PC つながっていない（09:38）");
    expect(attachLine(null, [{ id: "a", name: "写し.png", size: 10 }])).toBe("ファイル 写し.png");
    expect(attachLine(null, [])).toBeUndefined();
    const v = threadView(
      base({
        messages: [
          {
            id: "m1",
            from: "me",
            author_name: "高本 聖斗",
            body: "1",
            attachments: [{ id: "a", name: "写し.png", size: 10 }],
            created_at: "2025-11-02T00:40:00Z",
          },
          {
            id: "m3",
            from: "me",
            author_name: "高本 聖斗",
            body: "2",
            attachments: [],
            created_at: "2025-11-02T01:40:00Z",
          },
        ],
      }),
    );
    expect(v.messages[0]!.attach).toBe(
      "画面 チケット EG-128 ・ Chrome 130 ・ PC つながっている（09:38） ・ ファイル 写し.png",
    );
    expect(v.messages[1]!.attach).toBeUndefined();
  });

  it("K1007-UN-003 返事の確かめ：空・空白だけ（全角も）は「返事を書いてください」・4001 字は「返事は 4000 字までです」・4000 字は通る", () => {
    expect(replyProblem("　\n")).toBe("返事を書いてください");
    expect(replyProblem("あ".repeat(4001))).toBe("返事は 4000 字までです");
    expect(replyProblem("あ".repeat(4000))).toBeNull();
  });
});
