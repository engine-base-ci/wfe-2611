// 段 11（F10）の画面の試験の共通の道具（K-819 が持つ。K-805・K-806・K-809・K-818・K-820・K-821・K-822 が使う）。
//   実 Chrome の試験で、ログイン・外枠・役は本物（signupViaApi・loginAs）、メンバーの口（getWorkspaceMembers・getMember・役割・所属・止める・戻す・外す・
//   招待・グループ・層）と本人確認の取り直し（getMySecurity・stepUp）だけを網の手前（page.route）で差し替える。口の答えの形は口の葉の「画面が使う答えの形」
//   （K-802・K-803・K-804・K-807・K-808・K-810・K-811・K-812・K-814・K-815・K-848）。本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { PW, loginAs } from "../_lib/api";

// ---------------------------------------------------------------- 決めた値（モック mocks.tsx・render-member.tsx の人と同じ）
export const WS_NAME = "株式会社ENGINE BASE";
export const MOCK_BASE = "/dev/mock/f10";
export const ID = {
  takamoto: "0193c5a0-0000-7000-8000-000000000a01",
  sato: "0193c5a0-0000-7000-8000-000000000a02",
  suzuki: "0193c5a0-0000-7000-8000-000000000a03",
  tanaka: "0193c5a0-0000-7000-8000-000000000a04",
  yamaguchi: "0193c5a0-0000-7000-8000-000000000a06",
  kimura: "0193c5a0-0000-7000-8000-000000000b01",
  EG: "0193c5a0-0000-7000-8000-00000000e001",
  JD: "0193c5a0-0000-7000-8000-00000000e002",
  KR: "0193c5a0-0000-7000-8000-00000000e003",
} as const;

export interface Person {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member" | "viewer" | "requester";
  group_role: "manager" | "member" | "viewer" | null;
  primary: boolean;
  other_groups: string[];
  self: boolean;
  suspended: boolean;
  pc: "ok" | "away" | "never" | "none";
  pc_days_away: number | null;
  last_used_at: string | null;
  last_used_days: number | null;
}
export const person = (o: Partial<Person> & Pick<Person, "id" | "name">): Person => ({
  email: `${o.id.slice(-3)}@engine-base.example`,
  role: "member",
  group_role: null,
  primary: true,
  other_groups: [],
  self: false,
  suspended: false,
  pc: "ok",
  pc_days_away: null,
  last_used_at: "2026-11-22T00:00:00Z",
  last_used_days: 0,
  ...o,
});
export interface Group {
  id: string;
  code: string;
  name: string;
  members: Person[];
}
export interface Invited {
  id: string;
  email: string;
  scope_id: string;
  role: string;
  expires_at: string;
  left_days: number;
}

/** 口の答えを組む元（モックの人。佐藤は営業と受託開発のマネージャーを兼ねる・田中は営業のメンバーで経理にも入る） */
export interface World {
  groups: Group[];
  invitations: Invited[];
}
export function world(): World {
  const sato = person({
    id: ID.sato,
    name: "佐藤 花子",
    email: "sato@engine-base.example",
    role: "manager",
    group_role: "manager",
    other_groups: ["受託開発"],
  });
  const takamoto = person({
    id: ID.takamoto,
    name: "高本 聖斗",
    email: "takamoto@engine-base.example",
    role: "admin",
    self: true,
  });
  const suzuki = person({
    id: ID.suzuki,
    name: "鈴木 一郎",
    email: "suzuki@engine-base.example",
    group_role: "member",
    last_used_days: 3,
  });
  const tanaka = person({
    id: ID.tanaka,
    name: "田中 美咲",
    email: "tanaka@engine-base.example",
    group_role: "member",
    other_groups: ["経理"],
    pc: "away",
    pc_days_away: 3,
    last_used_days: 12,
  });
  const yamaguchi = person({
    id: ID.yamaguchi,
    name: "山口 健",
    email: "yamaguchi@engine-base.example",
    role: "viewer",
    group_role: "viewer",
    pc: "none",
    last_used_days: 5,
  });
  return {
    groups: [
      { id: ID.EG, code: "EG", name: "営業", members: [sato, takamoto, suzuki, tanaka] },
      {
        id: ID.JD,
        code: "JD",
        name: "受託開発",
        members: [{ ...sato, primary: false, other_groups: [] }, yamaguchi],
      },
      { id: ID.KR, code: "KR", name: "経理", members: [{ ...tanaka, primary: false, other_groups: [] }] },
    ],
    invitations: [
      {
        id: ID.kimura,
        email: "kimura@engine-base.example",
        scope_id: ID.KR,
        role: "member",
        expires_at: "2026-11-28T09:00:00Z",
        left_days: 6,
      },
    ],
  };
}
export const membersBody = (w: World) => ({
  data: {
    groups: w.groups,
    invitations: w.invitations,
    alerts: [],
    count: new Set(w.groups.flatMap((g) => g.members.map((m) => m.id))).size + w.invitations.length,
  },
});

/** メンバーの 1 人（getMember）の答え（K-810 の形）。既定は鈴木 一郎 */
export function detailBody(o: Record<string, unknown> = {}) {
  return {
    data: {
      member: {
        id: ID.suzuki,
        name: "鈴木 一郎",
        email: "suzuki@engine-base.example",
        role: "member",
        suspended: false,
        suspended_at: null,
        since: "2026-04-10T00:00:00Z",
        self: false,
        is_owner: false,
        role_changed: { at: "2026-11-02T00:58:00Z", by: "高本", from: "manager" },
      },
      groups: [{ id: ID.EG, name: "営業", code: "EG", primary: true, role: "member" }],
      assigned: { tickets: 6, overdue: 0, stuck: 0, handing: 0 },
      clone: { pc: "ok", pc_days_away: null, device: "MacBook Air" },
      login: { passkeys: 2, has_password: false, two_factor: false, last_login_at: "2026-11-02T00:12:00Z" },
      recent_events: [
        { id: "ev1", action: "member.role_change", at: "2026-11-02T00:58:00Z", by: "高本" },
        { id: "ev2", action: "member.groups_change", at: "2026-10-12T05:20:00Z", by: "高本" },
      ],
      ...o,
    },
  };
}

// ---------------------------------------------------------------- 口の差し替え
export interface Reply {
  status: number;
  body: unknown;
}
export const ok = (data: unknown, status = 200): Reply => ({ status, body: { data } });
export const err = (status: number, code: string, more: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, ...more },
});
export type Op =
  | "members"
  | "getMember"
  | "role"
  | "groups"
  | "suspend"
  | "resume"
  | "preview"
  | "remove"
  | "resend"
  | "revoke"
  | "invite"
  | "scopes"
  | "createScope"
  | "updateScope"
  | "layers"
  | "createLayer"
  | "updateLayer"
  | "security"
  | "stepUp";
const TABLE: readonly [Op, string, RegExp][] = [
  ["members", "GET", /\/api\/v1\/workspace\/members$/],
  ["preview", "GET", /\/api\/v1\/members\/[^/]+\/remove-preview$/],
  ["role", "PATCH", /\/api\/v1\/members\/[^/]+\/role$/],
  ["groups", "PATCH", /\/api\/v1\/members\/[^/]+\/groups$/],
  ["suspend", "POST", /\/api\/v1\/members\/[^/]+\/suspend$/],
  ["resume", "POST", /\/api\/v1\/members\/[^/]+\/resume$/],
  ["remove", "POST", /\/api\/v1\/members\/[^/]+\/remove$/],
  ["getMember", "GET", /\/api\/v1\/members\/[^/]+$/],
  ["resend", "POST", /\/api\/v1\/invitations\/[^/]+\/resend$/],
  ["invite", "POST", /\/api\/v1\/invitations$/],
  ["revoke", "DELETE", /\/api\/v1\/invitations\/[^/]+$/],
  ["scopes", "GET", /\/api\/v1\/scopes$/],
  ["createScope", "POST", /\/api\/v1\/scopes$/],
  ["updateScope", "PATCH", /\/api\/v1\/scopes\/[^/]+$/],
  ["layers", "GET", /\/api\/v1\/layers$/],
  ["createLayer", "POST", /\/api\/v1\/layers$/],
  ["updateLayer", "PATCH", /\/api\/v1\/layers\/[^/]+$/],
  ["security", "GET", /\/api\/v1\/me\/security$/],
  ["stepUp", "POST", /\/api\/v1\/auth\/step-up$/],
];
export interface ApiCall {
  op: Op;
  /** 道の最後の id（人・招待・グループ・層） */
  id: string;
  body: Record<string, unknown> | null;
  key: string | undefined;
}
export interface Api {
  calls: ApiCall[];
  count: (op: Op) => number;
  of: (op: Op) => ApiCall[];
  last: (op: Op) => ApiCall | undefined;
  /** 常の答えを差し替える */
  set: (op: Op, fn: (c: ApiCall) => Reply) => void;
  /** 次の回から順に 1 回ずつ使う答え（使い切ったら常の答え） */
  queue: (op: Op, ...replies: Reply[]) => void;
  /** 答えを止める（返した関数を呼ぶと放す） */
  hold: (op: Op) => () => void;
  w: World;
}
export interface MockOpts {
  world?: World;
  detail?: Record<string, unknown>;
}
export async function mockApi(page: Page, o: MockOpts = {}): Promise<Api> {
  const w = o.world ?? world();
  const calls: ApiCall[] = [];
  const queues = new Map<Op, Reply[]>();
  const holds = new Map<Op, Promise<void>>();
  const fns = new Map<Op, (c: ApiCall) => Reply>();
  const defaults: Partial<Record<Op, (c: ApiCall) => Reply>> = {
    members: () => ({ status: 200, body: membersBody(w) }),
    getMember: () => ({ status: 200, body: detailBody(o.detail) }),
    security: () =>
      ok({
        passkeys: [],
        has_password: true,
        two_factor: false,
        backup_codes_left: null,
        two_factor_required: false,
        mfa_pending: false,
      }),
    stepUp: () => ok({ step_up_at: new Date().toISOString() }, 201),
  };
  const api: Api = {
    calls,
    w,
    count: (op) => calls.filter((c) => c.op === op).length,
    of: (op) => calls.filter((c) => c.op === op),
    last: (op) => calls.filter((c) => c.op === op).at(-1),
    set: (op, fn) => void fns.set(op, fn),
    queue: (op, ...r) => void queues.set(op, [...(queues.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = () => {};
      holds.set(op, new Promise<void>((r) => (open = r)));
      return () => open();
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\//, async (route: Route, req: Request) => {
    const url = new URL(req.url());
    const hit = TABLE.find(([, m, rx]) => m === req.method() && rx.test(url.pathname));
    if (!hit) return route.fallback();
    const op = hit[0];
    const parts = url.pathname.split("/").filter(Boolean);
    const suffixed = ["role", "groups", "suspend", "resume", "remove", "preview", "resend"].includes(op);
    const call: ApiCall = {
      op,
      id: parts.at(suffixed ? -2 : -1)!,
      body: (req.postDataJSON() as Record<string, unknown> | null) ?? null,
      key: req.headers()["idempotency-key"],
    };
    calls.push(call);
    const held = holds.get(op);
    if (held) await held;
    const q = queues.get(op);
    const r = q?.length
      ? q.shift()!
      : (fns.get(op) ?? defaults[op] ?? (() => err(501, "NOT_MOCKED", { message: op })))(call);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return api;
}

// ---------------------------------------------------------------- 開く・よく使う部品
export async function openAt(page: Page, token: string, path: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, token);
  await page.goto(path);
}
/** 本人確認の小窓：パスワードで確かめる（通れば呼ぶ側が 1 回だけやり直す） */
export const stepDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます", exact: true });
export async function passStepUp(page: Page): Promise<void> {
  await expect(stepDlg(page)).toBeVisible();
  await stepDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await stepDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
}
export const toast = (page: Page) => page.locator(".k-toast");
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export const sameOrder = async (loc: Locator, texts: string[]) => expect(loc).toHaveText(texts);

// ---------------------------------------------------------------- モックとの突き合わせの役割の組
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const DLG = ".k-dialog";
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
export const F10_PAIRS: FidelityPair[] = [
  pair("ws", ".k-inv-ws", [...BOX, "x"]),
  pair("sub", ".k-me-sub", ["width", "x"]),
  pair("sub-item", ".k-me-sub-i", ["height", "opacity", "texts"]),
  pair("h1", "section h1", ["x", ...TEXT]),
  pair("acts", ".k-page-acts button", CTRL),
  pair("group", ".k-f10m-group", BOX),
  pair("group-name", ".k-inv-group-name", TEXT),
  pair("row", ".k-f10m-row", ["height", "texts"]),
  pair("name", ".k-inv-name", TEXT),
  pair("role", ".k-f10m-role, .k-inv-role-cell .k-badge", CTRL),
  pair("last", ".k-f10m-last", TEXT),
  pair("more", ".k-f10m-more", CTRL),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("callout", ".k-callout", [...BOX, "texts"]),
  pair("card", ".k-set-card", BOX),
  pair("row-set", ".k-set-row", ["height", "texts"]),
  pair("dialog", DLG, ["width", "x", "y", "background-color", "border-top-left-radius"]),
  pair("dialog-title", `${DLG} h2`, ["x", "y", ...TEXT]),
  pair("dialog-label", `${DLG} .k-label`, TEXT),
  pair("dialog-err", `${DLG} .k-err`, TEXT),
  pair("dialog-btn", `${DLG} button[data-variant]`, ["x", "y", ...CTRL]),
  pair("toast", ".k-toast", [...BOX, "texts"]),
];
