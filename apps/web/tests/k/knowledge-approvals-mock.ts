// 「管理 › 承認待ち」（K-694）の試験の道具：K-682 の knowledge-mock.ts（木・ページ）の上に、口を 3 本足して網の手前で差し替える。
//   listKnowledgeApprovals（GET /knowledge/approvals）・approveKnowledgeRequest（POST /knowledge/requests/:id/approve）・declineKnowledgeRequest（POST /knowledge/requests/:id/decline）。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-688 の md。名前・字・数は下絵 v2 の見本（features/F9/knowledge/samples.tsx の APPROVALS）と同じ。
//   mockKnowledge のあとに呼ぶ（あとから足した道が先に当たり、知らない道は前の道具に戻る）。固定の待ちは使わない（hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import { H2, P, doc, textOf, uid, type Doc, type KMock, type Reply } from "./knowledge-mock";

export const A1 = uid(0xc201);
export const A2 = uid(0xc202);
export const A3 = uid(0xc203);

export interface ApprovalRow {
  id: string;
  kind: "raise" | "share";
  from_name: string;
  from_shelf_name: string;
  to_shelf_name: string;
  title: string;
  desc: string;
  message: string | null;
  requested_at: string;
  similar: { page_id: string; title: string; place: string } | null;
  body: { doc: Doc; text: string } | null;
}
const bodyOf = (d: Doc) => ({ doc: d, text: textOf(d) });
const DISCOUNT = doc(H2("その場で返してよい範囲"), P("5% までは、その場で「できます」と返してよい。"));
const DELIVERY = doc(H2("納品の前に"), P("開発と営業の両方で、納品物を見て確かめる。"));
const ESTIMATE = doc(H2("順番"), P("見積書は、宛先を確かめてから作る。"));

/** 下絵 kn-approvals と同じ 3 件：上げる（似たページあり）・共有・上げる */
export const approvalRows = (): ApprovalRow[] => [
  {
    id: A1,
    kind: "raise",
    from_name: "鈴木 一郎",
    from_shelf_name: "鈴木さんの「自分」",
    to_shelf_name: "営業",
    title: "値引きを頼まれたときの返し方",
    desc: "お客さまから値引きを頼まれたとき、その場で返してよい範囲と、持ち帰る範囲。",
    message: "新しく入った人にも同じ返し方をしてほしいので、営業の棚に上げたいです",
    requested_at: "2026-11-21T07:20:00Z",
    similar: { page_id: uid(0xa007), title: "値引きの決まり", place: "営業 › 見積もり" },
    body: bodyOf(DISCOUNT),
  },
  {
    id: A2,
    kind: "share",
    from_name: "受託開発（田中 美咲）",
    from_shelf_name: "受託開発",
    to_shelf_name: "営業にも見せる",
    title: "納品の前の確かめ",
    desc: "納品の前に、開発と営業の両方で確かめること。",
    message: "営業の人も、お客さまに渡す前に同じ確かめをしてほしいです",
    requested_at: "2026-11-21T01:05:00Z",
    similar: null,
    body: bodyOf(DELIVERY),
  },
  {
    id: A3,
    kind: "raise",
    from_name: "木村 誠",
    from_shelf_name: "木村さんの「自分」",
    to_shelf_name: "営業",
    title: "見積もりの出し方（自分のやり方）",
    desc: "見積書を早く出すための、自分なりの順番。",
    message: null,
    requested_at: "2026-11-20T09:42:00Z",
    similar: null,
    body: bodyOf(ESTIMATE),
  },
];

export type AOp = "list" | "approve" | "decline";
export interface ACall {
  op: AOp;
  id: string | undefined;
  body: Record<string, unknown>;
  key: string | undefined;
}
export interface AMock {
  calls: ACall[];
  count: (op: AOp) => number;
  /** 口が返す承認待ち（承認・断るが消す。試験が足したり引いたりしてよい） */
  rows: ApprovalRow[];
  script: (op: AOp, ...replies: (Reply | "network")[]) => void;
  hold: (op: AOp) => () => void;
}

export async function mockApprovals(page: Page, mk: KMock): Promise<AMock> {
  const scripted = new Map<AOp, (Reply | "network")[]>();
  const gates = new Map<AOp, Promise<void>>();
  const a: AMock = {
    calls: [],
    count: (op) => a.calls.filter((c) => c.op === op).length,
    rows: approvalRows(),
    script: (op, ...x) => scripted.set(op, [...(scripted.get(op) ?? []), ...x]),
    hold: (op) => {
      let open = (): void => undefined;
      gates.set(op, new Promise<void>((res) => (open = res)));
      return () => {
        open();
        gates.delete(op);
      };
    },
  };
  mk.tree.admin_counts = { approvals: a.rows.length, review: 3 };
  await page.route(
    /\/api\/v1\/knowledge(\/approvals|\/requests\/[^/?]+\/(approve|decline))(\?|$)/,
    async (route: Route, req: Request) => {
      const seg = new URL(req.url()).pathname.replace("/api/v1", "").split("/").filter(Boolean);
      const m = req.method();
      const op: AOp | null =
        seg[1] === "approvals" && m === "GET"
          ? "list"
          : seg[1] === "requests" && seg[3] === "approve" && m === "POST"
            ? "approve"
            : seg[1] === "requests" && seg[3] === "decline" && m === "POST"
              ? "decline"
              : null;
      if (!op) return route.fallback();
      const id = op === "list" ? undefined : seg[2];
      const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
      a.calls.push({ op, id, body: raw, key: req.headers()["idempotency-key"] });
      const gate = gates.get(op);
      if (gate) await gate;
      const next = scripted.get(op)?.shift();
      const send = (x: Reply) =>
        route.fulfill({ status: x.status, contentType: "application/json", body: JSON.stringify(x.body) });
      if (next === "network") return route.abort("failed");
      if (next) return send(next);
      if (op === "list") return send({ status: 200, body: { data: a.rows, meta: { count: a.rows.length } } });
      const row = a.rows.find((r) => r.id === id);
      if (!row) return send({ status: 404, body: { error: "e-page-001", code: "E-PAGE-001" } });
      a.rows = a.rows.filter((r) => r.id !== id);
      mk.tree.admin_counts = { approvals: a.rows.length, review: mk.tree.admin_counts?.review ?? 0 };
      return send({
        status: 200,
        body: {
          data: {
            id,
            kind: row.kind,
            state: op === "approve" ? "approved" : "declined",
            page_id: null,
            folder_id: null,
          },
        },
      });
    },
  );
  return a;
}
