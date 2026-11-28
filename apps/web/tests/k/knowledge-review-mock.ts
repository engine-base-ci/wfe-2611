// 「管理 › 見直すページ」（K-696）の試験の道具：K-682 の knowledge-mock.ts（木・ページ）の上に、口を 1 本足して網の手前で差し替える。
//   getKnowledgeReview（GET /knowledge/review）。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-695 の md（unused・conflicts・broken の 3 つの並び）。
//   名前・字・数は下絵 v2 の見本（features/F9/knowledge/samples.tsx の UNUSED・CONFLICTS・BROKEN）と同じ。
//   「並べて見る」が読む 2 つのページ（上＝会社の「請求書の送り方」・下＝営業の「見積書の出し方」）は knowledge-mock.ts の page の口に置く（pageUpper・pageLower）。
//   mockKnowledge のあとに呼ぶ（あとから足した道が先に当たり、知らない道は前の道具に戻る）。固定の待ちは使わない（hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import {
  H2,
  P,
  P_INVOICE,
  P_QUOTE,
  doc,
  pageInvoice,
  textOf,
  uid,
  type KMock,
  type PageAnswer,
  type Reply,
} from "./knowledge-mock";

export const U1 = uid(0xd601);
export const U2 = uid(0xd602);
export const U3 = uid(0xd603);
export const U4 = uid(0xd604);
export const B1 = uid(0xd611);
export const B2 = uid(0xd612);
export const B3 = uid(0xd613);

export interface ReviewAnswer {
  unused: { id: string; title: string; place: string; last_opened_at: string | null }[];
  conflicts: {
    id: string;
    upper: { id: string; title: string; place: string };
    lower: { id: string; title: string; place: string };
    point: string;
  }[];
  broken: { id: string; title: string; place: string; count: number; how: string }[];
}

/** 下絵 kn-review と同じ 4・1・3 件（場所の字は下絵のとおり。口が返す字をそのまま出すことを見る） */
export const reviewAnswer = (): ReviewAnswer => ({
  unused: [
    { id: U1, title: "年賀状の送り先", place: "会社 › お客さま対応", last_opened_at: "2025-12-20T03:00:00Z" },
    { id: U2, title: "旧：見積書のひな形（2024）", place: "グループ：営業 › 見積もり", last_opened_at: null },
    { id: U3, title: "展示会の持ち物", place: "グループ：営業", last_opened_at: "2026-06-02T03:00:00Z" },
    { id: U4, title: "名刺の発注のしかた", place: "会社", last_opened_at: "2026-07-15T03:00:00Z" },
  ],
  conflicts: [
    {
      id: `${P_INVOICE}:${P_QUOTE}`,
      upper: { id: P_INVOICE, title: "請求書の送り方", place: "会社 › 経理" },
      lower: { id: P_QUOTE, title: "見積書の出し方", place: "グループ：営業 › 見積もり" },
      point: "支払期日：会社は「月末締め・翌月末払い」、営業は「月末締め・翌々月 10 日払い」と書いてあります",
    },
  ],
  broken: [
    {
      id: B1,
      title: "メールの書き方",
      place: "会社",
      count: 7,
      how: "いちばん多い：件名に【 】の種類が入っていない（5 回）",
    },
    {
      id: B2,
      title: "外に出す前の確かめ",
      place: "会社",
      count: 3,
      how: "いちばん多い：添付のファイル名に取引先の名前が無い（2 回）",
    },
    {
      id: B3,
      title: "値引きの決まり",
      place: "グループ：営業 › 見積もり",
      count: 2,
      how: "いちばん多い：5% を超える値引きを、承認の前に書いた（2 回）",
    },
  ],
});

const UPPER_DOC = doc(H2("支払期日"), P("月末締め・翌月末払い。"));
const LOWER_DOC = doc(H2("支払期日"), P("月末締め・翌々月 10 日払い。"));
/** 並べて見る：上のページ（会社の請求書の送り方）と下のページ（営業の見積書の出し方） */
export const pageUpper = (): PageAnswer =>
  pageInvoice({ body: { doc: UPPER_DOC, text: textOf(UPPER_DOC) }, acts: ["must-off", "edit"] });
export const pageLower = (): PageAnswer =>
  pageInvoice({
    id: P_QUOTE,
    title: "見積書の出し方",
    desc: "見積書を出す順番と、支払の条件。",
    must: false,
    place: { shelf: "group", shelf_name: "営業", group_id: null, folder_id: null, folders: ["見積もり"] },
    acts: ["must-on", "edit"],
    body: { doc: LOWER_DOC, text: textOf(LOWER_DOC) },
  });
/** 「直す」が出ない（書けない）ページ：書き方を直すを押しても読む形のまま */
export const pageReadOnly = (id: string): PageAnswer =>
  pageInvoice({ id, title: "メールの書き方", must: true, acts: [] });

export type ROp = "review";
export interface RCall {
  op: ROp;
  at: number;
}
export interface RMock {
  calls: RCall[];
  count: (op: ROp) => number;
  /** 口が返す 3 つの並び（試験が足したり引いたりしてよい。木の admin_counts.review は合計に合わせて直す） */
  answer: ReviewAnswer;
  script: (...replies: (Reply | "network")[]) => void;
  hold: () => () => void;
  /** 木の管理の数を今の 3 つの並びの長さの合計に合わせる */
  syncCount: () => void;
}

export async function mockReview(page: Page, mk: KMock): Promise<RMock> {
  const scripted: (Reply | "network")[] = [];
  let gate: Promise<void> | null = null;
  const r: RMock = {
    calls: [],
    count: () => r.calls.length,
    answer: reviewAnswer(),
    script: (...x) => void scripted.push(...x),
    hold: () => {
      let open = (): void => undefined;
      gate = new Promise<void>((res) => (open = res));
      return () => {
        open();
        gate = null;
      };
    },
    syncCount: () => {
      mk.tree.admin_counts = {
        approvals: mk.tree.admin_counts?.approvals ?? 1,
        review: r.answer.unused.length + r.answer.conflicts.length + r.answer.broken.length,
      };
    },
  };
  mk.tree.admin_counts = { approvals: 1, review: 8 };
  await page.route(/\/api\/v1\/knowledge\/review(\?|$)/, async (route: Route, req: Request) => {
    if (req.method() !== "GET") return route.fallback();
    r.calls.push({ op: "review", at: Date.now() });
    if (gate) await gate;
    const next = scripted.shift();
    if (next === "network") return route.abort("failed");
    const send = (x: Reply) =>
      route.fulfill({ status: x.status, contentType: "application/json", body: JSON.stringify(x.body) });
    if (next) return send(next);
    return send({ status: 200, body: { data: r.answer } });
  });
  return r;
}
