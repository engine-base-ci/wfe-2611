// 預けたログイン情報の画面（/settings/credentials）の画面の試験の共通の道具（K-356 が持つ・K-372 が使う）。
//   K-356 の試験のファイルから、口の差し替え・本物の人・開く手順・預ける小窓の手順・見た目の突き合わせの組を外に出した（同じ物を 2 つ書かない）。
//   口の答えの形は口の葉 K-351（toCredential）・K-352（createCredential）に合わせる。本人の Bridge（127.0.0.1:38617）には届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { admin, setupStep, signupViaApi } from "../_lib/api";
import type { MatchOptions } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K356_FAKE_PW, K356_FAKE_TOTP, K356_FAKE_VALUE, K356_STEP_PW } from "../../test/_fake/secrets";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const PATH = "/settings/credentials";
export const SEC = 'section[aria-labelledby="credentials-title"]';
export const ME_SUB = '[aria-label="自分の設定の中"]';
export const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 日本の 11/18 12:00（モックの「今日」「あと 1 日」「あと 8 分」に合わせる） */
export const NOW = "2026-11-18T03:00:00Z";
export const WS_NAME = "株式会社ENGINE BASE";
export const ME_NAME = "高本 聖斗";
export const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
/** 試験の作り物の値（本物の秘密ではない・値は _fake/secrets.ts の K-356 の区切り） */
export const FAKE_PW = K356_FAKE_PW;
export const FAKE_VALUE = K356_FAKE_VALUE;
export const FAKE_TOTP = K356_FAKE_TOTP;
export const STEP_PW = K356_STEP_PW;
export const USER_MAIL = "user-k356@example.com";

// ---------------------------------------------------------------- 口の答え（K-351 の toCredential の形・正は 11_tickets/K-351.md）
/** login_check.state（K-352 の積む・K-355 の PC の知らせの値）。null は確かめていない */
export type CheckState =
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
export interface Item {
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
  /** request_id は asking のときだけ（K-357 がコードを返すのに使う・K-351／K-355 に足してもらう欄） */
  login_check: { state: CheckState | null; detail: string | null; at: string | null; request_id?: string | null };
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}
export const lc = (state: CheckState | null, o: Partial<Item["login_check"]> = {}): Item["login_check"] => ({
  state,
  detail: null,
  at: null,
  ...o,
});
export const T0 = "2026-09-01T00:00:00Z";
/** モック cred-list の 4 行と同じ名前・説明・使える場所・札・使われ方（これまでの回数と最後の時刻・代表の答え answer=e34268dbfbac） */
export const C1: Item = {
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
export const C2: Item = {
  ...C1,
  id: "c2",
  name: "HACCHU_NAVI_LOGIN",
  description: "発注ナビのログイン",
  two_factor: "sms",
  destinations: ["hacchu-navi.example"],
  use_count: 22,
  last_used_at: "2026-11-18T01:00:00Z",
  // コードを頼んだのは 11/18 11:58（日本）。待つのは 10 分（D-117）なので 12:00 には「あと 8 分」
  login_check: lc("asking", { at: "2026-11-18T02:58:00Z", request_id: "rq-c2" }),
};
export const C3: Item = {
  ...C1,
  id: "c3",
  name: "FREEE_API_KEY",
  description: "会計ソフトの API キー",
  kind: "key",
  two_factor: null,
  destinations: ["api.freee.co.jp"],
  // 期限が近いは期限の 1 日前から（代表の答え answer=e34268dbfbac）。11/18 から見て 11/19 は「あと 1 日で期限」
  expires_on: "2026-11-19",
  use_count: 3,
  last_used_at: "2026-10-29T05:00:00Z",
  login_check: lc(null),
};
export const C4: Item = {
  ...C1,
  id: "c4",
  name: "SEIKO_PORTAL",
  description: "セイコー様の請求書システム（見るだけ）",
  destinations: ["portal.seiko.example"],
  use_count: 1,
  last_used_at: "2026-11-01T03:00:00Z",
  login_check: lc("bad_password", { at: "2026-11-18T01:20:00Z", detail: "ログイン名かパスワードが違うようです" }),
};
/** モック cred-personal の 1 行 */
export const P1: Item = {
  ...C1,
  id: "p1",
  name: "MY_NOTE_LOGIN",
  description: "自分のメモアプリ",
  layer: "personal",
  use_count: 0,
  last_used_at: null,
};
export const LIST = [C1, C2, C3, C4];

export type Reply = { status: number; body: unknown };
export const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
export const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, message },
});
export const fieldErr = (fields: Record<string, string>): Reply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: Object.entries(fields).map(([field, message]) => ({ field, message })),
  },
});
export const never = () => new Promise<never>(() => undefined);

export interface Mock {
  items: Item[];
  reads: number;
  creates: Record<string, unknown>[];
  stepUps: Record<string, unknown>[];
  securityReads: number;
  /** 預けるが取り直しを求める（stepUp が通るまで 403） */
  needStepUp: boolean;
  /** 取り直しが通った後も 403（2 回目） */
  stepUpAgain: boolean;
  twoFactor: boolean;
  /** 預けるの答えを止める（二度押し） */
  holdCreate: boolean;
  /** 次の答えを差し替える（1 回だけ） */
  once: Partial<Record<"read" | "create" | "stepUp", Reply | "abort">>;
  /** 預けたログイン情報のほかの口（PATCH・DELETE・login-check など・この葉では呼ばない） */
  others: string[];
  /** 前の道すじ（/api/auth-ext/vault・/api/auth-ext/credentials）を呼んだ */
  legacy: string[];
  setupStepCalls: number;
}

export async function mockApi(page: Page, items: Item[], o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = {
    items: structuredClone(items),
    reads: 0,
    creates: [],
    stepUps: [],
    securityReads: 0,
    needStepUp: false,
    stepUpAgain: false,
    twoFactor: false,
    holdCreate: false,
    others: [],
    legacy: [],
    setupStepCalls: 0,
    ...o,
    once: { ...(o.once ?? {}) },
  };
  const take = (k: keyof Mock["once"]) => {
    const v = m.once[k];
    delete m.once[k];
    return v;
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  // 前の道すじと段の記録は数えるだけ（本物へ通す）
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith("/api/auth-ext/vault") || p.startsWith("/api/auth-ext/credentials")) m.legacy.push(p);
    if (p === "/api/auth-ext/setup-step" && r.method() === "POST") m.setupStepCalls += 1;
  });
  await page.route(
    /\/api\/v1\/(credentials|me\/security|auth\/step-up)(\/|\?|$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const method = req.method();
      const body = () => (req.postDataJSON() as Record<string, unknown> | null) ?? {};
      let r: Reply | "abort" = err(404, "NOT_FOUND");
      if (method === "GET" && p === "/api/v1/credentials") {
        m.reads += 1;
        r = take("read") ?? ok(m.items);
      } else if (method === "POST" && p === "/api/v1/credentials") {
        const b = body();
        m.creates.push(b);
        if (m.holdCreate) return never();
        const once = take("create");
        if (once) r = once;
        else if (m.needStepUp) r = err(403, "STEP_UP_REQUIRED");
        else {
          const it: Item = {
            ...C1,
            id: `new${m.creates.length}`,
            name: String(b["name"]),
            description: (b["description"] as string | undefined) ?? null,
            layer: b["layer"] === "personal" ? "personal" : "workspace",
            kind: b["kind"] === "key" ? "key" : "login",
            two_factor: b["kind"] === "key" ? null : ((b["two_factor"] as Item["two_factor"] | undefined) ?? "none"),
            destinations: (b["destinations"] as string[] | undefined) ?? [],
            expires_on: (b["expires_on"] as string | undefined) ?? null,
            use_count: 0,
            last_used_at: null,
            login_check: lc(b["kind"] === "key" ? null : "pending"),
          };
          m.items = [...m.items, it];
          r = ok(it, 201);
        }
      } else if (method === "GET" && p === "/api/v1/me/security") {
        m.securityReads += 1;
        r = ok({
          passkeys: [],
          has_password: true,
          two_factor: m.twoFactor,
          backup_codes_left: m.twoFactor ? 9 : null,
          two_factor_required: false,
          mfa_pending: false,
        });
      } else if (method === "POST" && p === "/api/v1/auth/step-up") {
        m.stepUps.push(body());
        r = take("stepUp") ?? ok({ step_up_at: NOW }, 201);
        if (r !== "abort" && r.status === 201) m.needStepUp = m.stepUpAgain;
      } else m.others.push(`${method} ${p}`);
      if (r === "abort") return route.abort("internetdisconnected");
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    },
  );
  return m;
}

/** 本物の人（会社名・名前はモックと同じ）。段は既定で通し終わり */
export async function person(step = 6) {
  const u = await signupViaApi(WS_NAME);
  await admin("update members set display_name = $2 where id = $1", [u.memberId, ME_NAME]);
  await setupStep(u.memberId, step);
  return u;
}
export async function open(page: Page, width = 1440, path = PATH) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${SEC} h1`)).toHaveText("預けたログイン情報");
}
export async function openList(page: Page, width = 1440) {
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/credentials");
  await open(page, width);
  await answered;
}
export const row = (page: Page, name: string) => page.locator(`${SEC} .k-set-row`, { hasText: name });
export const addBtn = (page: Page) => page.locator(`${SEC} .k-page-head`).getByRole("button", { name: "預ける" });
export const addDialog = (page: Page) => page.getByRole("dialog", { name: "ログイン情報を預ける" });
export const checkDialog = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます" });
export const save = (page: Page) => addDialog(page).getByRole("button", { name: "本人確認して保存" });
export async function choose(page: Page, label: string, option: string) {
  await addDialog(page).getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(addDialog(page).getByRole("combobox", { name: label })).toContainText(option);
}
/** 預ける小窓に、ログイン情報の 1 件を入れる（モック cred-add-login と同じ値） */
export async function fillLogin(page: Page, o: { name?: string; destinations?: string; expires?: string } = {}) {
  const d = addDialog(page);
  await d.getByLabel("名前", { exact: true }).fill(o.name ?? "HACCHU_NAVI_LOGIN");
  await d.getByLabel("説明（任意）").fill("発注ナビのログイン");
  await d.getByLabel("ログイン ID").fill(USER_MAIL);
  await d.getByLabel("パスワード", { exact: true }).fill(FAKE_PW);
  await choose(page, "2 段階の種類", "SMS");
  await d.getByLabel("使える場所").fill(o.destinations ?? "hacchu-navi.example, www.hacchu-navi.example");
  await d.getByLabel("期限（任意）").fill(o.expires ?? "2027/11/10");
}
export async function openAdd(page: Page) {
  await addBtn(page).click();
  await expect(addDialog(page)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock）
export const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
export const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
export const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
export const BODY_PAIRS: FidelityPair[] = [
  pair("cred-h1", `${SEC} h1`, ["x", "y", ...TXT]),
  pair("cred-desc", `${SEC} .k-desc`, ["x", "y", ...TXT]),
  pair("cred-add", `${SEC} .k-page-head button`, [...BOX, "font-size", "color", "opacity", "texts"]),
  pair("cred-note-box", `${SEC} .k-auth-note-box`, [...BOX, "font-size", "texts"]),
  pair("cred-tab", `${SEC} .k-tab`, [...BOX, "font-size", "color", "texts"]),
  pair("cred-card", `${SEC} .k-set-card`, BOX),
  pair("cred-card-head", `${SEC} .k-set-card-head`, ["x", "y", ...TXT]),
  pair("cred-row", `${SEC} .k-set-row`, [...BOX, "padding-top", "padding-left"]),
  pair("cred-name", `${SEC} .k-set-name`, ["x", "y", ...TXT]),
  // 行の中身の字も比べる：モックの見本の字を表に在る値（これまでの回数・最後の日）にそろえた（代表の答え answer=e34268dbfbac）
  pair("cred-detail", `${SEC} .k-set-detail`, ["x", "y", ...TXT]),
  pair("cred-pill", `${SEC} .k-set-pill`, [...BOX, "font-size", "color", "texts"]),
  pair("cred-btn", `${SEC} .k-set-btn`, [...BOX, "font-size", "color", "opacity", "texts"]),
  pair("cred-set-note", `${SEC} .k-set-note`, ["x", "y", "font-size", "color", "texts"]),
  pair("cred-result", `${SEC} .k-auth-result`, [...BOX, "texts"]),
  pair("me-sub", ME_SUB, ["width", "x", "y"]),
];
export const DLG = ".k-dialog";
export const DIALOG_PAIRS: FidelityPair[] = [
  pair("dlg", DLG, [...BOX, "padding-top"]),
  pair("dlg-title", `${DLG} .k-dialog-title`, ["x", "y", ...TXT]),
  pair("dlg-sub", `${DLG} .k-dialog-sub`, ["x", "y", "font-size", "color", "texts"]),
  pair("dlg-label", `${DLG} label`, ["x", "y", ...TXT]),
  pair("dlg-input", `${DLG} input:not(.k-login-code-box)`, [...BOX, "font-size"]),
  pair("dlg-select", `${DLG} .k-select-trigger`, [...BOX, "font-size", "texts"]),
  pair("dlg-hint", `${DLG} .k-hint`, ["x", "y", "font-size", "color", "texts"]),
  pair("dlg-error", `${DLG} .k-err`, ["x", "y", "font-size", "color", "texts"]),
  pair("dlg-note-box", `${DLG} .k-auth-note-box`, [...BOX, "font-size", "texts"]),
  pair("dlg-btn", `${DLG} .k-dialog-actions button`, [...BOX, "font-size", "color", "texts"]),
];
export type PairsOptions = MatchOptions & { pairs: FidelityPair[]; base: string };
