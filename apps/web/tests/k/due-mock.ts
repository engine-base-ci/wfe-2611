// 段 8（F7）の画面の葉 K-484「詳細で期限を変える」が読む試験の道具（K-484 の切る段で作る・2026-11-20）。
//   口は網の手前で差し替える。土台は前からの tests/features/F5/approve-complete.harness.ts の mockApi（詳細・実行・me）で、
//   ここはその上に「期限を変える口」だけを足す（後から足した page.route が先に当たる。道が違えば route.fallback() で土台へ回す）。
//   口の形は口の葉 K-483 の md（精査 1 回目の直しを入れた 2026-11-21 の版：答えは ticket・changed・message_id で stage は無い）に合わせる。形が変わったらここだけを直す：
//     PATCH /api/v1/tickets/:id（updateTicket の期限の組）← { due_on: "YYYY-MM-DD" | null, due_reason: "<理由>", expected_due_on?: <画面が見ていた期限の日か null> }
//        → 200 { data: { ticket, changed, message_id } }。画面は成功の答えの中身を使わず getTicket を読み直す。体に K-483 が欄を足しても、試験は見る欄だけを見る（toMatchObject）
//     GET   /api/v1/tickets/:id（getTicket）→ 前からの答えに can.due（書ける人かつ完了していない）を足す（K-483）
//     失敗は KanameError の形 { error, code, message, detail }。番号は K-483 の表：
//        422 E-DUE-001 理由が空／422 E-DUE-002 理由が 200 字を超える／409 E-VAL-012 期限が今日より前（K-437 が 409 にした番号・欄なし）／409 E-VAL-028 開始日が期限より後（K-437 が定義・欄なし）／
//        409 E-DUE-005 子の期限が親の期限より後／409 E-DUE-006 この期限より後の期限を持つ子がいる／409 E-DUE-007 完了したチケット／409 E-DUE-008 同時に変えられた
//   名前と日付はモック（apps/web/features/F7/saved/sample.ts・apps/web/app/(dev)/dev/mock/f7/states/saved.tsx）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  A_OPEN,
  API_RE,
  ME,
  TICKET,
  mockApi,
  pending,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";

export { ME, TICKET };

/** 固定の時計：2026-11-02（月）日本時間 10:00。モックの今日（11/02）と同じ */
export const NOW = new Date("2026-11-02T01:00:00Z");
export const TITLE = "セイコー様へ 11月分の請求書を送る";
export const NUMBER = "EG-128";
/** モックの理由（f7-tidy-due の入力済みの形） */
export const REASON = "先方から入金の予定日の確認待ちで、1 日待ちます";
/** 期限を過ぎている（炎）・先・今日 */
export const OVERDUE = "2026-11-01";
export const AHEAD = "2026-11-09";
export const TODAY = "2026-11-02";

export interface DueOptions {
  /** 今の期限（null は期限なし）。既定は 11/01（1 日過ぎ） */
  due?: string | null;
  /** 段（既定は承認待ち。モックの f7-tidy-due と同じ） */
  stage?: string;
  /** getTicket の can.due。undefined なら鍵ごと無い（前からの土台と同じ） */
  canDue?: boolean | undefined;
  /** 承認する人の名前（approval.approver_name）。null なら承認の行が無い */
  approver?: string | null;
  /** 担当者の名前（approval が無いときの承認する人の既定）。null なら担当者がいない */
  assignee?: string | null;
}

export interface DueMock {
  api: Mock;
  /** 今の期限（PATCH が通ると替わる。次の getTicket から） */
  due: string | null;
  patches: { body: Record<string, unknown>; key: string | undefined }[];
  ticketReads: number;
  gate: Promise<void>;
  /** PATCH の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  on: { patch: (req: Request) => Reply | Promise<Reply> };
}

const ok = (data: unknown, status = 200): Reply => ({ status, body: { data } });
/** 口の失敗の答え（正本の番号つき） */
export const errReply = (status: number, code: string, detail: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: status === 409 ? "conflict" : "validation", code, message: code, detail },
});

/** 詳細（期限を変える口）を差し替えて立てる。開くのは openDetail。時計は呼ぶ側が page.clock.setFixedTime(NOW) で固定する */
export async function mockDue(page: Page, o: DueOptions = {}): Promise<DueMock> {
  const stage = o.stage ?? "awaiting_approval";
  const approver = o.approver === undefined ? "高本" : o.approver;
  const band: Band = {
    stage,
    approval: approver === null ? null : pending({ id: A_OPEN, approver_name: approver }),
    ...(o.assignee === null ? { assignee: null } : {}),
  };
  const api = await mockApi(page, band);
  const d: DueMock = {
    api,
    due: o.due === undefined ? OVERDUE : o.due,
    patches: [],
    ticketReads: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      d.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      patch: (req) => {
        const b = req.postDataJSON() as { due_on?: string | null };
        d.due = b.due_on ?? null;
        return ok({
          ticket: { id: TICKET, due_on: d.due },
          changed: true,
          message_id: "0193c5a0-0000-7000-8000-0000000d0001",
        });
      },
    },
  };
  api.on.ticket = () => {
    d.ticketReads++;
    const base = ticketOf(band) as unknown as {
      ticket: Record<string, unknown>;
      can: Record<string, unknown>;
    } & Record<string, unknown>;
    const can = { ...base.can, ...(o.canDue === undefined ? {} : { due: o.canDue }) };
    return ok(
      withBand(band, {
        ...base,
        ticket: {
          ...base.ticket,
          number: NUMBER,
          title: TITLE,
          due_on: d.due,
          start_on: "2026-10-30",
          created_at: "2026-10-30T08:44:00Z",
        },
        kind: { id: "k1", name: "タスク", color: "#186F69" },
        stage: { key: stage, name: stage === "awaiting_approval" ? "承認待ち" : "作業中" },
        assignee: o.assignee === null ? null : { id: ME, display_name: o.assignee ?? "高本" },
        can,
      }),
    );
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() !== "PATCH" || p !== `/api/v1/tickets/${TICKET}`) return route.fallback();
    d.patches.push({ body: req.postDataJSON() as Record<string, unknown>, key: req.headers()["idempotency-key"] });
    await d.gate;
    const reply = await d.on.patch(req);
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return d;
}

/** 詳細を開き、実行の一覧の答えが届くまで待つ（時計は固定してから呼ぶ） */
export async function openDetail(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  const runs = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}/runs`);
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await runs;
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
}

export const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル" });
/** 「日付と時間」の区画と、その中の期限の値（dd） */
export const dateSec = (page: Page) => panel(page).getByRole("region", { name: "日付と時間" });
export const dueValue = (page: Page) => dateSec(page).locator("dd").nth(1);
export const dueBtn = (page: Page) => dueValue(page).getByRole("button", { name: "期限を変える", exact: true });
export const flame = (page: Page) => dueValue(page).getByRole("img", { name: "期限切れ", exact: true });
export const popup = (page: Page) => page.getByRole("dialog", { name: "期限を変える", exact: true });
export const quickBtn = (page: Page, label: string) =>
  popup(page).getByRole("group", { name: "すぐ選ぶ", exact: true }).getByRole("button", { name: label, exact: true });
/** 月の格子の日（名前は「11月2日」の形）。月を送ったあとの月の名前も同じ形 */
export const dayBtn = (page: Page, label: string) => popup(page).getByRole("button", { name: label, exact: true });
export const reasonBox = (page: Page) => popup(page).locator("textarea[name='due-reason']");
export const timeBox = (page: Page) => popup(page).getByLabel("時刻", { exact: true });
export const submitBtn = (page: Page, label: string) => popup(page).getByRole("button", { name: label, exact: true });
export const clearBtn = (page: Page) => popup(page).getByRole("button", { name: "期限をなくす", exact: true });
/** 欄の下の赤い字（.k-err）の字の並び */
export const errsOf = (page: Page) => popup(page).locator(".k-err").allTextContents();
/** 小窓の上の赤い箱（口が断ったとき・role=alert の .k-band-notice） */
export const noticeOf = (page: Page) => popup(page).locator(".k-band-notice");
export const noteOf = (page: Page) => popup(page).locator(".k-f7-due-note");

/** 詳細を開き、▾ を押して小窓を開く */
export async function openPop(page: Page, width = 1440): Promise<void> {
  await openDetail(page, width);
  await dueBtn(page).click();
  await expect(popup(page)).toBeVisible();
}

/** パネルの区画の「項目名 → 値」（値の字だけ。aria-hidden の飾りと値の横のボタンは除く） */
export async function fieldsOf(page: Page, section: string): Promise<Record<string, string>> {
  return panel(page)
    .getByRole("region", { name: section })
    .locator("dl")
    .first()
    .evaluate((dl) => {
      const out: Record<string, string> = {};
      dl.querySelectorAll("dt").forEach((dt) => {
        const dd = dt.nextElementSibling?.cloneNode(true) as Element | undefined;
        dd?.querySelectorAll('[aria-hidden="true"], button').forEach((x) => x.remove());
        out[dt.textContent!.trim()] = (dd?.textContent ?? "").trim();
      });
      return out;
    });
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
/** YYYY-MM-DD → 「MM/DD（曜）」（詳細のパネルの書き方） */
export const mdw = (ymd: string) =>
  `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}（${WEEK[new Date(`${ymd}T00:00:00Z`).getUTCDay()]}）`;
/** YYYY-MM-DD → 「MM/DD」（ボタンの字・お知らせの字） */
export const md = (ymd: string) => `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`;
/** 月の格子の日の名前（「11月5日」） */
export const dayName = (ymd: string) => `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;

const BOX = ["width", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
/** 期限を変える小窓の役（モック /dev/mock/f7 と本番で同じセレクタ・同じ部品）。位置は詳細の本文の量で変わるので比べない */
export const DUE_PAIRS: FidelityPair[] = [
  ["due-pop", ".k-f7-due-pop", BOX],
  [
    "due-quick",
    ".k-f7-due-quick-item",
    ["height", "font-size", "color", "background-color", "border-top-color", "texts"],
  ],
  ["due-day-on", '.k-f7-due-day[aria-pressed="true"]', ["background-color", "color", "texts"]],
  ["due-note", ".k-f7-due-note", TEXT],
  ["due-btn", ".k-f7-due-acts button", CTRL],
  ["due-err", ".k-f7-due-pop .k-err", TEXT],
  ["due-notice", ".k-f7-due-pop .k-band-notice", [...BOX, ...TEXT]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
