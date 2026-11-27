// 配るもの › ひな形・操作（/ops/skills/templates・/operations・K-994）と、会社の側の「ひな形がこう変わります」（K-1016）の
//   試験の道具と答えの見本（K-994 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   答えの形は 11_tickets/K-992.md（OpsTemplateRow 8 欄）・K-1010.md（OpsOperation 6 欄）・K-993.md（KindTemplateUpdate 7 欄）。
//   字・数は下絵（features/F12/ops2/views-skills.tsx の TEMPLATES・DIFFS と操作の箱）と同じになる値。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

/** 下絵 oq-templates の 3 行 */
export const TEMPLATES_A = [
  {
    id: uid(0x9941),
    key: "kind",
    name: "種別",
    summary: "タスク・QA・課題・会議 の名前・色・本文のひな形",
    version: 3,
    using: 48,
    took: { changed: 31, offered: 46 },
    last_released_at: "2026-10-20T03:00:00Z",
  },
  {
    id: uid(0x9942),
    key: "state",
    name: "状態",
    summary: "未着手・作業中・確認中・承認待ち・実行中・完了",
    version: 2,
    using: 48,
    took: { changed: 48, offered: 48 },
    last_released_at: "2026-09-15T03:00:00Z",
  },
  {
    id: uid(0x9943),
    key: "field",
    name: "項目",
    summary: "チケットの欄の並び・必須。種別ごとに持つ",
    version: 1,
    using: 48,
    took: null,
    last_released_at: "2026-09-01T03:00:00Z",
  },
];
/** 下絵 oq-operations の 1 つ */
export const OPERATIONS_A = [
  {
    id: uid(0x9951),
    key: "browser",
    name: "ブラウザで操作する",
    version_label: "v1.4",
    description: "汎用の操作 1 つ。初めてのサイトも動かし、うまくいったら動かし方を記録して次から使う",
    check_state: "passed",
  },
];
/** 下絵 oq-template-update の届いた版（種別 v3 → v4・差 3 つ） */
export const UPDATE_ID = uid(0x9961);
export const UPDATES_A = [
  {
    id: UPDATE_ID,
    part: "kind",
    part_name: "種別",
    from_version: 3,
    to_version: 4,
    released_at: "2026-10-20T03:00:00Z",
    diffs: [
      {
        key: "minutes_link",
        change: "add",
        target_label: "種別「会議」",
        detail_label: "欄「議事録のリンク」を足す（必須ではありません）",
      },
      { key: "issue", change: "add", target_label: "種別「課題」", detail_label: "色「橙」を足す" },
      { key: "qa", change: "add", target_label: "本文のひな形「QA」", detail_label: "「再現の手順」の見出しを足す" },
    ],
  },
];

type Reply = { status: number; body: unknown } | "abort";
export type TplKey = "templates" | "operations" | "updates" | "apply";
export interface TplMock {
  calls: string[];
  bodies: Partial<Record<TplKey, unknown[]>>;
  on: Record<TplKey, (req: Request) => Reply>;
}
const ROUTES: readonly [TplKey, string, RegExp][] = [
  ["templates", "GET", /^\/api\/v1\/ops\/templates$/],
  ["operations", "GET", /^\/api\/v1\/ops\/operations$/],
  ["apply", "POST", /^\/api\/v1\/ticket_kinds\/template-updates\/[^/]+\/apply$/],
  ["updates", "GET", /^\/api\/v1\/ticket_kinds\/template-updates$/],
];

/** 口の差し替え（運営の画面は mockOps の後・会社の画面はログインの後に呼ぶ） */
export async function mockTemplates(page: Page): Promise<TplMock> {
  const m: TplMock = {
    calls: [],
    bodies: {},
    on: {
      templates: () => ({ status: 200, body: { data: TEMPLATES_A } }),
      operations: () => ({ status: 200, body: { data: OPERATIONS_A } }),
      updates: () => ({ status: 200, body: { data: UPDATES_A } }),
      apply: () => ({ status: 200, body: { data: { ...UPDATES_A[0]!, diffs: [] } } }),
    },
  };
  await page.route(
    /\/api\/v1\/(ops\/templates|ops\/operations|ticket_kinds\/template-updates)/,
    async (route: Route, req: Request) => {
      const u = new URL(req.url());
      const hit = ROUTES.find(([, method, rx]) => method === req.method() && rx.test(u.pathname));
      if (!hit) return route.fallback();
      const [key] = hit;
      m.calls.push(`${req.method()} ${u.pathname}`);
      if (req.method() !== "GET") (m.bodies[key] ??= []).push(req.postDataJSON() as unknown);
      const r = m.on[key](req);
      if (r === "abort") return route.abort("failed");
      await route.fulfill({
        status: r.status,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/json",
        body: JSON.stringify(r.body),
      });
    },
  );
  return m;
}

/** 呼ばれた回数（「METHOD 道の頭」で数える） */
export const count = (m: TplMock, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
