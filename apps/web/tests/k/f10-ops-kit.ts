// 段 11（F10）の画面の試験の共通の道具・その 2（K-831 が持つ。記録 K-825・設定 K-831・K-832・自分の設定 K-839・K-840・K-841 が使う）。
//   f10-kit.ts（K-819・メンバーの画面の道具）と同じ作り：ログイン・外枠・役は本物（signupViaApi・loginAs）、束 D・E・F の口
//   （記録・設定・自分の設定・本人確認の取り直し）だけを網の手前（page.route）で差し替える。口の答えの形は口の葉の「画面が使う答えの形」
//   （K-823・K-850・K-827〜K-830・K-833〜K-835・K-838）。本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない。
//   既定の答えは「動く入れ物」：保存・消す手続き・メールの待ち・抜けるは中の状態（state）を書き換え、読み直すと新しい形が返る（書き込みは別 GET で確かめる）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { ID, err, ok, type Reply } from "./f10-kit";
import { F10_PAIRS } from "./f10-kit";

export { ID, err, ok };
export type { Reply };

export const WS_ID = "0193c5a0-0000-7000-8000-00000000f001";
export const KYOTO_ID = "0193c5a0-0000-7000-8000-00000000f002";
export const SOLO_ID = "0193c5a0-0000-7000-8000-00000000f003";
/** 1 ピクセルの PNG（顔・ロゴの「写真がある」答えの url に使う。網には出ない） */
export const DOT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

// ---------------------------------------------------------------- 記録（listAuditEvents・K-823・K-850）
export interface AuditEntry {
  id: string;
  occurred_at: string;
  kind: "perm" | "out" | "device" | "ai" | "deleted" | "ops" | null;
  action: string;
  actor: { id: string; name: string } | null;
  target: { type: string; id: string; label: string } | null;
  text: string;
  reason: string | null;
  device: string | null;
  step_up: boolean;
  deleted: boolean;
}
export const entry = (o: Partial<AuditEntry> & Pick<AuditEntry, "id" | "text">): AuditEntry => ({
  occurred_at: "2026-11-02T00:58:00.123456Z",
  kind: "perm",
  action: "member.role_change",
  actor: { id: ID.takamoto, name: "高本 聖斗" },
  target: null,
  reason: null,
  device: null,
  step_up: false,
  deleted: false,
  ...o,
});
/** 下絵 render-ws.tsx の ENTRIES・MORE・DELETED と同じ人・時刻（日本時間 11/02 09:58 ＝ 00:58Z）・字 */
export const E_A = entry({
  id: "a",
  text: "鈴木 一郎 を 営業 の マネージャー → メンバー にした",
  reason: "兼務が終わったため",
  device: "iPhone から",
  step_up: true,
});
export const E_B = entry({
  id: "b",
  occurred_at: "2026-10-12T05:20:00.000001Z",
  text: "鈴木 一郎 を 営業 の マネージャー にした",
  device: "MacBook から",
});
export const E_D = entry({
  id: "d",
  occurred_at: "2026-11-04T04:02:00.000001Z",
  kind: "device",
  action: "session.new_device",
  actor: { id: ID.tanaka, name: "田中 美咲" },
  text: "新しい端末（Windows の PC）で入った",
  device: "大阪から",
});
export const E_E = entry({
  id: "e",
  occurred_at: "2026-11-03T01:15:00.000001Z",
  kind: "ai",
  action: "clone.permit",
  text: "高本のAI に「請求書を送る」を許可した",
});
export const MORE: AuditEntry[] = [E_D, E_E, E_A, E_B];
export const ENTRIES: AuditEntry[] = [E_A, E_B];
export const DELETED: AuditEntry[] = [
  entry({
    id: "x",
    occurred_at: "2026-11-01T08:30:00.000001Z",
    kind: "deleted",
    action: "tickets.delete",
    actor: { id: ID.suzuki, name: "鈴木 一郎" },
    target: { type: "ticket", id: ID.EG, label: "EG-120" },
    text: "チケット EG-120 を消した",
    deleted: true,
  }),
  entry({
    id: "y",
    occurred_at: "2026-10-20T02:05:00.000001Z",
    kind: "deleted",
    action: "tickets.delete",
    actor: { id: ID.sato, name: "佐藤 花子" },
    target: { type: "ticket", id: ID.JD, label: "EG-87" },
    text: "チケット EG-87 を消した",
    deleted: true,
  }),
];
export const auditBody = (entries: AuditEntry[], more: Record<string, unknown> = {}) => ({
  data: { entries, next_cursor: null, scope: "all", ...more },
});

// ---------------------------------------------------------------- 設定（K-827〜K-830）
export interface Perm {
  key: "billing" | "delete_workspace";
  name: string;
  detail: string;
  value: "admin" | "admin_manager";
  options: ["admin", "admin_manager"];
}
export interface Settings {
  workspace: { id: string; name: string; logo: { kind: "text" | "image"; url: string | null } };
  permissions: Perm[];
  fixed_rules: { key: string; text: string }[];
  deletion: {
    requested_at: string | null;
    delete_at: string | null;
    days_left: number | null;
    requested_by: { id: string; name: string } | null;
    preview: { tickets: number; members: number };
  };
  /** 読んだ人がどの区画を押せるか（K-827・D-154.83）。管理者は全部 true */
  access: { admin: boolean; billing: boolean; delete_workspace: boolean };
}
export const settings = (o: Partial<Settings> = {}): Settings => ({
  workspace: { id: WS_ID, name: "株式会社ENGINE BASE", logo: { kind: "text", url: null } },
  permissions: [
    {
      key: "billing",
      name: "プランと支払い",
      detail: "プランを変える・請求書を見る",
      value: "admin",
      options: ["admin", "admin_manager"],
    },
    {
      key: "delete_workspace",
      name: "ワークスペースを消す",
      detail: "消す手続きを始める",
      value: "admin",
      options: ["admin", "admin_manager"],
    },
  ],
  fixed_rules: [
    { key: "login", text: "ログインはパスキーを勧めます。" },
    {
      key: "two_factor",
      text: "2 段階認証はそれぞれが自分の設定で付けられ、パスキーを持たずパスワードだけで入る人は必須です。",
    },
    { key: "idle", text: "操作がないと 12 時間で切れます。" },
    {
      key: "approve",
      text: "PC が閉じている間に承認した仕事は、承認から 24 時間を過ぎると実行の前にもう一度聞きます（どちらも決まっていて、変えられません）",
    },
  ],
  deletion: {
    requested_at: null,
    delete_at: null,
    days_left: null,
    requested_by: null,
    preview: { tickets: 69, members: 5 },
  },
  access: { admin: true, billing: true, delete_workspace: true },
  ...o,
});
/** 消す手続き中（あと 13 日・始めた人は高本 聖斗・11/09 10:12 ＝ 01:12Z）の deletion */
export const DELETING = {
  requested_at: "2026-11-09T01:12:00.000Z",
  delete_at: "2026-11-23T01:12:00.000Z",
  days_left: 13,
  requested_by: { id: ID.takamoto, name: "高本 聖斗" },
  preview: { tickets: 69, members: 5 },
};

// ---------------------------------------------------------------- 自分の設定（K-833〜K-838）
export interface MeWorkspace {
  tenant_id: string;
  name: string;
  role: "admin" | "manager" | "member" | "viewer" | "requester";
  group: string | null;
  current: boolean;
  own: boolean;
  last_admin: boolean;
  assigned_total: number;
  assigned: { id: string; number: string; title: string }[];
}
export interface MeMember {
  id: string;
  name: string;
  call_name: string | null;
  email: string;
  avatar: { kind: "text" | "image"; initial: string; url: string | null };
  language: "ja";
  theme: "system" | "light" | "dark";
  week_start: 0 | 1;
  timezone: "Asia/Tokyo" | "UTC";
  email_pending: string | null;
}
export interface Me {
  member: MeMember;
  workspaces: MeWorkspace[];
  workspace_name: string | null;
}
const ws = (o: Partial<MeWorkspace> & Pick<MeWorkspace, "tenant_id" | "name" | "role">): MeWorkspace => ({
  group: null,
  current: false,
  own: false,
  last_admin: false,
  assigned_total: 0,
  assigned: [],
  ...o,
});
/** 下絵 profile.tsx の WORKSPACES と同じ 3 つ：今いる会社（管理者・営業）・自分だけの場所・京蟻システム（メンバー） */
export const me = (o: { member?: Partial<MeMember>; workspaces?: MeWorkspace[] } = {}): Me => ({
  member: {
    id: ID.takamoto,
    name: "高本 聖斗",
    call_name: "高本",
    email: "takamoto@engine-base.example",
    avatar: { kind: "text", initial: "高", url: null },
    language: "ja",
    theme: "light",
    week_start: 0,
    timezone: "Asia/Tokyo",
    email_pending: null,
    ...o.member,
  },
  workspaces: o.workspaces ?? [
    ws({ tenant_id: WS_ID, name: "株式会社ENGINE BASE", role: "admin", group: "営業", current: true }),
    ws({ tenant_id: SOLO_ID, name: "高本 聖斗（個人）", role: "admin", own: true, last_admin: true }),
    ws({ tenant_id: KYOTO_ID, name: "京蟻システム株式会社", role: "member" }),
  ],
  workspace_name: "株式会社ENGINE BASE",
});
export const meBody = (m: Me) => ({ data: m });

// ---------------------------------------------------------------- 口の差し替え
export type OpName =
  | "audit"
  | "settings"
  | "rename"
  | "logo"
  | "perms"
  | "deletion"
  | "cancelDeletion"
  | "me"
  | "updateMe"
  | "avatar"
  | "emailChange"
  | "emailVerify"
  | "leave"
  | "security"
  | "stepUp";
const TABLE: readonly [OpName, string, RegExp][] = [
  ["audit", "GET", /\/api\/v1\/audit_events$/],
  ["settings", "GET", /\/api\/v1\/workspace$/],
  ["rename", "PATCH", /\/api\/v1\/workspace$/],
  ["logo", "POST", /\/api\/v1\/workspace\/logo$/],
  ["perms", "PATCH", /\/api\/v1\/workspace\/permissions$/],
  ["deletion", "POST", /\/api\/v1\/workspace\/deletion$/],
  ["cancelDeletion", "DELETE", /\/api\/v1\/workspace\/deletion$/],
  ["me", "GET", /\/api\/v1\/me$/],
  ["updateMe", "PATCH", /\/api\/v1\/me$/],
  ["avatar", "POST", /\/api\/v1\/me\/avatar$/],
  ["emailChange", "POST", /\/api\/v1\/me\/email-change$/],
  ["emailVerify", "POST", /\/api\/v1\/me\/email-change\/verify$/],
  ["leave", "DELETE", /\/api\/v1\/me\/workspaces\/[^/]+$/],
  ["security", "GET", /\/api\/v1\/me\/security$/],
  ["stepUp", "POST", /\/api\/v1\/auth\/step-up$/],
];
export interface OpCall {
  op: OpName;
  /** 道の最後の id（抜ける会社） */
  id: string;
  body: Record<string, unknown> | null;
  query: Record<string, string>;
  /** multipart のとき：file 欄の名前と種類・reset 欄の字（体は読み切らない） */
  form: { file: string | null; mime: string | null; reset: string | null } | null;
}
export interface OpApi {
  calls: OpCall[];
  count: (op: OpName) => number;
  of: (op: OpName) => OpCall[];
  last: (op: OpName) => OpCall | undefined;
  /** 常の答えを差し替える */
  set: (op: OpName, fn: (c: OpCall) => Reply) => void;
  /** 次の回から順に 1 回ずつ使う答え（使い切ったら常の答え） */
  queue: (op: OpName, ...replies: Reply[]) => void;
  /** 答えを止める（返した関数を呼ぶと放す） */
  hold: (op: OpName) => () => void;
  /** 動く入れ物の中の今の状態 */
  state: { settings: Settings; me: Me; entries: AuditEntry[]; scope: "all" | "groups" };
}
export interface OpsOpts {
  settings?: Settings;
  me?: Me;
  entries?: AuditEntry[];
  scope?: "all" | "groups";
}
const formOf = (req: Request): OpCall["form"] => {
  if (!(req.headers()["content-type"] ?? "").startsWith("multipart/form-data")) return null;
  const text = (req.postDataBuffer() ?? Buffer.alloc(0)).toString("latin1");
  const file = /name="file"; filename="([^"]*)"\r?\nContent-Type: ([^\r\n]*)/.exec(text);
  const reset = /name="reset"\r?\n\r?\n([^\r\n]*)/.exec(text);
  return { file: file ? file[1]! : null, mime: file ? file[2]! : null, reset: reset ? reset[1]! : null };
};
const iso = (d: Date) => d.toISOString();
export async function mockOps(page: Page, o: OpsOpts = {}): Promise<OpApi> {
  const st = {
    settings: o.settings ?? settings(),
    me: o.me ?? me(),
    entries: o.entries ?? MORE,
    scope: o.scope ?? ("all" as const),
  };
  const calls: OpCall[] = [];
  const queues = new Map<OpName, Reply[]>();
  const holds = new Map<OpName, Promise<void>>();
  const fns = new Map<OpName, (c: OpCall) => Reply>();
  const defaults: Partial<Record<OpName, (c: OpCall) => Reply>> = {
    audit: () => ({ status: 200, body: auditBody(st.entries, { scope: st.scope }) }),
    settings: () => ({ status: 200, body: { data: st.settings } }),
    rename: (c) => {
      st.settings = { ...st.settings, workspace: { ...st.settings.workspace, name: String(c.body?.["name"] ?? "") } };
      return ok({ workspace: st.settings.workspace });
    },
    logo: () => {
      st.settings = { ...st.settings, workspace: { ...st.settings.workspace, logo: { kind: "image", url: DOT } } };
      return ok({ logo: st.settings.workspace.logo }, 201);
    },
    perms: (c) => {
      const b = c.body ?? {};
      st.settings = {
        ...st.settings,
        permissions: st.settings.permissions.map((p) => ({
          ...p,
          value: (b[p.key] as Perm["value"] | undefined) ?? p.value,
        })),
      };
      return ok({ permissions: st.settings.permissions.map((p) => ({ key: p.key, value: p.value })) });
    },
    deletion: () => {
      const at = new Date();
      const d = { requested_at: iso(at), delete_at: iso(new Date(at.getTime() + 14 * 864e5)), days_left: 14 };
      st.settings = {
        ...st.settings,
        deletion: { ...d, requested_by: { id: ID.takamoto, name: "高本 聖斗" }, preview: st.settings.deletion.preview },
      };
      return ok({ deletion: d });
    },
    cancelDeletion: () => {
      st.settings = {
        ...st.settings,
        deletion: {
          requested_at: null,
          delete_at: null,
          days_left: null,
          requested_by: null,
          preview: st.settings.deletion.preview,
        },
      };
      return ok({ deletion: { requested_at: null, delete_at: null, days_left: null } });
    },
    me: () => ({ status: 200, body: meBody(st.me) }),
    updateMe: (c) => {
      const b = c.body ?? {};
      const next = { ...st.me.member, ...(b as Partial<MeMember>) };
      const name = String(next.call_name ?? next.name);
      st.me = { ...st.me, member: { ...next, avatar: { ...next.avatar, initial: Array.from(name)[0] ?? "" } } };
      return ok({ member: st.me.member, saved_at: iso(new Date()) });
    },
    avatar: (c) => {
      const initial = Array.from(st.me.member.call_name ?? st.me.member.name)[0] ?? "";
      const avatar: MeMember["avatar"] =
        c.form?.reset === "true" ? { kind: "text", initial, url: null } : { kind: "image", initial, url: DOT };
      st.me = { ...st.me, member: { ...st.me.member, avatar } };
      return ok({ avatar }, 201);
    },
    emailChange: (c) => {
      const email = String(c.body?.["email"] ?? "");
      st.me = { ...st.me, member: { ...st.me.member, email_pending: email } };
      return ok({ pending_email: email, expires_at: iso(new Date(Date.now() + 864e5)) }, 201);
    },
    emailVerify: () => {
      const email = st.me.member.email_pending ?? "new-takamoto@engine-base.example";
      st.me = { ...st.me, member: { ...st.me.member, email, email_pending: null } };
      return ok({ changed: true, email }, 201);
    },
    leave: (c) => {
      st.me = { ...st.me, workspaces: st.me.workspaces.filter((w) => w.tenant_id !== c.id) };
      return ok({ tenant_id: c.id, left: true, restorable_until: iso(new Date(Date.now() + 30 * 864e5)) });
    },
    security: () =>
      ok({
        passkeys: [],
        has_password: true,
        two_factor: false,
        backup_codes_left: null,
        two_factor_required: false,
        mfa_pending: false,
      }),
    stepUp: () => ok({ step_up_at: iso(new Date()) }, 201),
  };
  const api: OpApi = {
    calls,
    state: st as OpApi["state"],
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
    const form = formOf(req);
    const call: OpCall = {
      op: hit[0],
      id: url.pathname.split("/").filter(Boolean).at(-1)!,
      body: form ? null : ((req.postDataJSON() as Record<string, unknown> | null) ?? null),
      query: Object.fromEntries(url.searchParams.entries()),
      form,
    };
    calls.push(call);
    const held = holds.get(call.op);
    if (held) await held;
    const q = queues.get(call.op);
    const r = q?.length
      ? q.shift()!
      : (fns.get(call.op) ?? defaults[call.op] ?? (() => err(501, "NOT_MOCKED", { message: call.op })))(call);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return api;
}

// ---------------------------------------------------------------- 日本時間の字（画面の字と同じ決まり：MM/DD HH:mm）
export const jst = (isoText: string): string => {
  const t = new Date(new Date(isoText).getTime() + 9 * 36e5);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
};

// ---------------------------------------------------------------- 突き合わせの役割の組（束 D・E・F）
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
export const fpair = (name: string, canvas: string, props: string[], app: string = canvas): FidelityPair => ({
  name,
  role: name,
  canvas,
  app,
  props,
});
/** 記録（下絵 .k-f10w-*）：頭・第 2 ナビ・見出し・ことば欄と札・行・字 */
export const LOG_PAIRS: FidelityPair[] = [
  ...F10_PAIRS.filter((p) => ["ws", "sub", "sub-item", "h1", "callout", "toast"].includes(p.name)),
  fpair("tools", ".k-f10w-tools", ["x", "width", "height"]),
  fpair("chip", ".k-f10w-chip", CTRL),
  fpair("entry", ".k-f10w-entry", ["x", "width", "height", "texts"]),
  fpair("when", ".k-f10w-when", TEXT),
  fpair("line", ".k-f10w-line", TEXT),
  fpair("foot", ".k-inv-sub", TEXT),
  fpair("empty", ".k-state", [...BOX, "texts"]),
];
/** 設定（下絵 .k-f10w-*・.k-set-*）：区画ごと（id で指す）・名前の行・ロゴ・選び・帯・小窓 */
const CARDS = ["ws-card", "ws-plan", "ws-who", "ws-del"];
export const SET_PAIRS: FidelityPair[] = [
  ...F10_PAIRS.filter((p) =>
    ["ws", "sub", "sub-item", "h1", "band", "callout", "dialog", "dialog-title", "dialog-btn", "toast"].includes(
      p.name,
    ),
  ),
  // 「プランと支払い」（ws-plan）の区画は箱の位置と見出しの字だけを比べ、中身は比べない（段 13 の K-962 の決め (a)：中身は段 13 の下絵が正・planRow を差しても赤にしない）
  ...CARDS.filter((c) => c !== "ws-plan").map((c) => fpair(c, `section[aria-labelledby="${c}"]`, [...BOX, "texts"])),
  fpair("ws-plan", 'section[aria-labelledby="ws-plan"]', ["x", "y"]),
  fpair("ws-plan-head", "#ws-plan", ["texts"]),
  fpair("field", ".k-f10w-fieldrow", ["x", "width", "height", "texts"]),
  fpair("meta", ".k-f10w-meta", TEXT),
  fpair("mark", ".k-f10w-mark", [...BOX, "texts"]),
  fpair("pick", ".k-f10w-pick", CTRL),
  fpair("danger", ".k-f10w-danger", CTRL),
  fpair(
    "row",
    CARDS.filter((c) => c !== "ws-plan")
      .map((c) => `section[aria-labelledby="${c}"] .k-set-row`)
      .join(", "),
    ["height", "texts"],
  ),
  fpair("caution", ".k-dialog-caution", [...BOX, "texts"]),
  fpair("bullets", ".k-f10w-bullets", TEXT),
  fpair("dlg-input", `${".k-dialog"} .k-input`, ["width", "height", "border-top-color", "texts"]),
  // 権限が無い人の画面（st-no-access）の本文は NoAccess の箱だけ。組に無いと比べる役が 1 つも無い
  fpair("state", 'section[aria-label="設定"] > .k-state', [...BOX, "texts"]),
];
/** 自分の設定（下絵 .k-f10a-*）：区画ごと・顔・名前の行・小窓 */
const ME_CARDS = ["pf-self", "pf-view", "pf-ws"];
export const ME_PAIRS: FidelityPair[] = [
  ...F10_PAIRS.filter((p) =>
    [
      "sub",
      "sub-item",
      "h1",
      "callout",
      "dialog",
      "dialog-title",
      "dialog-label",
      "dialog-err",
      "dialog-btn",
      "toast",
    ].includes(p.name),
  ),
  ...ME_CARDS.map((c) => fpair(c, `section[aria-labelledby="${c}"]`, [...BOX, "texts"])),
  // 顔は「自分」の区画の顔だけ（下絵 me-saved の「ほかの画面での見え方」の見本の顔は本番に出さない・K-839 の作らない物）
  fpair("face", ".k-f10a-face .k-f10a-avatar, .k-f10a-photo", BOX),
  fpair("fieldrow", ".k-f10a-fieldrow", ["x", "width", "height"]),
  fpair("meta", ".k-f10a-meta", TEXT),
  fpair("row", ".k-set-row", ["height", "texts"]),
  fpair("choices", ".k-f10a-choices", ["x", "width", "height"]),
];
