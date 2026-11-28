// 詳細の「子チケット・つながり」（/tickets/[id]・K-452 が持つ）の画面の試験の共通の道具。
//   前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi（詳細・外枠の口）の上に、つながりの口を網の手前で重ねる：
//     GET    /api/v1/tickets/:id/links        → { data: [つながり], meta: { limit, children: [子] } }（K-441。子は meta.children に載せてもらう・K-452 の md の「子の一覧の読み口」）
//     POST   /api/v1/tickets/:id/links        ← { other_ticket_id, kind: "related"|"derived_from" }（頭 Idempotency-Key）→ 201 { data: つながり }（K-441）
//     DELETE /api/v1/ticket_links/:id         → 200 { data: { id } }（K-441）
//     GET    /api/v1/tickets?view=all&q=…     → 一覧の口 listTickets（K-92・前からある）。足す小窓の候補を探す
//     GET    /api/v1/scopes                   → グループ（番号の頭 EG・JD・KR から候補のグループの名前を引く）
//   つながり 1 件の形は K-441 の toLink：{ id, kind, side, other: { id, number, title, stage: { id, key, name }, scope: { id, name }, visible }, can_remove, created_at }。
//   見えない相手は other の id・title・stage・scope が null・visible が false（番号だけ）。side は派生元の行だけ："derived"＝このチケットの派生元・"source"＝このチケットから派生した。
//   本人の Bridge（127.0.0.1:38617）は、土台 mockApi の外枠の口と同じく届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  API_RE,
  TICKET,
  mockApi,
  openTicket,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";
import { matchMock, type MatchOptions } from "./stage2-match";
import { FORBIDDEN_TEXT, conflict, failed, forbidden, matchTicket, msg } from "./test-spec-mock";

export { FORBIDDEN_TEXT, conflict, failed, forbidden, msg, TICKET };
export const WIDTHS = [375, 768, 1440] as const;
const T0 = "2026-11-20T01:00:00Z";

export interface StageApi {
  id: string;
  key: string;
  name: string;
}
export const DOING: StageApi = { id: "st-doing", key: "doing", name: "作業中" };
export const DONE: StageApi = { id: "st-done", key: "done", name: "完了" };
export const TODO: StageApi = { id: "st-todo", key: "todo", name: "未着手" };
export const SCOPES = [
  { id: "sc-eg", name: "営業", ticket_prefix: "EG" },
  { id: "sc-jd", name: "受託開発", ticket_prefix: "JD" },
  { id: "sc-kr", name: "経理", ticket_prefix: "KR" },
];

/** 見えるチケット 1 つ（相手・子・候補） */
export interface TicketApi {
  id: string;
  number: string;
  title: string;
  stage: StageApi;
  /** 今のグループ（K-560 が一覧の行に足す scope）。無ければ番号の頭から引く（移していないチケット） */
  scope?: { id: string; name: string };
}
const t = (n: number, number: string, title: string, stage: StageApi): TicketApi => ({
  id: `6c000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  number,
  title,
  stage,
});
/** モック f4-links と同じ人たち（番号・題名・段） */
export const C1 = t(1, "EG-120", "回答の下書きを作る", DOING);
export const C2 = t(2, "EG-121", "保守の範囲を確かめる", DONE);
export const SRC = t(3, "EG-110", "山田様からの問い合わせを受ける", DONE);
export const REL = t(4, "JD-150", "京蟻 保守運用（年間）", DOING);
export const EG97 = t(5, "EG-097", "セイコー様 保守契約の見積", DONE);
export const KR31 = t(6, "KR-031", "入金の照合（11月分）", TODO);
/** 番号の頭は営業（EG）のまま、今のグループは経理に移したチケット（候補のグループ名は番号でなく scope を使う） */
export const MOVED: TicketApi = {
  id: "6c000000-0000-4000-8000-0000000000a1",
  number: "EG-099",
  title: "移した確認の件",
  stage: TODO,
  scope: { id: "sc-kr", name: "経理" },
};
export const OTHER = t(7, "EG-140", "この件から生まれた確認", TODO);
/** モック f4-links-variants の派生先（このチケットから生まれた物） */
export const EG130 = t(9, "EG-130", "回答の控えを台帳に残す", TODO);
/** いま開いている詳細のチケット自身（土台 mockApi の getTicket と同じ id・番号・題名）。足す小窓の候補に出てはいけない */
export const SELF: TicketApi = { id: TICKET, number: "EG-133", title: "11 月分の請求書を送る", stage: DOING };
export const CATALOG: TicketApi[] = [C1, C2, SRC, REL, EG97, KR31, OTHER, EG130, MOVED, SELF];

export interface LinkApi {
  id: string;
  kind: "related" | "derived_from";
  side: "derived" | "source" | null;
  other: {
    id: string | null;
    number: string;
    title: string | null;
    stage: StageApi | null;
    scope: { id: string; name: string } | null;
    visible: boolean;
  };
  can_remove: boolean;
  created_at: string;
}
const scopeOf = (number: string) => {
  const s = SCOPES.find((x) => x.ticket_prefix === number.split("-")[0]);
  return s ? { id: s.id, name: s.name } : null;
};
let seq = 0;
/** つながり 1 件（見える相手） */
export function link(kind: LinkApi["kind"], other: TicketApi, o: Partial<LinkApi> = {}): LinkApi {
  seq += 1;
  return {
    id: `7d000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    kind,
    side: kind === "derived_from" ? "derived" : null,
    other: {
      id: other.id,
      number: other.number,
      title: other.title,
      stage: other.stage,
      scope: other.scope ?? scopeOf(other.number),
      visible: true,
    },
    can_remove: true,
    created_at: T0,
    ...o,
  };
}
/** 見えない相手（番号だけ） */
export const hidden = (kind: LinkApi["kind"], number: string, o: Partial<LinkApi> = {}): LinkApi =>
  link(
    kind,
    { id: "", number, title: "", stage: DONE },
    {
      other: { id: null, number, title: null, stage: null, scope: null, visible: false },
      ...o,
    },
  );
/** モック f4-links と同じ 2 つのつながり（派生元 → 関連の順＝口の並び） */
export const twoLinks = (): LinkApi[] => [link("derived_from", SRC), link("related", REL)];
/** モック f4-links-variants と同じ 4 つ：派生元 EG-110・派生先 EG-130・派生先（見えない）KR-044・関連 JD-150 */
export const variantLinks = (): LinkApi[] => [
  link("derived_from", SRC),
  link("derived_from", EG130, { side: "source" }),
  hidden("derived_from", "KR-044", { side: "source" }),
  link("related", REL),
];

// ---------------------------------------------------------------- 口の差し替え
export type Handler = (req: Request) => Reply | Promise<Reply>;
export interface LinksMock {
  links: LinkApi[];
  children: TicketApi[];
  readStatus: number;
  reads: number;
  adds: { body: Record<string, unknown>; key: string | undefined }[];
  removes: string[];
  /** 候補を探した口（q）の記録 */
  searches: URLSearchParams[];
  searchStatus: number;
  /** 探す口の答えを差し替える（既定は題名の一部か番号が合うチケット） */
  searchAnswer: ((q: string) => TicketApi[]) | null;
  hold: () => () => void;
  gate: Promise<void>;
  on: { list: Handler; add: Handler; remove: Handler };
}
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : "server_error",
    code,
    ...(message ? { message } : {}),
  },
});
/** 404。口の中で消えた・無い物は E-PAGE-001（文つき）・入口が返す無い・見えない物は NOT_FOUND（文なし）。画面はどちらも状態コード 404 で E-PAGE-001 の文を出す */
export const gone = (code: "E-PAGE-001" | "NOT_FOUND" = "E-PAGE-001"): Reply =>
  err(404, code, code === "E-PAGE-001" ? msg("E-PAGE-001") : undefined);

const row = (x: TicketApi) => ({
  id: x.id,
  number: x.number,
  title: x.title,
  scope: x.scope ?? scopeOf(x.number),
  kind: { id: "k1", name: "タスク" },
  stage: x.stage,
  assignee: null,
  delegated_to_clone: false,
  due_on: null,
  overdue: false,
  updated_at: "2026-11-15T00:00:00Z",
  parent_ticket_id: null,
  depth: 1,
});

/** host（土台 mockApi の Mock）を渡すと、詳細 getTicket の答えに閉じた形の件数（link_count・child_count・K-560）を足して返す */
export async function mockLinks(
  page: Page,
  o: Partial<Pick<LinksMock, "links" | "children" | "readStatus">> = {},
  host?: Mock,
): Promise<LinksMock> {
  const m: LinksMock = {
    links: o.links ?? twoLinks(),
    children: o.children ?? [C1, C2],
    readStatus: o.readStatus ?? 200,
    reads: 0,
    adds: [],
    removes: [],
    searches: [],
    searchStatus: 200,
    searchAnswer: null,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      list: () =>
        m.readStatus !== 200
          ? err(m.readStatus, "E-PAGE-003")
          : {
              status: 200,
              body: {
                data: m.links,
                meta: {
                  limit: 200,
                  children: m.children.map((c) => ({
                    id: c.id,
                    number: c.number,
                    title: c.title,
                    stage: c.stage,
                    scope: scopeOf(c.number),
                  })),
                },
              },
            },
      add: (req) => {
        const b = req.postDataJSON() as Record<string, unknown>;
        const other = CATALOG.find((x) => x.id === b["other_ticket_id"]) ?? EG97;
        const made = link(b["kind"] as LinkApi["kind"], other);
        m.links = [...m.links, made];
        return { status: 201, body: { data: made } };
      },
      remove: (req) => {
        const id = new URL(req.url()).pathname.split("/").at(-1)!;
        if (!m.links.some((l) => l.id === id)) return gone();
        m.links = m.links.filter((l) => l.id !== id);
        return { status: 200, body: { data: { id } } };
      },
    },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const method = req.method();
    let reply: Reply | null = null;
    if (host && p === `/api/v1/tickets/${TICKET}` && method === "GET") {
      const r = await host.on.ticket(req);
      const b = r.body as { data?: Record<string, unknown> };
      reply = b.data
        ? {
            status: r.status,
            body: {
              ...b,
              data: { ...b.data, test_spec_count: 0, link_count: m.links.length, child_count: m.children.length },
            },
          }
        : r;
    } else if (p === `/api/v1/tickets/${TICKET}/links` && method === "GET") {
      m.reads++;
      reply = await m.on.list(req);
    } else if (p === `/api/v1/tickets/${TICKET}/links` && method === "POST") {
      m.adds.push({ body: req.postDataJSON() as Record<string, unknown>, key: req.headers()["idempotency-key"] });
      await m.gate;
      reply = await m.on.add(req);
    } else if (/^\/api\/v1\/ticket_links\/[^/]+$/.test(p) && method === "DELETE") {
      m.removes.push(p.split("/").at(-1)!);
      await m.gate;
      reply = await m.on.remove(req);
    } else if (p === "/api/v1/tickets" && method === "GET" && u.searchParams.has("q")) {
      m.searches.push(u.searchParams);
      const q = (u.searchParams.get("q") ?? "").normalize("NFKC").trim().toLowerCase();
      const hit = m.searchAnswer
        ? m.searchAnswer(q)
        : CATALOG.filter((x) => x.title.toLowerCase().includes(q) || x.number.toLowerCase() === q);
      reply =
        m.searchStatus !== 200
          ? err(m.searchStatus, "E-PAGE-003")
          : { status: 200, body: { data: hit.map(row), meta: { next_cursor: null } } };
    } else if (p === "/api/v1/scopes" && method === "GET") {
      reply = {
        status: 200,
        body: {
          data: SCOPES.map((s) => ({ ...s, tenant_id: "aaaaaaaa-0000-4000-8000-000000000001" })),
          meta: { limit: 200, writable: SCOPES.map((s) => s.id) },
        },
      };
    }
    if (!reply) return route.fallback();
    return route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}

// ---------------------------------------------------------------- 場所・手順
/** 詳細の本文の下の「子チケット・つながり」のカード */
export const card = (page: Page): Locator => page.getByRole("region", { name: "子チケット・つながり" });
export const dialogOf = (page: Page, name: string): Locator => page.getByRole("dialog", { name, exact: true });
export const addDialog = (page: Page): Locator => dialogOf(page, "つながりを足す");
export const unlinkBtn = (page: Page, number: string): Locator =>
  card(page).getByRole("button", { name: `${number} とのつながりを外す`, exact: true });
/** つながりの行（番号が入った行） */
export const linkRow = (page: Page, number: string): Locator =>
  card(page).getByRole("listitem").filter({ hasText: number });
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

export interface OpenOptions {
  width?: number;
  links?: LinkApi[];
  children?: TicketApi[];
  readStatus?: number;
  band?: Band;
  /** 閉じた形のまま止める（既定は「開く」を押して読ませる：読む口は「開く」を押したとき 1 回） */
  closed?: boolean;
}
/** 閉じた形の「開く」を押して、カードが開く（読む口が呼ばれる）のを待つ */
export async function openCard(page: Page): Promise<void> {
  await card(page).getByRole("button", { name: "開く", exact: true }).click();
  await expect(page.locator(".k-f4-links-body")).toBeVisible();
}
/** 開き直す。カードは閉じた形で出るので、「開く」を押す（読み直しの口が呼ばれる） */
export async function reloadLinks(page: Page): Promise<void> {
  await page.reload();
  await expect(card(page)).toBeVisible();
  await openCard(page);
}
/** 詳細を、つながりの口を差し替えて開く。カードは閉じた形で出る。既定では「開く」を押して読ませる */
export async function openLinks(page: Page, o: OpenOptions = {}): Promise<{ m: Mock; l: LinksMock }> {
  const m = await mockApi(page, o.band ?? { stage: "doing" });
  const l = await mockLinks(
    page,
    {
      ...(o.links ? { links: o.links } : {}),
      ...(o.children ? { children: o.children } : {}),
      ...(o.readStatus !== undefined ? { readStatus: o.readStatus } : {}),
    },
    m,
  );
  await openTicket(page, o.width ?? 1440);
  await expect(card(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (!o.closed) await openCard(page);
  return { m, l };
}
/** 「つながりを足す」を押して小窓を開く */
export async function openAdd(page: Page): Promise<Locator> {
  await card(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const d = addDialog(page);
  await expect(d).toBeVisible();
  return d;
}
/** 探す欄に打ち、候補が出る（その番号の行が見える）まで待つ */
export async function search(d: Locator, text: string): Promise<void> {
  await d.getByLabel("チケットを探す", { exact: true }).fill(text);
}
export const candidate = (d: Locator, number: string): Locator =>
  d.getByRole("list", { name: "候補" }).getByRole("button").filter({ hasText: number });

// ---------------------------------------------------------------- モックとの突き合わせ
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity"];
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
/** 位置（x・y）は比べない：本番の詳細は前後に別の区画が並ぶ */
export const LINK_PAIRS: FidelityPair[] = [
  pair("card", ".k-detail-links", BOX),
  pair("count", ".k-f4-links-count", [...TXT, "texts"]),
  pair("head", ".k-detail-links-head h2", [...TXT, "texts"]),
  pair("head-btn", ".k-detail-links-head button", [...CTRL, "texts"]),
  pair("group", ".k-f4-links-group h3", [...TXT, "texts"]),
  pair("row", ".k-f4-links-row", ["width", "height", "background-color"]),
  pair("no", ".k-f4-links-no", [...TXT, "texts"]),
  pair("title", ".k-f4-links-title", [...TXT, "texts"]),
  pair("row-btn", ".k-f4-links-row button", [...CTRL, "texts"]),
  pair("empty", ".k-f4-links-empty", [...TXT, "texts"]),
  pair("dialog", ".k-dialog", BOX),
  pair("dlg-title", ".k-dialog-title", [...TXT, "texts"]),
  pair("target", ".k-dialog-target", [...TXT, "texts"]),
  pair("types", ".k-f4-links-types", ["width", "height"]),
  pair("cand", ".k-f4-links-cand", [...BOX, "opacity", "texts"]),
  pair("note", ".k-f4-links-note", [...TXT, "texts"]),
  pair("actions", ".k-dialog-actions button", [...CTRL, "texts"]),
];

export async function expectSameAsMock(
  browser: Parameters<typeof matchMock>[0],
  id: string,
  width: number,
  setup: Omit<OpenOptions, "width">,
  drive: (page: Page, l: LinksMock) => Promise<void>,
  opts: Pick<MatchOptions, "skip"> = {},
): Promise<void> {
  const { rows, bad } = await matchMock(
    browser,
    id,
    width,
    async (page) => {
      const m = await mockApi(page, { stage: "doing" });
      matchTicket(m);
      const l = await mockLinks(
        page,
        {
          ...(setup.links ? { links: setup.links } : {}),
          ...(setup.children ? { children: setup.children } : {}),
        },
        m,
      );
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      const res = await page.goto(`/tickets/${TICKET}`);
      expect(res?.status(), `本番の詳細（${id}）`).toBe(200);
      await expect(card(page)).toBeVisible();
      if (!setup.closed) {
        await openCard(page);
        await expect.poll(() => l.reads).toBeGreaterThanOrEqual(1);
      }
      await drive(page, l);
    },
    { base: "/dev/mock/f4", pairs: LINK_PAIRS, ...(opts.skip ? { skip: opts.skip } : {}), blur: true },
  );
  expect(rows.length, `${id} 幅 ${width}：比べた値が 0 件`).toBeGreaterThan(0);
  expect(bad, bad.join("\n")).toEqual([]);
}
