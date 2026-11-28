// 「上の棚に上げる」（K-692）の試験の道具：K-682 の knowledge-mock.ts（木・ページ）と K-691 の knowledge-must-mock.ts（似たページ）の上に、口を 3 本足して網の手前で差し替える。
//   requestKnowledgeRaise（POST /knowledge_pages/:id/raise）・withdrawKnowledgeRequest（DELETE /knowledge/requests/:id）・dismissKnowledgeRequest（POST /knowledge/requests/:id/dismiss）。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-687 の md。mockKnowledge と mockMustSimilar のあとに呼ぶ（あとから足した道が先に当たり、知らない道は前の道具に戻る）。
//   固定の待ちは使わない（hold() で止める）。テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import {
  G_SALES,
  doc,
  H2,
  P,
  pageInvoice,
  textOf,
  uid,
  type KMock,
  type PageAnswer,
  type Reply,
  type TNode,
} from "./knowledge-mock";

export const P_MINE = uid(0xa0c0);
export const P_TEAM = uid(0xa0c1);
export const REQ_ID = uid(0xc101);
const DISCOUNT = doc(H2("その場で返してよい範囲"), P("5% までは、その場で「できます」と返してよい。"));

/** 鈴木さんの自分の棚のページ（上げられる・先は営業のグループ・承認する人は佐藤さん） */
export const minePage = (over: Partial<PageAnswer> = {}): PageAnswer =>
  pageInvoice({
    id: P_MINE,
    title: "値引きを頼まれたときの返し方",
    desc: "お客さまから値引きを頼まれたとき、その場で返してよい範囲と、持ち帰る範囲。",
    must: false,
    acts: ["must-on", "raise", "edit"],
    place: { shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] },
    body: { doc: DISCOUNT, text: textOf(DISCOUNT) },
    raise_to: { shelf: "group", shelf_name: "営業", group_id: G_SALES, approver_names: ["佐藤 花子"] },
    foot: { last_editor_name: "鈴木 一郎", last_edited_at: "2026-11-21T03:00:00Z", version: 3, ai_opened_30d: 5 },
    ...over,
  });
/** 営業のグループの棚のページ（上げる先は会社・承認する人は管理者） */
export const teamPage = (over: Partial<PageAnswer> = {}): PageAnswer =>
  minePage({
    id: P_TEAM,
    title: "見積書の出し方",
    place: { shelf: "group", shelf_name: "営業", group_id: G_SALES, folder_id: null, folders: [] },
    raise_to: { shelf: "company", shelf_name: "会社", group_id: null, approver_names: ["高本 聖斗"] },
    ...over,
  });
export const waitingRequest = (over: Record<string, unknown> = {}) => ({
  id: REQ_ID,
  kind: "raise",
  state: "waiting",
  to_name: "営業",
  who_name: "佐藤 花子",
  at: "2026-11-21T07:20:00Z",
  reason: null,
  can_withdraw: true,
  ...over,
});
export const declinedRequest = (over: Record<string, unknown> = {}) => ({
  id: REQ_ID,
  kind: "raise",
  state: "declined",
  to_name: "営業",
  who_name: "佐藤 花子",
  at: "2026-11-22T00:10:00Z",
  reason: "営業 › 見積もり に「値引きの決まり」があります。「5% まで」の所だけ、そのページに足してください。",
  can_withdraw: false,
  ...over,
});

export type ROp = "raise" | "withdraw" | "dismiss";
export interface RCall {
  op: ROp;
  id: string | undefined;
  body: Record<string, unknown>;
  key: string | undefined;
}
export interface RMock {
  calls: RCall[];
  count: (op: ROp) => number;
  /** true なら、頼むとすぐ移る（承認する人が頼んだ人のとき・答えの state は approved） */
  immediate: boolean;
  script: (op: ROp, ...replies: (Reply | "network")[]) => void;
  hold: (op: ROp) => () => void;
}

const findNode = (nodes: TNode[], id: string): TNode | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const h = findNode(n.children ?? [], id);
    if (h) return h;
  }
  return undefined;
};

export async function mockRaise(page: Page, mk: KMock): Promise<RMock> {
  const scripted = new Map<ROp, (Reply | "network")[]>();
  const gates = new Map<ROp, Promise<void>>();
  const r: RMock = {
    calls: [],
    count: (op) => r.calls.filter((c) => c.op === op).length,
    immediate: false,
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
  const nodes = (): TNode[] => [
    ...mk.tree.company_nodes,
    ...mk.tree.my_nodes,
    ...mk.tree.groups.flatMap((g) => g.nodes),
  ];
  await page.route(
    /\/api\/v1\/knowledge(_pages\/[^/?]+\/raise|\/requests\/[^/?]+(\/dismiss)?)(\?|$)/,
    async (route: Route, req: Request) => {
      const path = new URL(req.url()).pathname.replace("/api/v1", "");
      const seg = path.split("/").filter(Boolean);
      const m = req.method();
      const op: ROp | null =
        seg[0] === "knowledge_pages" && seg[2] === "raise" && m === "POST"
          ? "raise"
          : seg[1] === "requests" && seg[3] === "dismiss" && m === "POST"
            ? "dismiss"
            : seg[1] === "requests" && !seg[3] && m === "DELETE"
              ? "withdraw"
              : null;
      if (!op) return route.fallback();
      const id = op === "raise" ? seg[1] : seg[2];
      const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
      r.calls.push({ op, id, body: raw, key: req.headers()["idempotency-key"] });
      const gate = gates.get(op);
      if (gate) await gate;
      const next = scripted.get(op)?.shift();
      const send = (x: Reply) =>
        route.fulfill({ status: x.status, contentType: "application/json", body: JSON.stringify(x.body) });
      if (next === "network") return route.abort("failed");
      if (next) return send(next);
      const notFound = { status: 404, body: { error: "e-page-001", code: "E-PAGE-001" } };
      if (op === "raise") {
        const p = mk.pages.get(id!);
        if (!p) return send(notFound);
        const toName = String((p.raise_to as { shelf_name?: string } | null)?.shelf_name ?? "営業");
        const node = findNode(nodes(), p.id);
        if (r.immediate) {
          p.place = { ...p.place, shelf: "group", shelf_name: toName, group_id: G_SALES };
          p.raise_to = null;
          if (node) {
            mk.tree.my_nodes = mk.tree.my_nodes.filter((n) => n.id !== p.id);
            mk.tree.groups[0]!.nodes.push(node);
          }
        } else {
          p.request = waitingRequest({ to_name: toName });
          p.acts = p.acts.filter((a) => a !== "raise");
          if (node) node.mark = "waiting";
        }
        return send({
          status: 201,
          body: {
            data: {
              id: REQ_ID,
              kind: "raise",
              state: r.immediate ? "approved" : "pending",
              page_id: p.id,
              to_name: toName,
              at: "2026-11-22T03:00:00Z",
            },
          },
        });
      }
      const p = [...mk.pages.values()].find((x) => (x.request as { id?: string } | null)?.id === id);
      if (!p) return send(notFound);
      p.request = null;
      if (!p.acts.includes("raise")) p.acts = [...p.acts.filter((a) => a !== "edit"), "raise", "edit"];
      const node = findNode(nodes(), p.id);
      if (node) node.mark = null;
      return send({
        status: 200,
        body: { data: { id, state: op === "withdraw" ? "withdrawn" : "declined" } },
      });
    },
  );
  return r;
}
