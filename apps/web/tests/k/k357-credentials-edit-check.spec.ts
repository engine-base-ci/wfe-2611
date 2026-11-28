// K-357「預けたログイン情報の画面を口につなぐ：上書き・消す・確かめの結果（確かめている・PC が無い・規約で禁止）・もう一度確かめる・コードを入れる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f3/cred-checking・cred-no-pc・cred-forbidden・cred-edit・cred-remove・cred-code と、行の操作が押せる形の cred-list
//     （本番と同じ部品 features/F3/credentials/views.tsx・代表 OK answer=0a262be577b2）。画面の入れ物と一覧・預けるは K-356。
//   ログイン・外枠・段の門・役は本物（signupViaApi・loginAs）。預けたログイン情報の口（listCredentials・updateCredential・deleteCredential・
//     checkCredentialLogin・answerCredentialLoginCheck）と getMySecurity・stepUp だけを網の手前で差し替える（口の葉 K-351・K-353・K-355 と同時に書いているため）。
//   読み直し（確かめている間）は時計を進めて数える（固定の待ちは使わない）。本人の Bridge（127.0.0.1:38617）にも届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K357_FAKE_PW, K357_FAKE_VALUE, K357_STEP_PW } from "../../test/_fake/secrets";

const PATH = "/settings/credentials";
const SEC = 'section[aria-labelledby="credentials-title"]';
const ME_SUB = '[aria-label="自分の設定の中"]';
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 日本の 11/18 12:00 */
const NOW = "2026-11-18T03:00:00Z";
/** 確かめている・コードを待っている間の読み直しの間（チケットの決め） */
const POLL_MS = 3_000;
const WS_NAME = "株式会社ENGINE BASE";
const ME_NAME = "高本 聖斗";
/** 試験の作り物の値（本物の秘密ではない・値は _fake/secrets.ts の K-357 の区切り） */
const FAKE_VALUE = K357_FAKE_VALUE;
const FAKE_PW = K357_FAKE_PW;
const STEP_PW = K357_STEP_PW;
const USER_MAIL = "user-k357@example.com";

test.use({ timezoneId: "Asia/Tokyo" });

/** login_check.state（K-352・K-355 の値。null は確かめていない）。一覧の形は K-351 の toCredential（正は 11_tickets/K-351.md） */
type CheckState =
  | "pending"
  | "running"
  | "asking"
  | "waiting"
  | "ok"
  | "bad_password"
  | "bad_code"
  | "needs_2fa"
  | "captcha"
  | "unreachable"
  | "no_form"
  | "stopped"
  | "no_answer"
  | "no_bridge"
  | "forbidden";
interface Item {
  id: string;
  name: string;
  description: string | null;
  layer: "workspace" | "personal";
  kind: "login" | "key";
  two_factor: "none" | "totp" | "sms" | "email" | "push" | null;
  destinations: string[];
  expires_on: string | null;
  use_count: number;
  last_used_at: string | null;
  /** request_id（一覧で読む欄）は asking のときだけ（コードを返す口 answerCredentialLoginCheck の入力 request_ref の値になる・K-351／K-355 に足してもらう欄） */
  login_check: { state: CheckState | null; detail: string | null; at: string | null; request_id?: string | null };
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}
const lc = (state: CheckState | null, o: Partial<Item["login_check"]> = {}): Item["login_check"] => ({
  state,
  detail: null,
  at: null,
  ...o,
});
const T0 = "2026-09-01T00:00:00Z";
/** モックの ITEMS と同じ名前・説明・使える場所・札（K-356 の試験と同じ） */
const C1: Item = {
  id: "c1",
  name: "GMAIL_WORK",
  description: "会社の Gmail（送信用）",
  layer: "workspace",
  kind: "login",
  two_factor: "none",
  destinations: ["mail.google.com", "smtp.gmail.com"],
  expires_on: null,
  use_count: 18,
  last_used_at: "2026-11-01T02:00:00Z",
  login_check: lc("ok", { at: "2026-11-01T01:00:00Z" }),
  can_edit: true,
  created_at: T0,
  updated_at: T0,
};
const C2: Item = {
  ...C1,
  id: "c2",
  name: "HACCHU_NAVI_LOGIN",
  description: "発注ナビのログイン",
  two_factor: "sms",
  destinations: ["hacchu-navi.example"],
  use_count: 22,
  last_used_at: "2026-11-18T01:00:00Z",
  login_check: lc("asking", { at: "2026-11-18T02:58:00Z", request_id: "rq-c2" }),
};
const C3: Item = {
  ...C1,
  id: "c3",
  name: "FREEE_API_KEY",
  description: "会計ソフトの API キー",
  kind: "key",
  two_factor: null,
  destinations: ["api.freee.co.jp"],
  // 期限が近いは期限の 1 日前から（代表の答え answer=e34268dbfbac）。11/18 から見て 11/19 は期限が近い（モックの札と同じ）
  expires_on: "2026-11-19",
  use_count: 3,
  last_used_at: "2026-10-29T05:00:00Z",
  login_check: lc(null),
};
const C4: Item = {
  ...C1,
  id: "c4",
  name: "SEIKO_PORTAL",
  description: "セイコー様の請求書システム（見るだけ）",
  destinations: ["portal.seiko.example"],
  use_count: 1,
  last_used_at: "2026-11-01T03:00:00Z",
  login_check: lc("bad_password", { at: "2026-11-18T01:20:00Z", detail: "ログイン名かパスワードが違うようです" }),
};
const LIST = [C1, C2, C3, C4];
/** モックの one()：発注ナビの 1 行だけで確かめの状態を替えた物 */
const one = (state: CheckState): Item[] => [{ ...C2, login_check: lc(state, { at: NOW }) }];

type Reply = { status: number; body: unknown };
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, message },
});
const fieldErr = (fields: Record<string, string>): Reply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: Object.entries(fields).map(([field, message]) => ({ field, message })),
  },
});
const never = () => new Promise<never>(() => undefined);

type OnceKey = "read" | "update" | "remove" | "recheck" | "answer" | "stepUp";
interface Mock {
  items: Item[];
  reads: number;
  updates: { id: string; body: Record<string, unknown> }[];
  removes: string[];
  rechecks: string[];
  answers: { id: string; body: Record<string, unknown> }[];
  stepUps: Record<string, unknown>[];
  /** 上書きが取り直しを求める（stepUp が通るまで 403。消すは本人確認なし・K-353） */
  needStepUp: boolean;
  /** この口の答えを止める（二度押し） */
  hold: Partial<Record<"update" | "remove" | "recheck" | "answer", boolean>>;
  once: Partial<Record<OnceKey, Reply | "abort">>;
  /** 読み直しの n 回目から返す一覧（確かめが終わった など） */
  after: { at: number; items: Item[] } | null;
  creates: number;
}

async function mockApi(page: Page, items: Item[], o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = {
    items: structuredClone(items),
    reads: 0,
    updates: [],
    removes: [],
    rechecks: [],
    answers: [],
    stepUps: [],
    needStepUp: false,
    hold: {},
    after: null,
    creates: 0,
    ...o,
    once: { ...(o.once ?? {}) },
  };
  const take = (k: OnceKey) => {
    const v = m.once[k];
    delete m.once[k];
    return v;
  };
  const setState = (id: string, state: CheckState) => {
    m.items = m.items.map((it) => (it.id === id ? { ...it, login_check: lc(state, { at: NOW }) } : it));
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(
    /\/api\/v1\/(credentials|me\/security|auth\/step-up)(\/|\?|$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const method = req.method();
      const body = () => (req.postDataJSON() as Record<string, unknown> | null) ?? {};
      const id = p.split("/")[4] ?? "";
      let r: Reply | "abort" = err(404, "NOT_FOUND");
      if (method === "GET" && p === "/api/v1/credentials") {
        m.reads += 1;
        if (m.after && m.reads >= m.after.at) m.items = structuredClone(m.after.items);
        r = take("read") ?? ok(m.items);
      } else if (method === "POST" && p === "/api/v1/credentials") {
        m.creates += 1;
      } else if (method === "PATCH" && /^\/api\/v1\/credentials\/[^/]+$/.test(p)) {
        m.updates.push({ id, body: body() });
        if (m.hold.update) return never();
        const once = take("update");
        if (once) r = once;
        else if (m.needStepUp) r = err(403, "STEP_UP_REQUIRED");
        else {
          if (m.items.find((it) => it.id === id)?.kind === "login") setState(id, "pending");
          r = ok(m.items.find((it) => it.id === id));
        }
      } else if (method === "DELETE" && /^\/api\/v1\/credentials\/[^/]+$/.test(p)) {
        m.removes.push(id);
        if (m.hold.remove) return never();
        const once = take("remove");
        if (once) r = once;
        else {
          m.items = m.items.filter((it) => it.id !== id);
          r = ok({ id });
        }
      } else if (method === "POST" && /\/login-check$/.test(p)) {
        m.rechecks.push(id);
        if (m.hold.recheck) return never();
        const once = take("recheck");
        if (once) r = once;
        else {
          setState(id, "pending");
          r = ok({ state: "pending", job_id: `job-${id}` }, 201);
        }
      } else if (method === "POST" && /\/login-check\/answer$/.test(p)) {
        m.answers.push({ id, body: body() });
        if (m.hold.answer) return never();
        const once = take("answer");
        if (once) r = once;
        else {
          setState(id, "waiting");
          r = ok({ accepted: true }, 201);
        }
      } else if (method === "GET" && p === "/api/v1/me/security") {
        r = ok({ passkeys: [], has_password: true, two_factor: false, backup_codes_left: null, mfa_pending: false });
      } else if (method === "POST" && p === "/api/v1/auth/step-up") {
        m.stepUps.push(body());
        r = take("stepUp") ?? ok({ step_up_at: NOW }, 201);
        if (r !== "abort" && r.status === 201) m.needStepUp = false;
      }
      if (r === "abort") return route.abort("internetdisconnected");
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    },
  );
  return m;
}

async function person() {
  const u = await signupViaApi(WS_NAME);
  await admin("update members set display_name = $2 where id = $1", [u.memberId, ME_NAME]);
  await setupStep(u.memberId, 6);
  return u;
}
/** 時計を据えて開く（読み直しの間を runFor で進める） */
async function openList(page: Page, width = 1440) {
  await page.clock.install({ time: new Date(NOW) });
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/credentials");
  const res = await page.goto(PATH);
  expect(res?.status()).toBe(200);
  await answered;
  await expect(page.locator(`${SEC} h1`)).toHaveText("預けたログイン情報");
}
async function ready(page: Page, items: Item[], o: Partial<Mock> = {}, width = 1440): Promise<Mock> {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, items, o);
  await openList(page, width);
  return m;
}
const row = (page: Page, name: string) => page.locator(`${SEC} .k-set-row`, { hasText: name });
const rowBtn = (page: Page, name: string, label: string) =>
  row(page, name).getByRole("button", { name: label, exact: true });
const editDialog = (page: Page, name: string) => page.getByRole("dialog", { name: `${name} を上書きする` });
const removeDialog = (page: Page, name: string) => page.getByRole("alertdialog", { name: `${name} を消しますか？` });
const codeDialog = (page: Page, name: string) => page.getByRole("dialog", { name: `${name} のコードを入れる` });
const checkDialog = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます" });
/** 読み直しを 1 回分進め、その答えを待つ */
async function tick(page: Page, m: Mock) {
  const before = m.reads;
  await page.clock.runFor(POLL_MS);
  await expect.poll(() => m.reads).toBeGreaterThan(before);
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const BODY_PAIRS: FidelityPair[] = [
  pair("cred-h1", `${SEC} h1`, ["x", "y", ...TXT]),
  pair("cred-card-head", `${SEC} .k-set-card-head`, ["x", "y", ...TXT]),
  pair("cred-row", `${SEC} .k-set-row`, [...BOX, "padding-top", "padding-left"]),
  pair("cred-name", `${SEC} .k-set-name`, ["x", "y", ...TXT]),
  // 行の中身の字も比べる（モックの見本の字を表に在る値にそろえた・代表の答え answer=e34268dbfbac）。札・ボタンの字も比べる
  pair("cred-detail", `${SEC} .k-set-detail`, ["x", "y", ...TXT]),
  pair("cred-pill", `${SEC} .k-set-pill`, [...BOX, "font-size", "color", "texts"]),
  pair("cred-btn", `${SEC} .k-set-btn`, [...BOX, "font-size", "color", "opacity", "texts"]),
  pair("me-sub", ME_SUB, ["width", "x", "y"]),
];
const DLG = ".k-dialog";
const DIALOG_PAIRS: FidelityPair[] = [
  pair("dlg", DLG, [...BOX, "padding-top"]),
  pair("dlg-title", `${DLG} .k-dialog-title`, ["x", "y", ...TXT]),
  pair("dlg-sub", `${DLG} .k-dialog-sub`, ["x", "y", "font-size", "color", "texts"]),
  pair("dlg-desc", `${DLG} .k-dialog-desc`, ["x", "y", "font-size", "color", "texts"]),
  pair("dlg-caution", `${DLG} .k-dialog-caution`, [...BOX, "color", "texts"]),
  pair("dlg-label", `${DLG} label`, ["x", "y", ...TXT]),
  pair("dlg-input", `${DLG} input`, [...BOX, "font-size"]),
  pair("dlg-note-box", `${DLG} .k-auth-note-box`, [...BOX, "font-size", "texts"]),
  pair("dlg-btn", `${DLG} .k-dialog-actions button`, [...BOX, "font-size", "color", "texts"]),
];
type PairsOptions = MatchOptions & { pairs: FidelityPair[]; base: string };

const BODY_PROD: Record<string, Item[]> = {
  "cred-list": LIST,
  "cred-checking": one("running"),
  "cred-no-pc": one("no_bridge"),
  "cred-forbidden": one("forbidden"),
};
for (const [id, items] of Object.entries(BODY_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K357-UI-001 ${id} 幅 ${w}：本文（行の名前・中身の位置と字の大きさと字・札・行の操作のボタン（薄さも））の値がモックと同じ`, async ({
      browser,
    }) => {
      const u = await person();
      const opts: PairsOptions = { pairs: BODY_PAIRS, base: "/dev/mock/f3" };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await loginAs(page, u.token);
          await mockApi(page, items);
          await openList(page, w);
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("cred-btn");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

const DIALOG_PROD: Record<string, (p: Page) => Promise<void>> = {
  "cred-edit": (p) => rowBtn(p, "SEIKO_PORTAL", "上書き").click(),
  "cred-remove": (p) => rowBtn(p, "SEIKO_PORTAL", "消す").click(),
  "cred-code": (p) => rowBtn(p, "HACCHU_NAVI_LOGIN", "コードを入れる").click(),
};
for (const [id, act] of Object.entries(DIALOG_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K357-UI-002 ${id} 幅 ${w}：小窓（箱・題・補足・説明・注意・項目名・欄・注の箱・ボタン）の値がモックと同じ`, async ({
      browser,
    }) => {
      const u = await person();
      const opts: PairsOptions = { pairs: DIALOG_PAIRS, base: "/dev/mock/f3", blur: true };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await loginAs(page, u.token);
          await mockApi(page, LIST);
          await openList(page, w);
          await act(page);
          await expect(page.locator(DLG).last()).toBeVisible();
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dlg-title");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 確かめの結果と読み直し

test("K357-UI-003 行の操作：上書き・消す は自分が書ける行（can_edit）だけ押せる（書けない行は灰色・口を呼ばない）。コードを入れる は asking の行だけ、もう一度確かめる は パスワードが違う・画像の確認・止まった・まだ確かめていない のログインの行だけ", async ({
  page,
}) => {
  const L = (name: string, state: CheckState | null): Item => ({
    ...C1,
    id: name,
    name,
    login_check: lc(state, { at: NOW }),
  });
  const m = await ready(page, [
    ...LIST,
    L("CAPTCHA_SITE", "captcha"),
    L("STOPPED_SITE", "stopped"),
    L("UNCHECKED_SITE", null),
    { ...C1, id: "ro", name: "READ_ONLY_WS", can_edit: false },
  ]);
  for (const n of ["GMAIL_WORK", "HACCHU_NAVI_LOGIN", "FREEE_API_KEY", "SEIKO_PORTAL"]) {
    await expect(rowBtn(page, n, "上書き"), n).toBeEnabled();
    await expect(rowBtn(page, n, "消す"), n).toBeEnabled();
  }
  await expect(rowBtn(page, "READ_ONLY_WS", "上書き")).toBeDisabled();
  await expect(rowBtn(page, "READ_ONLY_WS", "消す")).toBeDisabled();
  await expect(rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる")).toBeEnabled();
  for (const n of ["SEIKO_PORTAL", "CAPTCHA_SITE", "STOPPED_SITE", "UNCHECKED_SITE"])
    await expect(rowBtn(page, n, "もう一度確かめる"), n).toBeEnabled();
  for (const n of ["GMAIL_WORK", "FREEE_API_KEY", "HACCHU_NAVI_LOGIN"])
    await expect(rowBtn(page, n, "もう一度確かめる"), n).toHaveCount(0);
  await expect(rowBtn(page, "GMAIL_WORK", "コードを入れる")).toHaveCount(0);
  expect(m.updates.length + m.removes.length + m.rechecks.length).toBe(0);
});

test("K357-UI-004 確かめている（running）：札「確かめている」と「PC がログインして確かめている」。3 秒ごとに一覧を読み直し、結果（ok）が来たら札が「使える」に替わって読み直しをやめる", async ({
  page,
}) => {
  const m = await ready(page, one("running"), {
    after: { at: 3, items: [{ ...C2, login_check: lc("ok", { at: NOW }) }] },
  });
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("確かめている");
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-detail")).toContainText("PC がログインして確かめている");
  expect(m.reads).toBe(1);
  await tick(page, m);
  expect(m.reads).toBe(2);
  await tick(page, m);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("使える");
  const done = m.reads;
  await page.clock.runFor(POLL_MS * 3);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("使える");
  expect(m.reads).toBe(done);
});

test("K357-UI-005 PC がつながっていない（no_bridge）・規約で禁止（forbidden）：札と補足（「PC をつなぐと、1 回ログインして確かめる」「このサービスは規約で自動のログインを禁止しているので、分身は使わない」）。もう一度確かめるは出さず、読み直しもしない", async ({
  page,
}) => {
  const m = await ready(page, [
    { ...C2, login_check: lc("no_bridge", { at: NOW }) },
    { ...C4, login_check: lc("forbidden", { at: NOW }) },
  ]);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("PC がつながると確かめる");
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-detail")).toContainText(
    "PC をつなぐと、1 回ログインして確かめる",
  );
  await expect(row(page, "SEIKO_PORTAL").locator(".k-set-pill")).toHaveText("規約で禁止・試さない");
  await expect(row(page, "SEIKO_PORTAL").locator(".k-set-detail")).toContainText(
    "このサービスは規約で自動のログインを禁止しているので、分身は使わない",
  );
  await expect(rowBtn(page, "SEIKO_PORTAL", "もう一度確かめる")).toHaveCount(0);
  await page.clock.runFor(POLL_MS * 2);
  expect(m.reads).toBe(1);
});

test("K357-UI-006 もう一度確かめる：POST /api/v1/credentials/c4/login-check が 1 回（答えを止めた間に二度押しても 1 回）。201 の後に一覧を読み直して札が「確かめている」に替わる", async ({
  page,
  browser,
}) => {
  const m = await ready(page, LIST, { hold: { recheck: true } });
  const sent = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/v1/credentials/c4/login-check"),
  );
  await rowBtn(page, "SEIKO_PORTAL", "もう一度確かめる").click();
  await sent;
  await rowBtn(page, "SEIKO_PORTAL", "もう一度確かめる").click({ force: true });
  expect(m.rechecks).toEqual(["c4"]);

  const p2 = await browser.newPage();
  const m2 = await ready(p2, LIST);
  await rowBtn(p2, "SEIKO_PORTAL", "もう一度確かめる").click();
  await expect(row(p2, "SEIKO_PORTAL").locator(".k-set-pill")).toHaveText("確かめている");
  expect(m2.rechecks).toEqual(["c4"]);
  expect(m2.reads).toBe(2);
  await p2.close();
});

test("K357-UI-007 手順 S3 の失敗：503 → 口の文の赤の知らせ、札はそのまま。409（E-CRED-012 もう確かめている）→ 一覧を読み直す（札は確かめている）", async ({
  page,
}) => {
  const down = "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください";
  const m = await ready(page, LIST, { once: { recheck: err(503, "E-PAGE-003", down) } });
  await rowBtn(page, "SEIKO_PORTAL", "もう一度確かめる").click();
  await expect(page.getByText(down)).toBeVisible();
  await expect(row(page, "SEIKO_PORTAL").locator(".k-set-pill")).toHaveText("パスワードが違う");
  m.once.recheck = err(409, "E-CRED-012", "いま確かめています");
  m.after = { at: m.reads + 1, items: [C1, C2, C3, { ...C4, login_check: lc("running", { at: NOW }) }] };
  await rowBtn(page, "SEIKO_PORTAL", "もう一度確かめる").click();
  await expect(row(page, "SEIKO_PORTAL").locator(".k-set-pill")).toHaveText("確かめている");
});

test("K357-UI-008 コードを入れる（SMS）：小窓「HACCHU_NAVI_LOGIN のコードを入れる」・「SMS で届いた」→ 6 けたを入れて「PC に渡す」→ answer の口に { request_ref, code } が 1 回 → 小窓が閉じ、読み直して札が「確かめている」", async ({
  page,
}) => {
  const m = await ready(page, LIST);
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  const d = codeDialog(page, "HACCHU_NAVI_LOGIN");
  await expect(d).toContainText("SMS で届いた");
  await d.getByLabel("コード").fill("123456");
  await d.getByRole("button", { name: "PC に渡す" }).click();
  await expect(d).toHaveCount(0);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("確かめている");
  expect(m.answers).toEqual([{ id: "c2", body: { request_ref: "rq-c2", code: "123456" } }]);
});

test("K357-UI-009 コードの表記ゆらぎと誤り：全角・空白入り（１２３ ４５６）は 123456 で送る。口の 422（E-VAL-009）は欄の下に口の文・小窓は閉じない・入れた字は残る", async ({
  page,
}) => {
  const bad = "コードは数字で入れてください";
  const m = await ready(page, LIST, { once: { answer: fieldErr({ code: bad }) } });
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  const d = codeDialog(page, "HACCHU_NAVI_LOGIN");
  await d.getByLabel("コード").fill("１２３ ４５６");
  await d.getByRole("button", { name: "PC に渡す" }).click();
  await expect(d).toContainText(bad);
  await expect(d.getByLabel("コード")).toHaveValue("１２３ ４５６");
  expect(m.answers[0]!.body).toEqual({ request_ref: "rq-c2", code: "123456" });
});

test("K357-UI-010 手順 S4 の失敗：もう頼まれていない（404 E-CRED-014・待つのが終わった）→ 小窓を閉じ、口の文の知らせを出し、一覧を 1 回読み直す", async ({
  page,
}) => {
  const gone = "コードを待つ時間が過ぎたので、確かめを止めました";
  const m = await ready(page, LIST, { once: { answer: err(404, "E-CRED-014", gone) } });
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  const d = codeDialog(page, "HACCHU_NAVI_LOGIN");
  await d.getByLabel("コード").fill("123456");
  const reads = m.reads;
  await d.getByRole("button", { name: "PC に渡す" }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByText(gone)).toBeVisible();
  await expect.poll(() => m.reads).toBe(reads + 1);
});

test("K357-UI-011 スマホのアプリで承認（2 段階が push）：コードの欄は出さず、「PC に渡す」で { request_ref, approved: true } を送る", async ({
  page,
}) => {
  const m = await ready(page, [{ ...C2, two_factor: "push" }]);
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  const d = codeDialog(page, "HACCHU_NAVI_LOGIN");
  await expect(d.getByLabel("コード")).toHaveCount(0);
  await expect(d).toContainText("スマホのアプリで「承認」を押してから");
  await d.getByRole("button", { name: "PC に渡す" }).click();
  await expect(d).toHaveCount(0);
  expect(m.answers).toEqual([{ id: "c2", body: { request_ref: "rq-c2", approved: true } }]);
});

test("K357-UI-012 「あとで」：何も送らず閉じる。コードを待っている（asking）間は 3 秒ごとに読み直す（待つのが終わったら札が替わる）", async ({
  page,
}) => {
  const m = await ready(page, LIST, {
    after: {
      at: 2,
      items: [
        C1,
        {
          ...C2,
          login_check: lc("no_answer", { at: NOW, detail: "10 分のあいだにコードが届かなかったので止めました" }),
        },
        C3,
        C4,
      ],
    },
  });
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  await codeDialog(page, "HACCHU_NAVI_LOGIN").getByRole("button", { name: "あとで" }).click();
  await expect(codeDialog(page, "HACCHU_NAVI_LOGIN")).toHaveCount(0);
  expect(m.answers).toEqual([]);
  await tick(page, m);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("止まった");
});

test("K357-UI-013 上書き（API キー）：小窓に今の使える場所と期限（2026/11/19）が入っている・理由は空・ログイン ID の欄は無い。新しい値と理由で「本人確認して上書き」→ PATCH /api/v1/credentials/c3 が 1 回・体は決めた形 → 閉じて読み直す。値の字は頁に残らない", async ({
  page,
}) => {
  const m = await ready(page, LIST);
  await rowBtn(page, "FREEE_API_KEY", "上書き").click();
  const d = editDialog(page, "FREEE_API_KEY");
  await expect(d.getByLabel("使える場所")).toHaveValue("api.freee.co.jp");
  await expect(d.getByLabel("期限（任意）")).toHaveValue("2026/11/19");
  await expect(d.getByLabel("なぜ上書きするか（任意・記録に残る）")).toHaveValue("");
  await expect(d.getByLabel("新しいログイン ID")).toHaveCount(0);
  await d.getByLabel("新しい値").fill(FAKE_VALUE);
  await d.getByLabel("期限（任意）").fill("2027/11/10");
  await d.getByLabel("なぜ上書きするか（任意・記録に残る）").fill("会計ソフトで作り直したため");
  const reads = m.reads;
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => m.reads).toBe(reads + 1);
  expect(m.updates).toEqual([
    {
      id: "c3",
      body: {
        value: FAKE_VALUE,
        destinations: ["api.freee.co.jp"],
        expires_on: "2027-11-10",
        reason: "会計ソフトで作り直したため",
      },
    },
  ]);
  expect(await page.content()).not.toContain(FAKE_VALUE);
});

// 代表の答え answer=e34268dbfbac：パスワードだけ替えるときも ID とパスワードを両方入れ直す（上書きの小窓に「新しいログイン ID」の欄・部品は切る段で足し K-350 が運ぶ）
test("K357-UI-014 上書き（ログイン情報・代表の答え answer=e34268dbfbac）：欄は「新しいログイン ID」と「新しいパスワード」。値を空のままなら送らない（使える場所だけ替える・表記ゆらぎは整える・期限を空にすると expires_on は null）。両方を入れると体に login と password。替えた行は読み直すと確かめている", async ({
  page,
}) => {
  const m = await ready(page, LIST);
  await rowBtn(page, "SEIKO_PORTAL", "上書き").click();
  const d = editDialog(page, "SEIKO_PORTAL");
  await expect(d.getByLabel("新しいログイン ID")).toHaveValue("");
  await expect(d.getByLabel("新しいパスワード")).toHaveValue("");
  await d.getByLabel("使える場所").fill("portal.seiko.example、ＳＳＯ.seiko.example");
  await d.getByLabel("期限（任意）").fill("");
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d).toHaveCount(0);
  expect(m.updates[0]!.body).toEqual({
    destinations: ["portal.seiko.example", "sso.seiko.example"],
    expires_on: null,
  });
  await rowBtn(page, "SEIKO_PORTAL", "上書き").click();
  await d.getByLabel("新しいログイン ID").fill(USER_MAIL);
  await d.getByLabel("新しいパスワード").fill(FAKE_PW);
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d).toHaveCount(0);
  expect(m.updates[1]!.body).toMatchObject({ login: USER_MAIL, password: FAKE_PW });
  await expect(row(page, "SEIKO_PORTAL").locator(".k-set-pill")).toHaveText("確かめている");
});

test("K357-UI-015 上書きの取り直し：口が 403 STEP_UP_REQUIRED → 上書きの小窓を閉じ、取り直しの小窓（理由「ログイン情報を上書きする前に、本人か確かめます」）→「やめる」なら上書きの小窓に戻り値が残る → もう一度押して通すと同じ体で PATCH をもう 1 回", async ({
  page,
}) => {
  const m = await ready(page, LIST, { needStepUp: true });
  await rowBtn(page, "FREEE_API_KEY", "上書き").click();
  const d = editDialog(page, "FREEE_API_KEY");
  await d.getByLabel("新しい値").fill(FAKE_VALUE);
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(checkDialog(page)).toContainText("ログイン情報を上書きする前に、本人か確かめます");
  await checkDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(d).toBeVisible();
  await expect(d.getByLabel("新しい値")).toHaveValue(FAKE_VALUE);
  expect(m.updates).toHaveLength(1);
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(STEP_PW);
  await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(checkDialog(page)).toHaveCount(0);
  await expect(d).toHaveCount(0);
  // やめた後の押し直しは送らず取り直しの小窓から・取り直した後に 1 回だけ送る（K-820 の形に揃える PM の決め 2026-11-28）
  expect(m.updates).toHaveLength(2);
  expect(m.updates[1]!.body).toEqual(m.updates[0]!.body);
  expect(m.stepUps).toHaveLength(1);
});

test("K357-UI-016 手順 S1 の失敗：422 は欄の下に口の文（小窓は閉じない）。409（E-CRED-009 ほかが先に替えた）は小窓の赤の知らせ。404（別のタブで消された）は小窓を閉じ、口の文の知らせを出し、読み直して行が消える", async ({
  page,
}) => {
  const m = await ready(page, LIST, {
    once: { update: fieldErr({ destinations: "使える場所を 1 つ以上入れてください" }) },
  });
  await rowBtn(page, "FREEE_API_KEY", "上書き").click();
  const d = editDialog(page, "FREEE_API_KEY");
  await d.getByLabel("使える場所").fill("");
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d.locator(".k-field", { has: page.getByLabel("使える場所") })).toContainText(
    "使える場所を 1 つ以上入れてください",
  );
  const raced = "ほかの所で先に上書きされました。開き直してください";
  m.once.update = err(409, "E-CRED-009", raced);
  await d.getByLabel("使える場所").fill("api.freee.co.jp");
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d.locator('[role="alert"]')).toContainText(raced);
  const gone = "このログイン情報はもう消えています";
  m.once.update = err(404, "NOT_FOUND", gone);
  m.after = { at: m.reads + 1, items: [C1, C2, C4] };
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByText(gone)).toBeVisible();
  await expect(row(page, "FREEE_API_KEY")).toHaveCount(0);
});

test("K357-UI-017 消す：確かめ「SEIKO_PORTAL を消しますか？」と注意 →「消す」で DELETE /api/v1/credentials/c4 が 1 回（本人確認は無い・K-353）→ 閉じて読み直し、行が消える", async ({
  page,
}) => {
  const m = await ready(page, LIST);
  await rowBtn(page, "SEIKO_PORTAL", "消す").click();
  const d = removeDialog(page, "SEIKO_PORTAL");
  await expect(d).toContainText("消した値は戻せません。同じ名前でもう一度預けられます");
  await d.getByRole("button", { name: "消す", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(row(page, "SEIKO_PORTAL")).toHaveCount(0);
  await expect(page.locator(`${SEC} .k-set-row`)).toHaveCount(3);
  expect(m.removes).toEqual(["c4"]);
  expect(m.stepUps).toEqual([]);
  expect(m.reads).toBe(2);
});

test("K357-UI-018 手順 S2 の失敗：やめる → 何も送らない。503 → 確かめの小窓に赤の知らせ（口の文）・閉じない・行は残る。404（もう消えている）→ 閉じて読み直し、行は無い", async ({
  page,
}) => {
  const down = "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください";
  const m = await ready(page, LIST, { once: { remove: err(503, "E-PAGE-003", down) } });
  await rowBtn(page, "SEIKO_PORTAL", "消す").click();
  const d = removeDialog(page, "SEIKO_PORTAL");
  await d.getByRole("button", { name: "やめる" }).click();
  await expect(d).toHaveCount(0);
  expect(m.removes).toEqual([]);
  await rowBtn(page, "SEIKO_PORTAL", "消す").click();
  await d.getByRole("button", { name: "消す", exact: true }).click();
  await expect(d.locator('[role="alert"]')).toContainText(down);
  await expect(row(page, "SEIKO_PORTAL")).toHaveCount(1);
  m.once.remove = err(404, "NOT_FOUND", "このログイン情報はもう消えています");
  m.after = { at: m.reads + 1, items: [C1, C2, C3] };
  await d.getByRole("button", { name: "消す", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(row(page, "SEIKO_PORTAL")).toHaveCount(0);
});

test("K357-UI-019 二度押し：答えを止めた間に「本人確認して上書き」「消す」「PC に渡す」を 2 回押しても、それぞれの口は 1 回", async ({
  page,
}) => {
  const m = await ready(page, LIST, { hold: { update: true, remove: true, answer: true } });
  await rowBtn(page, "FREEE_API_KEY", "上書き").click();
  const e = editDialog(page, "FREEE_API_KEY");
  await e.getByLabel("新しい値").fill(FAKE_VALUE);
  await e.getByRole("button", { name: "本人確認して上書き" }).click();
  await e.getByRole("button", { name: "本人確認して上書き" }).click({ force: true });
  await expect.poll(() => m.updates.length).toBe(1);

  await page.goto(PATH);
  await rowBtn(page, "SEIKO_PORTAL", "消す").click();
  const r = removeDialog(page, "SEIKO_PORTAL");
  await r.getByRole("button", { name: "消す", exact: true }).click();
  await r.getByRole("button", { name: "消す", exact: true }).click({ force: true });
  await expect.poll(() => m.removes.length).toBe(1);

  await page.goto(PATH);
  await rowBtn(page, "HACCHU_NAVI_LOGIN", "コードを入れる").click();
  const c = codeDialog(page, "HACCHU_NAVI_LOGIN");
  await c.getByLabel("コード").fill("123456");
  await c.getByRole("button", { name: "PC に渡す" }).click();
  await c.getByRole("button", { name: "PC に渡す" }).click({ force: true });
  await expect.poll(() => m.answers.length).toBe(1);
  expect(m.updates).toHaveLength(1);
  expect(m.removes).toHaveLength(1);
});

test("K357-UI-020 幅 320〜1440（上書き・消す・コードの小窓）：横溢れ 0・小窓が画面の中で主ボタンが見える", async ({
  page,
}) => {
  await ready(page, LIST);
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const cases: [string, string, (p: Page) => ReturnType<typeof editDialog>, string][] = [
    ["SEIKO_PORTAL", "上書き", (p) => editDialog(p, "SEIKO_PORTAL"), "本人確認して上書き"],
    ["SEIKO_PORTAL", "消す", (p) => removeDialog(p, "SEIKO_PORTAL"), "消す"],
    ["HACCHU_NAVI_LOGIN", "コードを入れる", (p) => codeDialog(p, "HACCHU_NAVI_LOGIN"), "PC に渡す"],
  ];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    for (const [name, label, dlg, main] of cases) {
      await rowBtn(page, name, label).click();
      const d = dlg(page);
      await expect(d).toBeVisible();
      expect(await over(), `幅 ${w} ${label}`).toBe(0);
      const b = await page.locator(".k-dialog").last().boundingBox();
      const vw = await page.evaluate(() => window.innerWidth);
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(vw + 0.5);
      await expect(d.getByRole("button", { name: main, exact: true })).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(d).toHaveCount(0);
    }
  }
});

test("K357-UI-021 手順 S5 の失敗：確かめている間の読み直しが 503 でも、前の行と札を出したまま（赤の箱にしない）次の 3 秒でまた読み直す。読めたら札が替わる", async ({
  page,
}) => {
  const m = await ready(page, one("running"), {
    after: { at: 3, items: [{ ...C2, login_check: lc("ok", { at: NOW }) }] },
  });
  m.once.read = err(503, "E-PAGE-003");
  await tick(page, m);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("確かめている");
  await expect(page.locator(`${SEC} .k-auth-result[role="alert"]`)).toHaveCount(0);
  await tick(page, m);
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill")).toHaveText("使える");
});

// ---------------------------------------------------------------- 上書きの取り直しの後の送り直しが失敗したとき（K-353 の順：422 → 403 E-CRED-007 → 403 STEP_UP_REQUIRED → 404・409）
const AFTER_STEP_UP: { label: string; reply: Reply; see: (page: Page, m: Mock) => Promise<void> }[] = [
  {
    label: "409 E-CRED-009（ほかが先に替えた）",
    reply: err(409, "E-CRED-009", "ほかの所で先に上書きされました。開き直してください"),
    see: async (page) => {
      const d = editDialog(page, "FREEE_API_KEY");
      await expect(d).toBeVisible();
      await expect(d.locator('[role="alert"]')).toContainText("ほかの所で先に上書きされました。開き直してください");
      await expect(d.getByLabel("新しい値")).toHaveValue(FAKE_VALUE);
    },
  },
  {
    label: "422（欄ごとの文）",
    reply: fieldErr({ destinations: "使える場所を 1 つ以上入れてください" }),
    see: async (page) => {
      const d = editDialog(page, "FREEE_API_KEY");
      await expect(d).toBeVisible();
      await expect(d.locator(".k-field", { has: page.getByLabel("使える場所") })).toContainText(
        "使える場所を 1 つ以上入れてください",
      );
      await expect(d.getByLabel("新しい値")).toHaveValue(FAKE_VALUE);
    },
  },
  {
    label: "404（別のタブで消された）",
    reply: err(404, "NOT_FOUND", "このログイン情報はもう消えています"),
    see: async (page) => {
      await expect(editDialog(page, "FREEE_API_KEY")).toHaveCount(0);
      await expect(page.getByText("このログイン情報はもう消えています")).toBeVisible();
      await expect(row(page, "FREEE_API_KEY")).toHaveCount(0);
    },
  },
  {
    label: "503（調子が悪い）",
    reply: err(
      503,
      "SERVICE_UNAVAILABLE",
      "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください",
    ),
    see: async (page) => {
      const d = editDialog(page, "FREEE_API_KEY");
      await expect(d).toBeVisible();
      await expect(d.locator('[role="alert"]')).toContainText("いま Kaname の調子が悪くなっています");
      await expect(d.getByLabel("新しい値")).toHaveValue(FAKE_VALUE);
    },
  },
];

for (const c of AFTER_STEP_UP) {
  test(`K357-UI-022 上書きの取り直しが通った後の送り直しが ${c.label}：取り直しの小窓が閉じ、上書きの小窓に戻ってその文を出す（404 は閉じて知らせ・読み直して行が消える）。PATCH は 2 回（同じ体）・取り直しは 1 回`, async ({
    page,
  }) => {
    const m = await ready(page, LIST, { needStepUp: true });
    await rowBtn(page, "FREEE_API_KEY", "上書き").click();
    const d = editDialog(page, "FREEE_API_KEY");
    await d.getByLabel("新しい値").fill(FAKE_VALUE);
    await d.getByRole("button", { name: "本人確認して上書き" }).click();
    await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(STEP_PW);
    m.once.update = c.reply;
    if (c.reply.status === 404) m.after = { at: m.reads + 1, items: [C1, C2, C4] };
    await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
    await expect(checkDialog(page)).toHaveCount(0);
    await c.see(page, m);
    expect(m.updates).toHaveLength(2);
    expect(m.updates[1]!.body).toEqual(m.updates[0]!.body);
    expect(m.stepUps).toHaveLength(1);
  });
}

test("K357-UI-023 上書きの 1 回目の 403 が E-CRED-007（ワークスペースの物を変えられない・見るだけの役）：取り直しを開かず、上書きの小窓の赤の知らせに口の文。PATCH は 1 回・値は残る", async ({
  page,
}) => {
  const deny = "ワークスペースに預けたものを変えられるのは管理者だけです。自分だけのものとして預けてください";
  const m = await ready(page, LIST, { once: { update: err(403, "E-CRED-007", deny) } });
  await rowBtn(page, "FREEE_API_KEY", "上書き").click();
  const d = editDialog(page, "FREEE_API_KEY");
  await d.getByLabel("新しい値").fill(FAKE_VALUE);
  await d.getByRole("button", { name: "本人確認して上書き" }).click();
  await expect(d.locator('[role="alert"]')).toContainText(deny);
  await expect(checkDialog(page)).toHaveCount(0);
  await expect(d.getByLabel("新しい値")).toHaveValue(FAKE_VALUE);
  expect(m.updates).toHaveLength(1);
  expect(m.stepUps).toHaveLength(0);
});

test("K357-UI-024 PC がつながっていない（no_bridge）の行は読み直さない。PC をつないだ後に開き直すと、一覧の答え（K-355 が PC の初めの生きている知らせで積んだ確かめ・running）で札が「確かめている」に替わり、3 秒ごとの読み直しが始まる", async ({
  page,
}) => {
  const m = await ready(page, [{ ...C2, login_check: lc("no_bridge", { at: NOW }) }]);
  const pill = row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-pill");
  await expect(pill).toHaveText("PC がつながると確かめる");
  await page.clock.runFor(POLL_MS * 2);
  expect(m.reads).toBe(1);
  // PC をつないだ：口の側（K-355）が確かめを積んだ後の一覧
  m.items = [{ ...C2, login_check: lc("running", { at: NOW }) }];
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/credentials");
  await page.reload();
  await answered;
  await expect(pill).toHaveText("確かめている");
  await expect(row(page, "HACCHU_NAVI_LOGIN").locator(".k-set-detail")).toContainText("PC がログインして確かめている");
  await tick(page, m);
  expect(m.reads).toBeGreaterThanOrEqual(3);
});
