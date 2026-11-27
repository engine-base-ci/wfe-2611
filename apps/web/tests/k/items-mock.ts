// 項目の表（開発用の頁 /dev/f4-items＝作る面・K-569／/dev/f4-items/detail＝詳細・K-1153）の画面の試験の共通の道具。口は網の手前で差し替える：
//   GET   /api/v1/ticket_kinds                    → { data: [{ id, name, fields: TicketField[] }], meta }（K-560・各種別の fields が会社の項目のマスタ。鍵 7：id・name・field_type・required・description・options・position。作る面はここから読み、次の口は呼ばない）
//   GET   /api/v1/ticket-fields?kind_id=…        → listTicketFields（K-563）。作る面は呼ばない（呼んだら reads に残り試験が赤くなる）
//   GET   /api/v1/tickets/:id                    → { data: { ticket, fields: (TicketField + value)[], completed? } }（K-560 の fields・鍵 8）
//   PATCH /api/v1/tickets/:id   ← { fields: { <項目の id>: 値 } } → 200（K-564）／409 E-FLD-001〜004・404・403・503
//   ほか、頁が種別・メンバー・自分を読む口（ticket_kinds・members・auth-ext/me）を最小の答えで返す。
//   口の振る舞いそのもの（型ごとの確かめ・必須・やり取りの 1 行）は口の葉 K-563・K-564 の試験が持つ。ここの差し替えは
//   「画面が口の答えをどう出し、何を送るか」を見るための最小の作りで、断りは決めた番号と正本の文をそのまま返す。
//   本人の Bridge（127.0.0.1:38617）は届かせない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const WIDTHS = [375, 768, 1440] as const;
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
export const FORBIDDEN_TEXT = "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください";
const API_RE = /\/api\/(v1|auth-ext|auth)\//;

export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const MATE = "11111111-0000-4000-8000-000000000002";
export const KIND_A = "44444444-0000-4000-8000-000000000001";
export const KIND_B = "44444444-0000-4000-8000-000000000002";
export const TICKET_ID = "0193c5a0-0000-7000-8000-00000000c569";

// ---------------------------------------------------------------- 会社の項目のマスタ（K-563 の答え・鍵 7）
export type FieldType = "short_text" | "long_text" | "number" | "date" | "select" | "multi_select" | "check";
export interface Opt {
  id: string;
  name: string;
  position: number;
}
export interface FieldApi {
  id: string;
  name: string;
  field_type: FieldType;
  required: boolean;
  description: string | null;
  options: Opt[];
  position: number;
}
const pad = (n: number): string => String(n).padStart(12, "0");
const fid = (n: number): string => `6f000000-0000-4000-8000-${pad(n)}`;
const oid = (f: number, n: number): string => `7f000000-0000-4000-${String(f).padStart(4, "0")}-${pad(n)}`;
const opts = (f: number, names: string[]): Opt[] =>
  names.map((name, i) => ({ id: oid(f, i + 1), name, position: i + 1 }));
export const field = (n: number, name: string, field_type: FieldType, o: Partial<FieldApi> = {}): FieldApi => ({
  id: fid(n),
  name,
  field_type,
  required: false,
  description: null,
  options: [],
  position: n,
  ...o,
});

/** 下絵 f4v2-create-custom と同じ 8 つ（名前・並び・必須・説明・選択肢が同じ） */
export const MASTER_ALL: FieldApi[] = [
  field(1, "支払期日", "date", { required: true, description: "請求書に書く支払の期日" }),
  field(2, "PJコード", "select", {
    required: true,
    description: "案件ごとのコードを選びます",
    options: opts(2, ["SK-2026-11 セイコー商事 保守", "SK-2026-12 セイコー商事 追加開発"]),
  }),
  field(3, "請求額", "number", { description: "税込の金額（円）" }),
  field(4, "先方の担当者名", "short_text", { description: "請求書の宛名に入れます" }),
  field(5, "分類", "select", {
    description: "請求・問い合わせ・手続きなど",
    options: opts(5, ["請求", "問い合わせ", "手続き"]),
  }),
  field(6, "送る書類", "multi_select", {
    description: "送るものをすべて選びます",
    options: opts(6, ["請求書", "明細", "納品書"]),
  }),
  field(7, "原本の郵送", "check", { description: "原本を郵送する" }),
  field(8, "社内メモ", "long_text", { description: "社内だけで共有する補足" }),
];
/** 下絵 f4v2-create-missing と同じ 3 つ（必須 2・任意 1） */
export const MASTER_3: FieldApi[] = MASTER_ALL.slice(0, 3);
/** 下絵 f4v2-create-missing-types と同じ 7 つ（全部必須・名前・並び・説明が同じ） */
export const MASTER_REQ7: FieldApi[] = [
  field(11, "先方の担当者名", "short_text", { required: true, description: "請求書の宛名に入れます" }),
  field(12, "社内メモ", "long_text", { required: true, description: "社内だけで共有する補足" }),
  field(13, "請求額", "number", { required: true, description: "税込の金額（円）" }),
  field(14, "支払期日", "date", { required: true, description: "請求書に書く支払の期日" }),
  field(15, "分類", "select", {
    required: true,
    description: "請求・問い合わせ・手続きなど",
    options: opts(15, ["請求", "問い合わせ", "手続き"]),
  }),
  field(16, "送る書類", "multi_select", {
    required: true,
    description: "送るものをすべて選びます",
    options: opts(16, ["請求書", "明細", "納品書"]),
  }),
  field(17, "原本の郵送", "check", { required: true, description: "原本を郵送する" }),
];
/** 種別 B の項目（種別 A の MASTER_ALL の 1 つ目「支払期日」だけ重なる） */
export const MASTER_B: FieldApi[] = [MASTER_ALL[0]!, field(21, "問い合わせ元", "short_text")];

export const byName = (master: FieldApi[], name: string): FieldApi => {
  const f = master.find((x) => x.name === name);
  if (!f) throw new Error(`マスタに「${name}」が無い`);
  return f;
};
export const optId = (f: FieldApi, name: string): string => {
  const o = f.options.find((x) => x.name === name);
  if (!o) throw new Error(`「${f.name}」に選択肢「${name}」が無い`);
  return o.id;
};

// ---------------------------------------------------------------- 断りの答え
type Reply = { status: number; body: unknown };
const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });
// 体は本番の口と同じ { error, code } だけ（文を返さない・画面が正本 errors.json の文を引く・K-564）
const err = (status: number, code: string): Reply => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : status === 403 ? "forbidden" : "server_error",
    code,
  },
});
export const conflict = (code: string): Reply => err(409, code);
export const notFound = (): Reply => err(404, "E-PAGE-001");
export const forbidden = (): Reply => err(403, "FORBIDDEN");
export const failed = (): Reply => err(503, "E-PAGE-003");

// ---------------------------------------------------------------- 口の差し替え
export type Value = string | number | boolean | string[] | null;
export interface FieldsMock {
  /** 種別ごとのマスタ（kind_id → 並び） */
  masters: Record<string, FieldApi[]>;
  /** 種別の口（ticket_kinds）の答えの状態。200 以外なら体はエラー（503 など） */
  kindsStatus: number;
  /** 種別の口に飛んだ回数（作る面は 1 回・「読み直す」で 1 回増える） */
  kindReads: number;
  /** listTicketFields に飛んだ kind_id（作る面は呼ばないので空のまま） */
  reads: string[];
  /** 詳細（getTicket）のマスタと値。値は項目の id → 値（null は無い） */
  detail: FieldApi[];
  values: Record<string, Value>;
  /** getTicket の読んだ回数・completed を入れるか */
  ticketReads: number;
  completed: boolean;
  /** PATCH の体（飛んだ順）と、次に返す答えの並び（空なら成功） */
  patches: { fields: Record<string, Value> }[];
  next: Reply[];
  /** 書く口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
  /** 書く口以外の飛んだ要求（頁が読む口の外）を数える */
  writes: string[];
}

/** 種別の口の 1 行（契約 TicketKindChoice の鍵 8：id・name・color・position・is_builtin・sections・body_template・fields） */
const kindRow = (id: string, name: string, position: number, fields: FieldApi[]) => ({
  id,
  name,
  color: null,
  position,
  is_builtin: true,
  sections: [],
  body_template: null,
  fields,
});

/** 詳細の fields（getTicket の答え）：マスタ＋値（無ければ null） */
export const fieldsOf = (master: FieldApi[], values: Record<string, Value>) =>
  master.map((f) => ({ ...f, value: f.id in values ? values[f.id]! : null }));

export async function mockFields(
  page: Page,
  o: Partial<Pick<FieldsMock, "masters" | "kindsStatus" | "detail" | "values" | "completed">> = {},
): Promise<FieldsMock> {
  const m: FieldsMock = {
    masters: o.masters ?? { [KIND_A]: MASTER_ALL, [KIND_B]: MASTER_B },
    kindsStatus: o.kindsStatus ?? 200,
    kindReads: 0,
    reads: [],
    detail: o.detail ?? MASTER_ALL,
    values: o.values ?? {},
    ticketReads: 0,
    completed: o.completed ?? false,
    patches: [],
    next: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    writes: [],
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const method = req.method();
    let r: Reply = err(404, "NOT_FOUND");
    if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/ticket_kinds") {
      m.kindReads++;
      r =
        m.kindsStatus !== 200
          ? err(m.kindsStatus, "E-PAGE-003")
          : ok(
              [
                kindRow(KIND_A, "タスク", 1, m.masters[KIND_A] ?? []),
                kindRow(KIND_B, "課題", 2, m.masters[KIND_B] ?? []),
              ],
              { limit: 50 },
            );
    } else if (p === "/api/v1/members")
      r = ok(
        [
          { id: ME, display_name: "高本", kind_id: "human", deleted_at: null, suspended_at: null },
          { id: MATE, display_name: "山田", kind_id: "human", deleted_at: null, suspended_at: null },
        ],
        { limit: 200 },
      );
    else if (p === "/api/v1/ticket-fields" && method === "GET") {
      const kind = u.searchParams.get("kind_id") ?? "";
      m.reads.push(kind);
      r = ok(m.masters[kind] ?? [], { limit: 200 });
    } else if (p === `/api/v1/tickets/${TICKET_ID}` && method === "GET") {
      m.ticketReads++;
      r = ok({
        ticket: {
          id: TICKET_ID,
          number: "EG-569",
          title: "項目の表の試験",
          due_on: null,
          start_on: null,
          priority: "mid",
        },
        fields: fieldsOf(m.detail, m.values),
        completed: m.completed ? { at: "2026-11-21T00:00:00Z", by: "高本" } : null,
      });
    } else if (p === `/api/v1/tickets/${TICKET_ID}` && method === "PATCH") {
      const body = req.postDataJSON() as { fields: Record<string, Value> };
      m.patches.push(body);
      await m.gate;
      const forced = m.next.shift();
      if (forced) r = forced;
      else {
        for (const [id, v] of Object.entries(body.fields)) {
          if (v === null) delete m.values[id];
          else m.values[id] = v;
        }
        r = ok({ ticket: { id: TICKET_ID } });
      }
    } else if (method !== "GET") m.writes.push(`${method} ${p}`);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

// ---------------------------------------------------------------- 場所と手順
export const HOST = "/dev/f4-items";
export const grid = (page: Page): Locator => page.getByRole("group", { name: "項目", exact: true });
/** 詳細の右のパネル（下絵 detail-views.tsx の ItemsPanel と同じ aside・K-1153） */
export const panel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "チケットのパネル", exact: true });
/** 項目の行（名前の字を持つ組）。名前の列は読み上げから外れているので字で探す */
export const pairOf = (page: Page, name: string): Locator =>
  grid(page)
    .locator(".k-f4d-pair")
    .filter({ has: page.locator(".k-f4d-name", { hasText: new RegExp(`^${name}`) }) });
export const sent = (page: Page): Locator => page.getByRole("status", { name: "送る値" });
export const toastOf = (page: Page, text: string): Locator =>
  page.getByRole("region", { name: "知らせ" }).getByText(text);
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

export interface OpenOptions {
  mode: "create" | "detail";
  width?: number;
  kind?: string;
  slot?: "due";
}
/** 開発用の頁を開き、項目の表（作る面）か右のパネル（詳細）が出るのを待つ */
export async function openHost(page: Page, o: OpenOptions): Promise<void> {
  await page.setViewportSize({ width: o.width ?? 1440, height: (o.width ?? 1440) === 375 ? 812 : 900 });
  // 作る面は /dev/f4-items（K-569）・詳細は /dev/f4-items/detail（K-1153）
  const q = new URLSearchParams();
  if (o.mode === "create") q.set("kind", o.kind ?? KIND_A);
  else q.set("ticket", TICKET_ID);
  if (o.slot) q.set("slot", o.slot);
  const res = await page.goto(`${o.mode === "create" ? HOST : `${HOST}/detail`}?${q.toString()}`);
  expect(res?.status(), "開発用の頁 /dev/f4-items").toBe(200);
  await expect(o.mode === "create" ? grid(page) : panel(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 選ぶ欄（Base UI Select）：名前で開き、選択肢を名前で選ぶ */
export async function choose(scope: Locator, page: Page, label: string, option: string): Promise<void> {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** 送る値（output）の JSON を読む。空なら null */
export async function sentFields(page: Page): Promise<Record<string, unknown> | null> {
  const t = (await sent(page).textContent())?.trim() ?? "";
  return t === "" ? null : ((JSON.parse(t) as { fields: Record<string, unknown> }).fields ?? null);
}
