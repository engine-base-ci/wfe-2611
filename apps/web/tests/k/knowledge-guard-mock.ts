// 確認項目の出どころの印と「まだ完了にできません」の小窓（K-703）の試験の道具：段 5 の complete-mock.ts（詳細・帯・実行・完了の口）の上に、
//   確認項目の口を「出どころ knowledge の行と source_page」つきで重ねる（後から足した道が先に当たる）。
//     GET   /api/v1/tickets/:id/test-specs … 行 { id, title, checked, position, source, version, source_page? }（K-434 の 6 鍵＋K-701 が足す source_page）
//     PATCH /api/v1/test_specs/:id         … チェックの付け外し { version, checked }（K-435）
//   完了の口の答えは complete-mock の m.api.on.complete を差し替える（K-701 の 409 E-KNW-240・体は { error, code, detail: { left: [{ id, title, page_id, page_title }] } }）。
//   答えの形は 11_tickets/K-701.md・K-434.md・K-435.md。固定の待ちは使わない（hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import { mockComplete, NO_TASK_DOC, type CompleteMock, type Node } from "./complete-mock";
import { TICKET, type Reply } from "../features/F5/approve-complete.harness";

export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const P_INV = uid(0xa001);
export const P_MAIL = uid(0xa003);
export const P_OUT = uid(0xa004);

export interface KRow {
  id: string;
  title: string;
  checked: boolean;
  source: "manual" | "knowledge";
  /** undefined＝鍵ごと無い（K-701 より前の口）・null＝必ず守るから外れた・ページが無い */
  source_page?: { id: unknown; title: unknown } | null;
  version?: number;
}
export const sid = (n: number): string => uid(0xd000 + n);
/** ナレッジから入った行（出どころ knowledge・文は「『題名』を守った」） */
export const kn = (n: number, page: string, title: string, checked = false): KRow => ({
  id: sid(n),
  title: `『${title}』を守った`,
  checked,
  source: "knowledge",
  source_page: { id: page, title },
});
/** 人が足した行 */
export const human = (n: number, title: string, checked = false): KRow => ({
  id: sid(n),
  title,
  checked,
  source: "manual",
});

/** 下絵 tk-blocked と同じ 5 行：ナレッジ 4（付いた 3・付いていない 1）・人が足した 1（付いていない） */
export const MOCK_ROWS = (): KRow[] => [
  kn(1, P_INV, "請求書の送り方", true),
  kn(2, P_INV, "請求書の送り方", true),
  kn(3, P_MAIL, "メールの書き方", true),
  kn(4, P_OUT, "外に出す前の確かめ"),
  human(5, "先月と同じ書式になっている"),
];

export interface GuardMock {
  complete: CompleteMock;
  rows: KRow[];
  /** 確認項目の一覧を読んだ数（このファイルの差し替えが数える） */
  reads: number;
  patches: { id: string; body: Record<string, unknown> }[];
  /** 一覧の答えを止めておく。返した関数を呼ぶと答える */
  hold: () => () => void;
}

export interface GuardOptions {
  /** 本文（既定は未チェックの箱の無い文書）。未チェックの箱を足すと K-572 の小窓にも出る */
  doc?: Node;
}

export async function mockGuard(page: Page, rows: KRow[], o: GuardOptions = {}): Promise<GuardMock> {
  const complete = await mockComplete(page, { doc: o.doc ?? NO_TASK_DOC() });
  let gate: Promise<void> = Promise.resolve();
  const g: GuardMock = {
    complete,
    rows: rows.map((r) => ({ ...r })),
    reads: 0,
    patches: [],
    hold: () => {
      let open = (): void => undefined;
      gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  // 詳細の確認項目の件数（spec_count）を行の数に合わせる
  complete.specs = g.rows.map((r) => ({ id: r.id, title: r.title, checked: r.checked }));
  const view = (r: KRow, i: number) => ({
    id: r.id,
    title: r.title,
    checked: r.checked,
    position: i + 1,
    source: r.source,
    version: r.version ?? 1,
    ...(r.source_page === undefined ? {} : { source_page: r.source_page }),
  });
  const send = (route: Route, r: Reply) =>
    route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  await page.route(
    /\/api\/v1\/(tickets\/[^/]+\/test-specs|test_specs\/[^/?]+)(\?|$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      if (req.method() === "GET" && p === `/api/v1/tickets/${TICKET}/test-specs`) {
        g.reads += 1;
        await gate;
        return send(route, {
          status: 200,
          body: { data: g.rows.map(view), meta: { count: g.rows.length, limit: 200, can_edit: true } },
        });
      }
      const m = /\/api\/v1\/test_specs\/([^/?]+)$/.exec(p);
      if (req.method() === "PATCH" && m) {
        const body = req.postDataJSON() as Record<string, unknown>;
        g.patches.push({ id: m[1]!, body });
        const r = g.rows.find((x) => x.id === m[1]);
        if (!r) return send(route, { status: 404, body: { error: "not_found", code: "E-PAGE-001" } });
        if (typeof body["checked"] === "boolean") r.checked = body["checked"];
        r.version = (r.version ?? 1) + 1;
        complete.specs = g.rows.map((x) => ({ id: x.id, title: x.title, checked: x.checked }));
        return send(route, { status: 200, body: { data: view(r, g.rows.indexOf(r)) } });
      }
      return route.fallback();
    },
  );
  return g;
}

/** 完了の口が止める答え（K-701・409・E-KNW-240）。left は止める行（行の id・文・ページの id・題名） */
export const knwLeft = (left: unknown): Reply => ({
  status: 409,
  body: { error: "conflict", code: "E-KNW-240", detail: { left } },
});
export const leftRow = (r: KRow, pageTitle: string, pageId: string) => ({
  id: r.id,
  title: r.title,
  page_id: pageId,
  page_title: pageTitle,
});
