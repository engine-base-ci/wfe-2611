// 確認項目の欄（開発用の頁 /dev/f4-specs・K-450 が持つ・K-452 の試験も一部を読む）の画面の試験の共通の道具。口は網の手前で差し替える：
//   GET    /api/v1/tickets/:id/test-specs   → { data: SpecItem[], meta: { count, limit, can_edit } }（K-434）
//   POST   /api/v1/tickets/:id/test-specs   ← { title } → 201 { data: SpecItem }（K-434）
//   PATCH  /api/v1/test_specs/:id           ← { version, checked } か { version, title } → 200 { data: SpecItem }（K-435）
//   DELETE /api/v1/test_specs/:id           → 200 { data: SpecItem }（K-435）
//   SpecItem は 6 つの鍵：id・title・checked・position・source・version（K-434 の 5 つに版を足した形）。
//   口の振る舞いそのもの（版・完了後・論理削除）は口の葉 K-434・K-435 の試験が持つ。ここの差し替えは「画面が口の答えをどう出し、
//   何を送るか」を見るための最小の作り：版が違えば 409・E-SPEC-020、チェックの付いた行の文の直しは 409・E-SPEC-021、出どころ knowledge の行の文の直し・外すは 409・E-SPEC-022、足す・直す・外すは
//   持っている行を替えて答える。断りは決めた番号と正本の文のまま返す。本人の Bridge（127.0.0.1:38617）は届かせない。
//   共有の名前（FORBIDDEN_TEXT・conflict・failed・forbidden・msg・matchTicket・toastOf）は K-452 の links-mock.ts・k452-links.spec.ts が読むので残す（K450-MK-001）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { ticketOf, withBand, type Band, type Mock } from "../features/F5/approve-complete.harness";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const WIDTHS = [375, 768, 1440] as const;
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const TICKET = "0193c5a0-0000-7000-8000-00000000c450";

// ---------------------------------------------------------------- 口の答え（行・鍵 6）
export interface SpecApi {
  id: string;
  title: string;
  checked: boolean;
  position: number;
  source: "manual" | "knowledge" | "ai";
  version: number;
}
let seq = 0;
/** 行 1 つ（口の答えの形・版 1・手で足した行・チェックなし） */
export function spec(title: string, o: Partial<SpecApi> = {}): SpecApi {
  seq += 1;
  return {
    id: `5f000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    title,
    checked: false,
    position: seq,
    source: "manual",
    version: 1,
    ...o,
  };
}
/** 下絵 f4v2-specs と同じ 5 件（チェック付き 3・付かない 2・字が同じ） */
export function fiveSpecs(): SpecApi[] {
  return [
    spec("請求書が宛先に届いている", { checked: true }),
    spec("PDF の合計が請求額と合う", { checked: true }),
    spec("請求額が明細の合計と合っている"),
    spec("承認する人が中身を見る", { checked: true }),
    spec("送る前に文面を目で見る"),
  ].map((s, i) => ({ ...s, position: i + 1 }));
}

// ---------------------------------------------------------------- 断りの答え
export type Reply = { status: number; body: unknown };
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : status === 403 ? "forbidden" : "server_error",
    code,
    ...(message ? { message } : {}),
  },
});
/** 422（契約に書ける形の誤り・番号なし）。欄ごとの理由 */
export const invalid = (field: string, message: string): Reply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
export const conflict = (code: string): Reply => err(409, code, msg(code));
export const failed = (): Reply => err(503, "E-PAGE-003");
/** 409・E-SPEC-022（ナレッジの「必ず守る」から入った行の文を直す・外す）。体は { error, code } だけ（field・details・message なし）。文は画面が code から正本で出す */
export const lockedSource = (): Reply => err(409, "E-SPEC-022");
/** 入口が返す 403（message が無い・code FORBIDDEN）。画面は既定の文を出す（FORBIDDEN_TEXT） */
export const forbidden = (): Reply => err(403, "FORBIDDEN");
/** 口の 403 のときに画面が出す既定の文（K-444 以来の言い方・K-452 も読む） */
export const FORBIDDEN_TEXT = "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください";
/** 404（無い・消された・見えない）。口の文は E-PAGE-001 */
export const notFound = (): Reply => err(404, "E-PAGE-001", msg("E-PAGE-001"));

// ---------------------------------------------------------------- 口の差し替え
type Op = "list" | "add" | "update" | "remove";
export interface SpecMock {
  /** 口が今持っている行（足す・直す・外すで替わる） */
  specs: SpecApi[];
  canEdit: boolean;
  /** 読む口の答えの状態。200 以外なら体はエラー */
  readStatus: number;
  reads: number;
  adds: Record<string, unknown>[];
  updates: { id: string; body: Record<string, unknown> }[];
  deletes: string[];
  /** 次に返す答え（空なら普通に答える）。口ごとに先頭から 1 つずつ使う */
  force: Record<Op, Reply[]>;
  /** 書く口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

const renumber = (rows: SpecApi[]): SpecApi[] => rows.map((s, i) => ({ ...s, position: i + 1 }));

export async function mockTestSpecs(
  page: Page,
  o: Partial<Pick<SpecMock, "specs" | "canEdit" | "readStatus">> = {},
): Promise<SpecMock> {
  const m: SpecMock = {
    specs: o.specs ?? fiveSpecs(),
    canEdit: o.canEdit ?? true,
    readStatus: o.readStatus ?? 200,
    reads: 0,
    adds: [],
    updates: [],
    deletes: [],
    force: { list: [], add: [], update: [], remove: [] },
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    let r: Reply = err(404, "NOT_FOUND");
    if (p === `/api/v1/tickets/${TICKET}/test-specs` && method === "GET") {
      m.reads++;
      const forced = m.force.list.shift();
      if (forced) r = forced;
      else if (m.readStatus !== 200) r = failed();
      else
        r = { status: 200, body: { data: m.specs, meta: { count: m.specs.length, limit: 500, can_edit: m.canEdit } } };
    } else if (p === `/api/v1/tickets/${TICKET}/test-specs` && method === "POST") {
      const b = req.postDataJSON() as Record<string, unknown>;
      m.adds.push(b);
      await m.gate;
      const forced = m.force.add.shift();
      if (forced) r = forced;
      else {
        const row = spec(String(b["title"]).replace(/^[\s　]+|[\s　]+$/g, ""), { position: m.specs.length + 1 });
        m.specs = [...m.specs, row];
        r = { status: 201, body: { data: row } };
      }
    } else if (/^\/api\/v1\/test_specs\/[^/]+$/.test(p) && method === "PATCH") {
      const id = p.split("/").at(-1)!;
      const b = req.postDataJSON() as Record<string, unknown>;
      m.updates.push({ id, body: b });
      await m.gate;
      const cur = m.specs.find((s) => s.id === id);
      const forced = m.force.update.shift();
      if (forced) r = forced;
      else if (!cur) r = notFound();
      else if (b["version"] !== cur.version) r = conflict("E-SPEC-020");
      else if ("title" in b && cur.source === "knowledge") r = lockedSource();
      else if ("title" in b && cur.checked) r = conflict("E-SPEC-021");
      else {
        const next: SpecApi = {
          ...cur,
          ...("checked" in b ? { checked: b["checked"] === true } : {}),
          ...("title" in b ? { title: String(b["title"]).replace(/^[\s　]+|[\s　]+$/g, "") } : {}),
          version: cur.version + 1,
        };
        m.specs = m.specs.map((s) => (s.id === id ? next : s));
        r = { status: 200, body: { data: next } };
      }
    } else if (/^\/api\/v1\/test_specs\/[^/]+$/.test(p) && method === "DELETE") {
      const id = p.split("/").at(-1)!;
      m.deletes.push(id);
      await m.gate;
      const cur = m.specs.find((s) => s.id === id);
      const forced = m.force.remove.shift();
      if (forced) r = forced;
      else if (!cur) r = notFound();
      else if (cur.source === "knowledge") r = lockedSource();
      else {
        m.specs = renumber(m.specs.filter((s) => s.id !== id));
        r = { status: 200, body: { data: cur } };
      }
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

// ---------------------------------------------------------------- 場所と手順
export const HOST = "/dev/f4-specs";
/** 確認項目の欄（部品の外側のグループ） */
export const specsOf = (page: Page): Locator => page.getByRole("group", { name: "確認項目の欄", exact: true });
export const lineOf = (page: Page, title: string): Locator =>
  specsOf(page).getByRole("listitem").filter({ hasText: title });
export const boxOf = (page: Page, title: string): Locator =>
  specsOf(page).getByRole("checkbox", { name: title, exact: true });
export const textBtn = (page: Page, title: string): Locator =>
  specsOf(page).getByRole("button", { name: `${title}を直す`, exact: true });
export const rmBtn = (page: Page, title: string): Locator =>
  specsOf(page).getByRole("button", { name: `${title}を外す`, exact: true });
export const addBtn = (page: Page): Locator =>
  specsOf(page).getByRole("button", { name: "＋ 確認項目を足す", exact: true });
export const aiBtn = (page: Page): Locator => specsOf(page).getByRole("button", { name: "AI の案を出す", exact: true });
export const openBtn = (page: Page): Locator => specsOf(page).getByRole("button", { name: "開く", exact: true });
export const dialogOf = (page: Page): Locator => page.getByRole("dialog", { name: "確認項目を足す", exact: true });
export const toastOf = (page: Page, text: string): Locator =>
  page.getByRole("region", { name: "知らせ" }).getByText(text);
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export const HINT = "確認項目はまだありません。足すと、終わったときに機械と人が確かめます";

export interface OpenOptions {
  mode: "create" | "detail";
  width?: number;
  /** 詳細：getTicket の spec_count に当たる値（既定は行の数） */
  count?: number;
  /** 作る面：最初から持たせる行の数（題名「確認項目 1」…） */
  n?: number;
  /** 詳細：足す小窓を外（親）から開ける形（K-571 が使う）。controlled＝SpecsItem に addOpen を渡す・only＝小窓だけ（SpecAddOnly）。どちらも頁の「外から開く」で開く */
  ext?: "controlled" | "only";
}
export const extBtn = (page: Page): Locator => page.getByRole("button", { name: "外から開く", exact: true });
/** 開発用の頁を開き、確認項目の欄が出るのを待つ（開くまで読まない詳細は閉じた形のまま） */
export async function openHost(page: Page, o: OpenOptions): Promise<void> {
  const w = o.width ?? 1440;
  await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
  const q = new URLSearchParams({ mode: o.mode });
  if (o.mode === "detail") {
    q.set("ticket", TICKET);
    q.set("count", String(o.count ?? 0));
    if (o.ext) q.set("ext", o.ext);
  } else q.set("n", String(o.n ?? 0));
  const res = await page.goto(`${HOST}?${q.toString()}`);
  expect(res?.status(), "開発用の頁 /dev/f4-specs").toBe(200);
  await expect(o.ext === "only" ? extBtn(page) : specsOf(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
/** 詳細を口を差し替えて開き、既定では「開く」を押して読ませる（読めなかったときは赤い箱まで） */
export async function openSpecs(
  page: Page,
  o: Partial<Pick<SpecMock, "specs" | "canEdit" | "readStatus">> & { width?: number; closed?: boolean } = {},
): Promise<SpecMock> {
  const m = await mockTestSpecs(page, o);
  await openHost(page, { mode: "detail", ...(o.width ? { width: o.width } : {}), count: m.specs.length });
  if (!o.closed) {
    await openBtn(page).click();
    await expect.poll(() => m.reads).toBeGreaterThanOrEqual(1);
    if (m.readStatus === 200) await expect(openBtn(page)).toHaveCount(0);
  }
  return m;
}
/** 足す小窓を開く */
export async function openAdd(page: Page): Promise<Locator> {
  await addBtn(page).click();
  const d = dialogOf(page);
  await expect(d).toBeVisible();
  return d;
}
/** 作る面の送る値（output）の specs を読む */
export async function sentSpecs(page: Page): Promise<string[]> {
  const t = (await page.getByRole("status", { name: "送る値" }).textContent())?.trim() ?? "";
  return t === "" ? [] : (JSON.parse(t) as { specs: string[] }).specs;
}

/** 本番の詳細を、モックの EG-119 と同じ題名・番号にする（K-452 の links-mock が詳細の外枠を組むときに使う・K-571 が詳細を作り直したら K-571 が直す） */
export function matchTicket(m: Mock, band: Band = { stage: "doing" }): void {
  m.on.ticket = () => {
    const base = ticketOf(band) as unknown as Record<string, Record<string, unknown>>;
    return {
      status: 200,
      body: {
        data: withBand(band, {
          ...base,
          ticket: {
            ...base["ticket"],
            number: "EG-119",
            title: "問い合わせ（山田様）に一次返信する",
            start_on: "2026-11-20",
            due_on: "2026-11-27",
            created_at: "2026-11-20T00:40:00Z",
          },
          sections: [
            {
              key: "goal",
              label: "目的",
              body: { text: "山田様の問い合わせ（保守の範囲）に、今日中に一次返信する" },
              version: 1,
            },
            {
              key: "done",
              label: "完了の条件",
              body: { text: "山田様に一次返信のメールが届いている\n詳しい回答の期日を伝えている" },
              version: 1,
            },
          ],
          kind: { name: "タスク", color: "#22345C" },
          stage: { key: "doing", name: "作業中" },
        }),
      },
    };
  };
}
