// 「グループを選んで共有」と「写して直す」（K-693）の試験の道具：K-682 の knowledge-mock.ts（木・ページ）の上に、口を 3 本足して網の手前で差し替える。
//   getKnowledgeShares（GET /knowledge/shares?page_id=）・setKnowledgeShares（PUT /knowledge/shares）・copyKnowledgePage（POST /knowledge_pages/:id/copy）。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-689・K-690 の md。mockKnowledge のあとに呼ぶ（あとから足した道が先に当たり、知らない道は前の道具に戻る）。
//   固定の待ちは使わない（hold() で止める）。テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import { G_DEV, G_SALES, P_QUOTE, pageInvoice, uid, type KMock, type PageAnswer, type Reply } from "./knowledge-mock";

export const G_KEIRI = uid(0xe003);
export const G_LAW = uid(0xe004);
export const G_HR = uid(0xe005);
export const P_COPY = uid(0xa0d0);
export const F_QUOTE = uid(0xf003);

export type ShareState = "shared" | "waiting" | "declined" | null;
export interface ShareGroup {
  group_id: string;
  name: string;
  manager_name: string;
  checked: boolean;
  state: ShareState;
}
/** 下絵 kn-share と同じ並び：受託開発・経理・法務（共有中）・人事（マネージャーがいない） */
export const shareGroups = (): ShareGroup[] => [
  { group_id: G_DEV, name: "受託開発", manager_name: "田中 美咲", checked: false, state: null },
  { group_id: G_KEIRI, name: "経理", manager_name: "山口 恵", checked: false, state: null },
  { group_id: G_LAW, name: "法務", manager_name: "木下 浩", checked: true, state: "shared" },
  { group_id: G_HR, name: "人事", manager_name: "", checked: false, state: null },
];

/** 営業のグループの棚のページ（マネージャーの佐藤さんが開く・共有できる） */
export const quotePage = (over: Partial<PageAnswer> = {}): PageAnswer =>
  pageInvoice({
    id: P_QUOTE,
    title: "見積書の出し方",
    desc: "見積書を早く出すための順番と、出す前の確かめ。",
    must: false,
    acts: ["must-on", "raise", "share", "edit"],
    place: { shelf: "group", shelf_name: "営業", group_id: G_SALES, folder_id: F_QUOTE, folders: ["見積もり"] },
    foot: { last_editor_name: "佐藤 花子", last_edited_at: "2026-11-20T03:00:00Z", version: 3, ai_opened_30d: 6 },
    ...over,
  });
/** 共有された側（受託開発の田中さん）が開く同じページ：読むだけ・主のボタンは「写して直す」 */
export const sharedViewPage = (over: Partial<PageAnswer> = {}): PageAnswer =>
  quotePage({
    acts: ["copy"],
    shared_from: { group_name: "営業", writable: false, manager_names: ["佐藤 花子"] },
    ...over,
  });
export const copiedFrom = (over: Record<string, unknown> = {}) => ({
  page_id: P_QUOTE,
  title: "見積書の出し方",
  shelf_name: "営業",
  folders: ["見積もり"],
  must: false,
  gone: false,
  ...over,
});

export type SOp = "shares" | "setShares" | "copy";
export interface SCall {
  op: SOp;
  id: string | undefined;
  query: Record<string, string>;
  body: Record<string, unknown>;
  key: string | undefined;
}
export interface SMock {
  calls: SCall[];
  count: (op: SOp) => number;
  /** 読む口の答えの元（setShares が書き換える） */
  groups: ShareGroup[];
  /** ここに入れたグループへ足すと、承認を待たずその場で共有になる（呼んだ人が相手のマネージャーでもあるとき） */
  immediate: Set<string>;
  script: (op: SOp, ...replies: (Reply | "network")[]) => void;
  hold: (op: SOp) => () => void;
}

export async function mockShare(page: Page, mk: KMock): Promise<SMock> {
  const scripted = new Map<SOp, (Reply | "network")[]>();
  const gates = new Map<SOp, Promise<void>>();
  const s: SMock = {
    calls: [],
    count: (op) => s.calls.filter((c) => c.op === op).length,
    groups: shareGroups(),
    immediate: new Set(),
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
  const readAnswer = (pageId: string) => ({
    data: {
      target: { page_id: pageId, folder_id: null, title: mk.pages.get(pageId)?.title ?? "" },
      from_group_name: "営業",
      groups: s.groups,
    },
  });
  await page.route(/\/api\/v1\/knowledge(\/shares|_pages\/[^/?]+\/copy)(\?|$)/, async (route: Route, req: Request) => {
    const url = new URL(req.url());
    const seg = url.pathname.replace("/api/v1", "").split("/").filter(Boolean);
    const m = req.method();
    const op: SOp | null =
      seg[1] === "shares" && m === "GET"
        ? "shares"
        : seg[1] === "shares" && m === "PUT"
          ? "setShares"
          : seg[0] === "knowledge_pages" && seg[2] === "copy" && m === "POST"
            ? "copy"
            : null;
    if (!op) return route.fallback();
    const id = op === "copy" ? seg[1] : undefined;
    const raw = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : {};
    s.calls.push({
      op,
      id,
      query: Object.fromEntries(url.searchParams),
      body: raw,
      key: req.headers()["idempotency-key"],
    });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    const send = (x: Reply) =>
      route.fulfill({ status: x.status, contentType: "application/json", body: JSON.stringify(x.body) });
    if (next === "network") return route.abort("failed");
    if (next) return send(next);
    if (op === "shares") return send({ status: 200, body: readAnswer(url.searchParams.get("page_id") ?? "") });
    if (op === "setShares") {
      const want = new Set((raw["group_ids"] as string[]) ?? []);
      s.groups = s.groups.map((g) => {
        const on = want.has(g.group_id);
        if (g.state === "shared" || g.state === "waiting") return on ? g : { ...g, checked: false, state: null };
        if (!on) return g;
        const now = s.immediate.has(g.group_id) ? "shared" : "waiting";
        return { ...g, checked: true, state: now };
      });
      return send({ status: 200, body: readAnswer(String(raw["page_id"] ?? "")) });
    }
    const orig = mk.pages.get(id!);
    if (!orig) return send({ status: 404, body: { error: "e-page-001", code: "E-PAGE-001" } });
    const copy = pageInvoice({
      id: P_COPY,
      title: orig.title,
      desc: orig.desc,
      must: false,
      acts: ["must-on", "edit"],
      place: { shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] },
      body: orig.body,
      copied_from: copiedFrom({ page_id: orig.id, title: orig.title }),
      foot: { last_editor_name: "田中 美咲", last_edited_at: "2026-11-22T03:00:00Z", version: 1, ai_opened_30d: 0 },
    });
    mk.pages.set(copy.id, copy);
    mk.tree.my_nodes = [...mk.tree.my_nodes, { kind: "page", id: copy.id, title: copy.title, mark: "copy" }];
    return send({
      status: 201,
      body: {
        data: { id: copy.id, title: copy.title, desc: copy.desc, state: "published", must: false, place: copy.place },
      },
    });
  });
  return s;
}
