// K-458「詳細の頭の「…」のメニュー」の画面の試験の道具（K-458 の試験だけが読む・2026-11-20・2026-11-22 に新しい形へ）。
//   「…」の中の 2 つ（複製する・版と差分を見る）のうち、複製する は K-446 の小窓を開き、版と差分を見る は K-449 の頁（/tickets/:id/versions）へ移るだけなので、
//   口の差し替えはその 2 本の道具をそのまま重ねる：
//     ・版の一覧と戻す口と詳細（getTicket）… versions-mock.ts の mockVersions（K-449 が持つ）
//     ・作る口（createTicket）と、作った後の詳細 … duplicate-mock.ts の routeCreate（K-446 が持つ）
//   getTicket の答えには、複製の小窓が読む足し（ticket.scope_id・ticket.kind_id・kind.id・assignee.id・child_count）と、K-560 が足す列（NEW_FORM）を重ねる
//   （形は K-446 の道具 setupDetail と同じ）。グループの一覧 GET /api/v1/scopes は複製の小窓が読む。
//   口の形が変わったら K-446・K-449 の道具だけを直す（この道具は重ねるだけ）。時計は 2026-11-23（月）10:00（日本時間）に止める。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";
import { API_RE, TICKET, withBand, type Band } from "../features/F5/approve-complete.harness";
import { ME, SCOPE, TASK, WS } from "./create-mock";
import { NEW_FORM, NUMBER, TITLE, routeCreate, type DupPost } from "./duplicate-mock";
import { mockVersions, type VersionsMock } from "./versions-mock";

export const NOW = "2026-11-23T10:00:00+09:00";
/** 複製の小窓の既定の copy（本文・担当者・項目・確認項目・つながり・子チケット。添付は無い・K-438 の 6 つの名前） */
export const ALL = ["body", "assignee", "fields", "specs", "links", "children"];

export interface MoreSetup {
  /** 版の一覧・戻す・getTicket を数える（K-449 の道具） */
  v: VersionsMock;
  /** 作る口（K-446 の道具） */
  post: DupPost;
}

/** 詳細（getTicket・版の口）と作る口と、グループの一覧を、網の手前で差し替える */
export async function setupMore(page: Page): Promise<MoreSetup> {
  await page.clock.setFixedTime(NOW);
  const v = await mockVersions(page);
  const post = await routeCreate(page);
  const band: Band = { stage: "doing" };
  const prev = v.api.on.ticket;
  v.api.on.ticket = async (req: Request) => {
    const r = await prev(req);
    const data = (r.body as { data: Record<string, unknown> }).data;
    const t = data["ticket"] as Record<string, unknown>;
    const kind = (data["kind"] ?? {}) as Record<string, unknown>;
    return {
      status: r.status,
      body: {
        data: withBand(band, {
          ...data,
          ticket: {
            ...t,
            number: NUMBER,
            title: TITLE,
            due_on: "2026-11-27",
            start_on: "2026-11-20",
            scope_id: SCOPE,
            kind_id: TASK,
          },
          kind: { ...kind, id: TASK },
          assignee: { id: ME, display_name: "高本" },
          ...NEW_FORM,
          child_count: 2,
        }),
      },
    };
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    if (req.method() !== "GET" || new URL(req.url()).pathname !== "/api/v1/scopes") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: SCOPE, name: "営業", tenant_id: WS, ticket_prefix: "EG" }],
        meta: { limit: 200, writable: [SCOPE] },
      }),
    });
  });
  return { v, post };
}

/** 詳細（/tickets/:id）を開き、題名と「…」が出て読み込みが終わるまで待つ（K-449 の道具に詳細を開く道具が無いので、この葉が持つ） */
export async function openDetail(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`/tickets/${TICKET}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ほかの操作", exact: true })).toBeVisible();
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
}

/** 「複製して開く」でそのまま送ったときの作る口の体（K-446 の既定の体と同じ・ちょうど 7 つ） */
export const dupBody = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  scope_id: SCOPE,
  kind_id: TASK,
  title: TITLE,
  assignee_member_id: ME,
  due_on: "2026-11-27",
  duplicate_of: TICKET,
  copy: ALL,
  ...o,
});
