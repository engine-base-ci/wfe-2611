// K-318「ログインと安全の画面（外枠の中）を口につなぐ：一覧・パスキーを足す・名前を変える・外す・本人確認の取り直し」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f1/sec-passkey・sec-password・sec-password-2fa・sec-add・sec-add-dup・sec-rename・sec-remove・sec-remove-last・sec-stepup
//     （本番と同じ部品 features/F1/security/views.tsx）。外枠は TicketShell・第 2 ナビは MeSub（<aside aria-label="自分の設定の中">・current="login"）。
//   モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（精査の後の決め 11）。
//   パスキーの受け渡し（精査の後の決め 5・K-304・K-309）：始めの口（generate-*-options・GET か POST）の答えの JSON に challenge_token、
//     確かめ（verify-registration・stepUp）は頭 x-passkey-challenge で返す。Cookie は使わない。
//   口（getMySecurity・renamePasskey・deletePasskey・stepUp・パスキーの部品の口・外枠の口）は網の手前で差し替える。
//   パスキーは CDP の仮の認証器。WebAuthn は IP の宛先を RP にできないので、パスキーを使う行は localhost の道で開く。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { generateKeyPairSync } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const WS = "aaaaaaaa-0000-4000-8000-000000000318";
const ME = "11111111-0000-4000-8000-000000000318";
const SEC = 'section[aria-labelledby="security-title"]';
const ME_SUB = '[aria-label="自分の設定の中"]';
const DIALOG = '[role="dialog"], [role="alertdialog"]';
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const NOW = "2026-11-18T03:00:00Z"; // 日本の 11/18 12:00
const PW = "correct-horse-battery-1";
const PK_FAIL = "パスキーを付けられませんでした。もう一度試すか、2 段階認証を使ってください";
const CRED_ID = Buffer.from("k318-credential-pk1");
/** 文は正本（07_qa/test-specs/errors.json）から番号で引く。E-AUTH-015・016・018 は K-309 が足す（精査の後の決め 1） */
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

test.use({ timezoneId: "UTC" });

/** getMySecurity の passkeys の各件（K-308 の形） */
interface Pk {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  synced: boolean;
}
interface Sec {
  passkeys: Pk[];
  has_password: boolean;
  two_factor: boolean;
  backup_codes_left: number | null;
  mfa_pending?: boolean;
}
const PK1: Pk = {
  id: "pk1",
  name: "MacBook Pro（Touch ID）",
  created_at: "2026-09-12T01:00:00Z",
  last_used_at: "2026-11-18T00:30:00Z",
  synced: false,
};
const PK2: Pk = {
  id: "pk2",
  name: "iPhone（Face ID）",
  created_at: "2026-09-12T02:00:00Z",
  last_used_at: "2026-11-01T03:00:00Z",
  synced: true,
};
const PASSKEY_USER: Sec = { passkeys: [PK1, PK2], has_password: false, two_factor: false, backup_codes_left: null };
const PASSWORD_ONLY: Sec = { passkeys: [], has_password: true, two_factor: false, backup_codes_left: null };
const PASSWORD_2FA: Sec = { passkeys: [], has_password: true, two_factor: true, backup_codes_left: 9 };
const PW_2FA_2PK: Sec = { ...PASSWORD_2FA, passkeys: [PK1, PK2] };
const PW_2PK: Sec = { ...PASSWORD_ONLY, passkeys: [PK1, PK2] };

type Reply = { status: number; body: unknown };
interface Mock {
  sec: Sec;
  reads: number;
  sessionsCalls: number;
  regOptions: number;
  authOptions: number;
  regVerify: { body: Record<string, unknown>; challenge: string | undefined }[];
  renames: { id: string; body: unknown }[];
  deletes: string[];
  stepUps: { body: Record<string, unknown>; challenge: string | undefined }[];
  /** 次の答えを差し替える（1 回だけ） */
  once: Partial<Record<"read" | "delete" | "rename" | "verify" | "stepUp" | "regOptions", Reply>>;
  /** 外すが取り直しを求める（stepUp が通るまで 403） */
  needStepUp: boolean;
  holdRead: boolean;
}
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, message },
});
const fieldErr = (field: string, message: string): Reply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const never = () => new Promise<never>(() => undefined);
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

async function mockApi(page: Page, sec: Sec, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = {
    sec: structuredClone(sec),
    reads: 0,
    sessionsCalls: 0,
    regOptions: 0,
    authOptions: 0,
    regVerify: [],
    renames: [],
    deletes: [],
    stepUps: [],
    once: {},
    needStepUp: false,
    holdRead: false,
    ...o,
    // 1 回だけの差し替えは呼ぶたびに写す（同じ状態を幅ごとに回すとき、前の幅で使った once を後の幅に持ち越さない）
    once: { ...(o.once ?? {}) },
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    const body = () => (req.postDataJSON() as Record<string, unknown> | null) ?? {};
    const challenge = req.headers()["x-passkey-challenge"];
    let r: Reply = err(404, "NOT_FOUND");
    const take = (k: keyof Mock["once"]): Reply | undefined => {
      const v = m.once[k];
      delete m.once[k];
      return v;
    };
    if (p === "/api/auth-ext/me" || p === "/api/v1/me")
      r = ok({
        member_id: ME,
        tenant_id: WS,
        display_name: "高本",
        role_id: "owner",
        scope_id: null,
        workspace_name: "ENGINE BASE",
      });
    else if (p === "/api/v1/scopes") r = { status: 200, body: { data: [], meta: { limit: 200, writable: [] } } };
    else if (p === "/api/v1/approvals/queue")
      r = { status: 200, body: { data: [], meta: { limit: 20, counts: { total: 0 }, cursor: null } } };
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p.startsWith("/api/v1/me/sessions")) {
      m.sessionsCalls += 1;
      r = ok([]);
    } else if (method === "GET" && p === "/api/v1/me/security") {
      m.reads += 1;
      if (m.holdRead) return never();
      r =
        take("read") ??
        ok({
          ...m.sec,
          two_factor_required: m.sec.has_password && m.sec.passkeys.length === 0,
          mfa_pending: m.sec.mfa_pending ?? false,
        });
    } else if (p === "/api/auth/passkey/generate-register-options") {
      // 部品 1.7.15 は GET（決め 5）。どちらで来ても受ける
      m.regOptions += 1;
      r = take("regOptions") ?? {
        status: 200,
        body: {
          challenge: b64(`k318-challenge-${m.regOptions}`),
          rp: { name: "Kaname", id: new URL(page.url()).hostname },
          user: { id: b64(ME), name: "takamoto@example.com", displayName: "高本" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: 60_000,
          attestation: "none",
          excludeCredentials: [],
          authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
          challenge_token: `ctk-reg-${m.regOptions}`,
        },
      };
    } else if (p === "/api/auth/passkey/generate-authenticate-options") {
      m.authOptions += 1;
      r = {
        status: 200,
        body: {
          challenge: b64(`k318-auth-${m.authOptions}`),
          rpId: new URL(page.url()).hostname,
          allowCredentials: [{ id: b64(CRED_ID), type: "public-key" }],
          userVerification: "preferred",
          timeout: 60_000,
          challenge_token: `ctk-auth-${m.authOptions}`,
        },
      };
    } else if (p === "/api/auth/passkey/verify-registration") {
      const b = body();
      m.regVerify.push({ body: b, challenge });
      r = take("verify") ?? { status: 200, body: { id: `pk${m.sec.passkeys.length + 1}`, name: b["name"] } };
      if (r.status === 200)
        m.sec.passkeys = [
          ...m.sec.passkeys,
          {
            id: `pk${m.sec.passkeys.length + 1}`,
            name: String(b["name"] ?? ""),
            created_at: NOW,
            last_used_at: null,
            synced: false,
          },
        ];
    } else if (method === "PATCH" && p.startsWith("/api/v1/me/passkeys/")) {
      const id = p.split("/").pop()!;
      const b = req.postDataJSON() as { name: string };
      m.renames.push({ id, body: b });
      r = take("rename") ?? ok({ id, name: b.name });
      if (r.status === 200) m.sec.passkeys = m.sec.passkeys.map((k) => (k.id === id ? { ...k, name: b.name } : k));
    } else if (method === "DELETE" && p.startsWith("/api/v1/me/passkeys/")) {
      const id = p.split("/").pop()!;
      m.deletes.push(id);
      const once = take("delete");
      if (once) r = once;
      else if (m.needStepUp) r = err(403, "STEP_UP_REQUIRED");
      else {
        m.sec.passkeys = m.sec.passkeys.filter((k) => k.id !== id);
        r = ok({ id });
      }
    } else if (method === "POST" && p === "/api/v1/auth/step-up") {
      m.stepUps.push({ body: body(), challenge });
      r = take("stepUp") ?? ok({ step_up_at: NOW }, 201);
      if (r.status === 201) m.needStepUp = false;
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

/** WebAuthn は IP を RP にできないので localhost の道で開く */
const localUrl = (path: string): string => {
  const base = String(test.info().project.use.baseURL ?? "http://127.0.0.1:3123");
  return new URL(path, base.replace("127.0.0.1", "localhost")).toString();
};
async function open(page: Page, width = 1440, path = "/mfa-setup", local = false) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(local ? localUrl(path) : path);
  expect(res?.status()).toBe(200);
}
async function openList(page: Page, width = 1440, local = false) {
  await open(page, width, "/mfa-setup", local);
  await expect(page.locator(`${SEC} h1`)).toHaveText("ログインと安全");
  await expect(page.locator(`${SEC} .k-sec-summary`)).toBeVisible();
}
/** 仮の認証器。withCredential なら PK1 の鍵を入れておく（パスキーで取り直す行） */
async function authenticator(page: Page, opts: { verified?: boolean; withCredential?: boolean } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: opts.verified ?? true,
      automaticPresenceSimulation: true,
    },
  });
  if (opts.verified === false) await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
  if (opts.withCredential) {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    await cdp.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: CRED_ID.toString("base64"),
        isResidentCredential: true,
        rpId: "localhost",
        privateKey: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
        userHandle: Buffer.from(ME).toString("base64"),
        signCount: 0,
      },
    });
  }
}
const row = (page: Page, name: string) => page.locator(`${SEC} .k-set-row`, { hasText: name });
const pill = (page: Page, rowName: string) => row(page, rowName).first().locator(".k-set-pill");
const dialog = (page: Page) => page.locator(DIALOG).last();
const btn = (page: Page, sel: string, name: string) => page.locator(sel).getByRole("button", { name, exact: true });
const checkDialog = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます" });
const addBtn = (page: Page) => row(page, "指や顔で入る").getByRole("button", { name: "足す", exact: true });
async function startRemove(page: Page, name = "iPhone（Face ID）") {
  await row(page, name).getByRole("button", { name: "外す", exact: true }).click();
  await btn(page, DIALOG, "外す").click();
}
/** 自分で書いたファイルを並べる（静かな確かめ用） */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

// ---------------------------------------------------------------- 行

test("K318-UI-001 パスキーの人で開く：外枠・パンくず・第 2 ナビ（aside）の今の項目・h1・まとめ・札・パスキーの 2 行・口は 1 回", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page);
  await expect(page.locator(".k-shell").first()).toBeVisible();
  await expect(page.locator(ME_SUB).getByRole("link", { name: "ログインと安全" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("自分の設定").first()).toBeVisible();
  await expect(page.locator(`${SEC} .k-sec-summary`)).toContainText("安全な状態です");
  await expect(page.locator(`${SEC} .k-sec-summary`)).toContainText("パスキーで入っている");
  await expect(pill(page, "指や顔で入る")).toHaveText("2 つ");
  await expect(pill(page, "使うなら 12 文字以上")).toHaveText("使っていない");
  await expect(row(page, "MacBook Pro（Touch ID）")).toContainText("9/12 に作った ・ 最後に使った 今日 09:30");
  await expect(row(page, "iPhone（Face ID）")).toHaveCount(1);
  expect(m.reads).toBe(1);
});

test("K318-UI-002 パスワードだけの人：まとめは足りない（warn）・2 段階の札「必須・付けていない」・パスキーのカードが無い", async ({
  page,
}) => {
  await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await expect(page.locator(`${SEC} .k-sec-summary`)).toContainText("入り方を 1 つ足してください");
  await expect(page.locator(`${SEC} .k-sec-summary`)).toHaveAttribute("data-tone", "warn");
  await expect(pill(page, "認証アプリ")).toHaveText("必須・付けていない");
  await expect(page.locator(`${SEC} #sec-passkeys`)).toHaveCount(0);
});

test("K318-UI-003 パスワードと 2 段階：札「付けている」・残り 9 個・「外す」「コードを作り直す」は押せず口を呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_2FA);
  await openList(page);
  await expect(pill(page, "認証アプリ")).toHaveText("付けている");
  await expect(row(page, "認証アプリ")).toContainText("バックアップコード 残り 9 個");
  for (const name of ["外す", "コードを作り直す"]) {
    const b = row(page, "認証アプリ").getByRole("button", { name, exact: true });
    await expect(b).toBeDisabled();
    await b.click({ force: true });
  }
  await expect(page.locator(DIALOG)).toHaveCount(0);
  expect(m.reads).toBe(1);
});

test("K318-UI-004 流れ F10 とまだの物はグレー：端末と記録の行は data-off で準備中・端末の口は 0 回・切るボタンは押せない・パスキーだけの人でも「要りません」の字が無い", async ({
  page,
}) => {
  for (const sec of [PASSWORD_ONLY, PASSKEY_USER]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockApi(page, sec);
    await openList(page);
    for (const name of ["入っている端末の一覧", "安全の記録"]) {
      await expect(row(page, name)).toHaveAttribute("data-off", "");
      await expect(row(page, name)).toContainText("準備中");
    }
    await expect(page.locator(SEC).getByRole("button", { name: "この端末以外をすべて切る" })).toBeDisabled();
    await expect(page.locator(SEC).getByText("要りません")).toHaveCount(0);
    expect(m.sessionsCalls).toBe(0);
  }
});

test("K318-UI-005 時刻の書き方：最後に使った時刻が無い（段 2 は空）なら「—」・きのう使ったら「最後に使った 11/17」（日本の日付）・iPhone の名は電話の絵", async ({
  page,
}) => {
  await mockApi(page, {
    ...PASSWORD_2FA,
    passkeys: [
      { id: "a", name: "Mac（Chrome）", created_at: "2026-11-17T05:00:00Z", last_used_at: null, synced: false },
      {
        id: "b",
        name: "iPhone（Safari）",
        created_at: "2026-10-03T05:00:00Z",
        last_used_at: "2026-11-17T14:00:00Z",
        synced: true,
      },
    ],
  });
  await openList(page);
  await expect(row(page, "Mac（Chrome）").locator(".k-set-detail")).toHaveText("11/17 に作った ・ 最後に使った —");
  await expect(row(page, "iPhone（Safari）").locator(".k-set-detail")).toHaveText(
    "10/3 に作った ・ 最後に使った 11/17",
  );
  await expect(row(page, "iPhone（Safari）").locator("svg.lucide-smartphone")).toHaveCount(1);
  await expect(row(page, "Mac（Chrome）").locator("svg.lucide-laptop")).toHaveCount(1);
});

test("K318-UI-006 画面が部品の 2 段階の口を直に呼ばない：/mfa-setup の頁と features/F1/security に authClient.twoFactor が 0 件", async () => {
  const files = [
    ...filesUnder(join(WEB, "app/(outside)/mfa-setup")),
    ...filesUnder(join(WEB, "features/F1/security")),
  ].filter((f) => /\.(ts|tsx)$/.test(f));
  expect(files.length, "見るファイルがある").toBeGreaterThan(1);
  const hits = files.filter((f) => readFileSync(f, "utf8").includes("authClient.twoFactor"));
  expect(hits).toEqual([]);
});

test("K318-UI-007 小窓の「足す」：始めの口の challenge_token を頭 x-passkey-challenge で返す・名前は欄の値・閉じて読み直すと 3 つ", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page, 1440, true);
  await authenticator(page);
  await addBtn(page).click();
  await dialog(page).getByLabel("名前", { exact: true }).fill("仕事の Mac");
  await btn(page, DIALOG, "足す").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(pill(page, "指や顔で入る")).toHaveText("3 つ");
  await expect(row(page, "仕事の Mac")).toHaveCount(1);
  expect(m.regOptions).toBe(1);
  expect(m.regVerify).toHaveLength(1);
  expect(m.regVerify[0]!.challenge).toBe("ctk-reg-1");
  expect(m.regVerify[0]!.body["name"]).toBe("仕事の Mac");
  expect(m.reads).toBe(2);
});

test("K318-UI-008 この端末にもう付いている（口が 409・E-AUTH-018）：欄の下に E-AUTH-018 の文・小窓は閉じない・一覧は変わらない", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER, { once: { verify: err(409, "E-AUTH-018", msg("E-AUTH-018")) } });
  await openList(page, 1440, true);
  await authenticator(page);
  await addBtn(page).click();
  await btn(page, DIALOG, "足す").click();
  await expect(dialog(page)).toContainText(msg("E-AUTH-018"));
  await expect(page.locator(DIALOG)).toHaveCount(1);
  await expect(pill(page, "指や顔で入る")).toHaveText("2 つ");
  expect(m.reads).toBe(1);
});

test("K318-UI-009 端末でやめた（NotAllowedError）：欄の下に付けられなかった文・確かめの口は 0 回・小窓は閉じない", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page, 1440, true);
  await authenticator(page, { verified: false });
  await addBtn(page).click();
  await btn(page, DIALOG, "足す").click();
  await expect(dialog(page)).toContainText(PK_FAIL);
  await expect(page.locator(DIALOG)).toHaveCount(1);
  expect(m.regVerify).toHaveLength(0);
});

test("K318-UI-010 パスキーに対応していないブラウザ：行の字が対応していない文・「足す」は押せない", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error 試験のために WebAuthn を消す
    delete window.PublicKeyCredential;
  });
  await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await expect(row(page, "パスキー").first()).toContainText(
    "このブラウザはパスキーに対応していません。別のブラウザか、2 段階認証を使ってください",
  );
  await expect(row(page, "パスキー").first().getByRole("button", { name: "足す", exact: true })).toBeDisabled();
});

test("K318-UI-011 小窓の「足す」を 2 回続けて押す：始めの口は 1 回・パスキーは 1 本だけ増える", async ({ page }) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page, 1440, true);
  await authenticator(page);
  await addBtn(page).click();
  await btn(page, DIALOG, "足す").dblclick();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(pill(page, "指や顔で入る")).toHaveText("3 つ");
  expect(m.regOptions).toBe(1);
  expect(m.regVerify).toHaveLength(1);
});

test("K318-UI-012 名前を変える：小窓に今の名前・口が 1 回・閉じて読み直した一覧に新しい名前", async ({ page }) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page);
  await row(page, "MacBook Pro（Touch ID）").getByRole("button", { name: "名前を変える" }).click();
  const name = dialog(page).getByLabel("名前", { exact: true });
  await expect(name).toHaveValue("MacBook Pro（Touch ID）");
  await name.fill("仕事の Mac");
  await btn(page, DIALOG, "変える").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(row(page, "仕事の Mac")).toHaveCount(1);
  expect(m.renames).toEqual([{ id: "pk1", body: { name: "仕事の Mac" } }]);
  expect(m.reads).toBe(2);
});

test("K318-UI-013 名前の欄（足す・変える）：足すの既定は「<OS>（<ブラウザ>）」・40 文字まで・空なら押せず口は 0 回・前後の全角空白は除いて送る", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER);
  await openList(page, 1440, true);
  await authenticator(page);
  // 足す
  await addBtn(page).click();
  const addName = dialog(page).getByLabel("名前", { exact: true });
  await expect(addName).toHaveValue(
    /^(Mac|Windows|Linux|iPhone|iPad|Android|ChromeOS)（(Chrome|Edge|Safari|Firefox)）$/,
  );
  await expect(addName).toHaveAttribute("maxlength", "40");
  await addName.fill("");
  await expect(btn(page, DIALOG, "足す")).toBeDisabled();
  await addName.pressSequentially("あ".repeat(41));
  await expect(addName).toHaveValue("あ".repeat(40));
  await addName.fill("　仕事の Mac　");
  await btn(page, DIALOG, "足す").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  expect(m.regOptions).toBe(1);
  expect(m.regVerify[0]!.body["name"]).toBe("仕事の Mac");
  // 変える
  await row(page, "MacBook Pro（Touch ID）").getByRole("button", { name: "名前を変える" }).click();
  const name = dialog(page).getByLabel("名前", { exact: true });
  await expect(name).toHaveAttribute("maxlength", "40");
  await name.fill("");
  await expect(btn(page, DIALOG, "変える")).toBeDisabled();
  await name.pressSequentially("い".repeat(41));
  await expect(name).toHaveValue("い".repeat(40));
  await name.fill("　家の Mac　");
  await btn(page, DIALOG, "変える").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  expect(m.renames).toEqual([{ id: "pk1", body: { name: "家の Mac" } }]);
});

test("K318-UI-014 2 本の 1 本を外す：確かめの小窓の題と字・口が 1 回・読み直した一覧が 1 本", async ({ page }) => {
  const m = await mockApi(page, PW_2FA_2PK);
  await openList(page);
  await row(page, "iPhone（Face ID）").getByRole("button", { name: "外す", exact: true }).click();
  await expect(dialog(page).locator(".k-dialog-title")).toHaveText("このパスキーを外しますか？");
  await expect(dialog(page)).toContainText("「iPhone（Face ID）」では入れなくなります。入っている端末は切れません");
  await btn(page, DIALOG, "外す").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(row(page, "iPhone（Face ID）")).toHaveCount(0);
  expect(m.deletes).toEqual(["pk2"]);
  expect(m.reads).toBe(2);
});

test("K318-UI-015 最後の入り方：パスワードあり・2 段階なしは E-AUTH-016、パスワードなしは E-AUTH-015・「外す」は押せず口は 0 回", async ({
  page,
}) => {
  const cases: [Sec, string][] = [
    [{ ...PASSWORD_ONLY, passkeys: [PK1] }, "E-AUTH-016"],
    [{ ...PASSKEY_USER, passkeys: [PK1] }, "E-AUTH-015"],
  ];
  for (const [sec, id] of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockApi(page, sec);
    await openList(page);
    await row(page, "MacBook Pro（Touch ID）").getByRole("button", { name: "外す", exact: true }).click();
    await expect(dialog(page).locator(".k-dialog-caution")).toHaveText(msg(id));
    await expect(btn(page, DIALOG, "外す")).toBeDisabled();
    expect(m.deletes).toHaveLength(0);
  }
});

test("K318-UI-016 外せる形で押したが口が 409（E-AUTH-015）：小窓に口の文・押せなくなる・読み直してパスキーは残る", async ({
  page,
}) => {
  const m = await mockApi(page, PW_2FA_2PK, { once: { delete: err(409, "E-AUTH-015", msg("E-AUTH-015")) } });
  await openList(page);
  await startRemove(page);
  await expect(dialog(page).locator(".k-dialog-caution")).toHaveText(msg("E-AUTH-015"));
  await expect(btn(page, DIALOG, "外す")).toBeDisabled();
  await expect.poll(() => m.reads).toBe(2);
  await expect(row(page, "iPhone（Face ID）")).toHaveCount(1);
});

test("K318-UI-017 外すの取り直し：2 段階の人はパスワードと 6 けた（{ password, code }）・パスワードだけの人は 6 けたの枠が無く { password }・どちらも外すがもう 1 回だけ送られ 1 本減る", async ({
  page,
}) => {
  const cases: [Sec, boolean][] = [
    [PW_2FA_2PK, true],
    [PW_2PK, false],
  ];
  for (const [sec, withCode] of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockApi(page, sec, { needStepUp: true });
    await openList(page);
    await startRemove(page);
    const d = checkDialog(page);
    await expect(d).toContainText("パスキーを外す前に、本人か確かめます");
    await d.getByLabel("パスワード", { exact: true }).fill(PW);
    if (withCode) await d.getByLabel("確認のコード 1 けた目").fill("123456");
    else await expect(d.locator(".k-login-code-box")).toHaveCount(0);
    await d.getByRole("button", { name: "確かめる" }).click();
    await expect(d).toHaveCount(0);
    await expect(row(page, "iPhone（Face ID）")).toHaveCount(0);
    expect(m.stepUps.map((s) => s.body)).toEqual([withCode ? { password: PW, code: "123456" } : { password: PW }]);
    expect(m.deletes).toEqual(["pk2", "pk2"]);
  }
});

test("K318-UI-018 足すの始めが 403（取り直し）：小窓の字「パスキーを足す前に、本人か確かめます」・取り直しの後に始めの口がもう 1 回だけ・確かめは 1 回", async ({
  page,
}) => {
  const m = await mockApi(page, PW_2PK, { once: { regOptions: err(403, "STEP_UP_REQUIRED") } });
  await openList(page, 1440, true);
  await authenticator(page);
  await addBtn(page).click();
  await btn(page, DIALOG, "足す").click();
  const d = checkDialog(page);
  await expect(d).toContainText("パスキーを足す前に、本人か確かめます");
  await d.getByLabel("パスワード", { exact: true }).fill(PW);
  await d.getByRole("button", { name: "確かめる" }).click();
  await expect(pill(page, "指や顔で入る")).toHaveText("3 つ");
  expect(m.stepUps.map((s) => s.body)).toEqual([{ password: PW }]);
  expect(m.regOptions).toBe(2);
  expect(m.regVerify).toHaveLength(1);
  expect(m.regVerify[0]!.challenge).toBe("ctk-reg-2");
});

test("K318-UI-019 取り直しで違うパスワード・違う 6 けた（口が 401・STEP_UP_FAILED）：欄の下に口の文・小窓は閉じず、ログインへ移らない・2 回目の外すは 0 回", async ({
  page,
}) => {
  const wrong = "パスワードかコードが違います";
  const m = await mockApi(page, PW_2FA_2PK, {
    needStepUp: true,
    once: { stepUp: err(401, "STEP_UP_FAILED", wrong) },
  });
  await openList(page);
  await startRemove(page);
  const d = checkDialog(page);
  await d.getByLabel("パスワード", { exact: true }).fill("wrong-password-000");
  await d.getByLabel("確認のコード 1 けた目").fill("000000");
  await d.getByRole("button", { name: "確かめる" }).click();
  await expect(d).toContainText(wrong);
  await expect(d).toHaveCount(1);
  await expect(page).toHaveURL(/\/mfa-setup$/);
  expect(m.deletes).toEqual(["pk2"]);
});

test("K318-UI-020 名前を変える口が 422（欄 name）：欄の下に口の文・小窓は閉じない・書いた値は残る", async ({
  page,
}) => {
  const bad = "名前に使えない字が入っています";
  await mockApi(page, PASSKEY_USER, { once: { rename: fieldErr("name", bad) } });
  await openList(page);
  await row(page, "MacBook Pro（Touch ID）").getByRole("button", { name: "名前を変える" }).click();
  const name = dialog(page).getByLabel("名前", { exact: true });
  await name.fill("仕事の\u0007Mac");
  await btn(page, DIALOG, "変える").click();
  await expect(dialog(page)).toContainText(bad);
  await expect(page.locator(DIALOG)).toHaveCount(1);
  await expect(name).toHaveValue("仕事の\u0007Mac");
});

test("K318-UI-021 取り直しの「やめる」：小窓が閉じ、stepUp も 2 回目の外すも 0 回・一覧は 2 本のまま", async ({
  page,
}) => {
  const m = await mockApi(page, PW_2PK, { needStepUp: true });
  await openList(page);
  await startRemove(page);
  const d = checkDialog(page);
  await d.getByRole("button", { name: "やめる" }).click();
  await expect(d).toHaveCount(0);
  await expect(row(page, "iPhone（Face ID）")).toHaveCount(1);
  expect(m.stepUps).toHaveLength(0);
  expect(m.deletes).toEqual(["pk2"]);
});

test("K318-UI-022 パスキーだけの人の取り直し：パスワードの欄が無く「パスキーで確かめる」→ 始めの口の challenge_token を頭で返し stepUp は { passkey } で 1 回・続けて外れる", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER, { needStepUp: true });
  await openList(page, 1440, true);
  await authenticator(page, { withCredential: true });
  await startRemove(page);
  const d = checkDialog(page);
  await expect(d.getByLabel("パスワード", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "パスキーで確かめる" }).click();
  await expect(row(page, "iPhone（Face ID）")).toHaveCount(0);
  expect(m.authOptions).toBe(1);
  expect(m.stepUps).toHaveLength(1);
  expect(Object.keys(m.stepUps[0]!.body)).toEqual(["passkey"]);
  expect(m.stepUps[0]!.challenge).toBe("ctk-auth-1");
  expect(m.deletes).toEqual(["pk2", "pk2"]);
});

test("K318-UI-023 ログインしていない：/mfa-setup と /mfa-setup?add=passkey はログインへ（問いを付けたまま）・口は 0 回", async ({
  page,
}) => {
  let reads = 0;
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route, req) => {
    if (new URL(req.url()).pathname === "/api/v1/me/security") reads += 1;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNAUTHENTICATED" }),
    });
  });
  await page.goto("/mfa-setup");
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup$/);
  await page.goto("/mfa-setup?add=passkey");
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup%3Fadd%3Dpasskey$/);
  expect(reads).toBe(0);
});

test("K318-UI-024 名前を書きかけて「変える」で 401：E-PAGE-005 の文・欄の書きかけは消えない", async ({ page }) => {
  await mockApi(page, PASSKEY_USER, { once: { rename: err(401, "UNAUTHENTICATED") } });
  await openList(page);
  await row(page, "MacBook Pro（Touch ID）").getByRole("button", { name: "名前を変える" }).click();
  const name = dialog(page).getByLabel("名前", { exact: true });
  await name.fill("書きかけの名前");
  await btn(page, DIALOG, "変える").click();
  await expect(page.getByText(msg("E-PAGE-005")).first()).toBeVisible();
  await expect(name).toHaveValue("書きかけの名前");
});

test("K318-UI-025 ?add=passkey&next=/tickets は開いた直後に足す小窓・足すと /tickets へ。next が外の道なら留まる", async ({
  page,
}) => {
  await mockApi(page, PASSKEY_USER);
  await page.goto(localUrl("/login"));
  await authenticator(page);
  await open(page, 1440, `/mfa-setup?add=passkey&next=${encodeURIComponent("/tickets")}`, true);
  await expect(dialog(page).locator(".k-dialog-title")).toHaveText("パスキーを足す");
  await btn(page, DIALOG, "足す").click();
  await expect(page).toHaveURL(/\/tickets$/);
  await open(page, 1440, `/mfa-setup?add=passkey&next=${encodeURIComponent("https://evil.example/x")}`, true);
  await btn(page, DIALOG, "足す").click();
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(page).toHaveURL(/\/mfa-setup/);
  await expect(page.locator(`${SEC} h1`)).toHaveText("ログインと安全");
});

test("K318-UI-026 getMySecurity が 500：外枠と第 2 ナビ（aside）は出たまま・本文に E-PAGE-003 と「もう一度」・押すと読み直して一覧", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_USER, { once: { read: err(500, "E-PAGE-003") } });
  await open(page);
  await expect(page.locator(ME_SUB)).toBeVisible();
  await expect(page.locator(SEC)).toContainText(msg("E-PAGE-003"));
  await page.locator(SEC).getByRole("button", { name: "もう一度" }).click();
  await expect(page.locator(`${SEC} .k-sec-summary`)).toContainText("安全な状態です");
  expect(m.reads).toBe(2);
});

test("K318-UI-027 読み込みの 3 秒：2.9 秒では本文に文もまとめも無く、3 秒を過ぎて「読み込んでいます…」", async ({
  page,
}) => {
  await mockApi(page, PASSKEY_USER, { holdRead: true });
  await page.clock.install({ time: new Date(NOW) });
  await page.clock.pauseAt(new Date("2026-11-18T03:00:01Z"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const req = page.waitForRequest((r) => r.url().includes("/api/v1/me/security"));
  await page.goto("/mfa-setup");
  await req;
  await page.clock.runFor(2_900);
  await expect(page.locator(SEC).getByText("読み込んでいます…")).toHaveCount(0);
  await expect(page.locator(`${SEC} .k-sec-summary`)).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.locator(`${SEC} [role="status"]`)).toContainText("読み込んでいます…");
});

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock・決め 11）
//   matchMock の役は入口の箱（AUTH_PAIRS）なので、外枠の中の本文と小窓の役を opts.pairs で渡す（K-316 に頼む・申し送り）。
//   渡した役で比べたことを、返った行の役の名で確かめる（道具が pairs を読まないと、ここで赤になる）
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const SEC_PAIRS: FidelityPair[] = [
  pair("sec-h1", `${SEC} h1`, ["x", "y", ...TXT]),
  pair("sec-desc", `${SEC} .k-desc`, ["x", "y", ...TXT]),
  pair("sec-summary", `${SEC} .k-sec-summary`, [...BOX, "texts"]),
  pair("sec-card", `${SEC} .k-set-card`, BOX),
  pair("sec-card-head", `${SEC} .k-set-card-head`, ["x", "y", ...TXT]),
  pair("sec-row", `${SEC} .k-set-row`, [...BOX, "padding-top", "padding-left"]),
  pair("sec-name", `${SEC} .k-set-name`, ["x", "y", ...TXT]),
  pair("sec-detail", `${SEC} .k-set-detail`, ["x", "y", "font-size", "color"]),
  pair("sec-pill", `${SEC} .k-set-pill`, [...BOX, "font-size", "color", "texts"]),
  pair("sec-btn", `${SEC} .k-set-btn`, [...BOX, "font-size", "color", "opacity", "texts"]),
  pair("me-sub", ME_SUB, ["width", "x", "y"]),
];
const DLG = ".k-dialog";
const DIALOG_PAIRS: FidelityPair[] = [
  pair("dlg", DLG, [...BOX, "padding-top"]),
  pair("dlg-title", `${DLG} .k-dialog-title`, ["x", "y", ...TXT]),
  pair("dlg-sub", `${DLG} .k-dialog-sub`, ["x", "y", "font-size", "color"]),
  pair("dlg-desc", `${DLG} .k-dialog-desc`, ["x", "y", "font-size", "color"]),
  pair("dlg-caution", `${DLG} .k-dialog-caution`, [...BOX, "color", "texts"]),
  pair("dlg-label", `${DLG} label`, ["x", "y", ...TXT]),
  pair("dlg-input", `${DLG} input:not(.k-login-code-box)`, [...BOX, "font-size"]),
  pair("dlg-code-box", `${DLG} .k-login-code-box`, ["width", "height", "x", "y", "font-size"]),
  pair("dlg-note-box", `${DLG} .k-auth-note-box`, [...BOX, "font-size", "texts"]),
  pair("dlg-btn", `${DLG} .k-dialog-actions button`, [...BOX, "font-size", "color", "texts"]),
];
type PairsOptions = MatchOptions & { pairs: FidelityPair[] };

/** 本番の画面をモックの状態にする（PASSKEY_USER の名前・2 本はモックと同じ） */
const BODY_PROD: Record<string, Sec> = {
  "sec-passkey": PASSKEY_USER,
  "sec-password": PASSWORD_ONLY,
  "sec-password-2fa": PASSWORD_2FA,
};
for (const [id, sec] of Object.entries(BODY_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K318-UI-028 ${id} 幅 ${w}：外枠の中の本文（見出し・まとめ・カード・行・札・ボタン・第 2 ナビ）の値がモックと同じ（共通の道具 matchMock・行の字は日付の見本なので字を比べない）`, async ({
      browser,
    }) => {
      const opts: PairsOptions = { pairs: SEC_PAIRS };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockApi(page, sec);
          await openList(page, w);
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("sec-h1");
      expect(bad).toEqual([]);
    });
  }
}

const DIALOG_PROD: Record<string, { sec: Sec; o?: Partial<Mock>; local?: boolean; act: (p: Page) => Promise<void> }> = {
  "sec-add": { sec: PASSKEY_USER, act: (p) => addBtn(p).click() },
  "sec-add-dup": {
    sec: PASSKEY_USER,
    o: { once: { verify: err(409, "E-AUTH-018", msg("E-AUTH-018")) } },
    local: true,
    act: async (p) => {
      await authenticator(p);
      await addBtn(p).click();
      await btn(p, DIALOG, "足す").click();
      await expect(dialog(p)).toContainText(msg("E-AUTH-018"));
    },
  },
  "sec-rename": {
    sec: PASSKEY_USER,
    act: (p) => row(p, "MacBook Pro（Touch ID）").getByRole("button", { name: "名前を変える" }).click(),
  },
  "sec-remove": {
    sec: PASSKEY_USER,
    act: (p) => row(p, "iPhone（Face ID）").getByRole("button", { name: "外す", exact: true }).click(),
  },
  "sec-remove-last": {
    sec: { ...PASSWORD_ONLY, passkeys: [PK1] },
    act: (p) => row(p, "MacBook Pro（Touch ID）").getByRole("button", { name: "外す", exact: true }).click(),
  },
  "sec-stepup": {
    sec: PW_2FA_2PK,
    o: { needStepUp: true },
    act: async (p) => {
      await startRemove(p);
      await expect(checkDialog(p)).toBeVisible();
    },
  },
};
for (const [id, c] of Object.entries(DIALOG_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K318-UI-029 ${id} 幅 ${w}：小窓（箱・題・補足・注意・項目名・欄・6 けたの枠・注の箱・ボタン）の値がモックと同じ（共通の道具 matchMock・名前の欄の値と補足の理由の字は見本なので比べない）`, async ({
      browser,
    }) => {
      const opts: PairsOptions = { pairs: DIALOG_PAIRS, blur: true, skip: ["dlg-sub:texts"] };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockApi(page, c.sec, c.o);
          await openList(page, w, c.local);
          await c.act(page);
          await expect(page.locator(DLG).last()).toBeVisible();
          // 小窓は画面に貼り付く（fixed）が、比べる y はページの座標。行を押して下へ動いた分を戻し、モック（動かずに開く）とそろえる
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dlg-title");
      expect(bad).toEqual([]);
    });
  }
}

test("K318-UI-030 幅 320〜1440（一覧と、足す・取り直しの小窓）：横溢れ 0・h1 の 1 文字目が画面の中・小窓が画面の中", async ({
  page,
}) => {
  await mockApi(page, PW_2FA_2PK, { needStepUp: true });
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const inView = async () => {
    const b = await page.locator(".k-dialog").last().boundingBox();
    const w = await page.evaluate(() => window.innerWidth);
    expect(b).not.toBeNull();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(w + 0.5);
  };
  for (const w of WIDTHS) {
    await openList(page, w);
    expect(await over(), `幅 ${w} の一覧の横溢れ`).toBe(0);
    const x = await page.locator(`${SEC} h1`).evaluate((e) => {
      const r = document.createRange();
      r.setStart(e.firstChild ?? e, 0);
      r.setEnd(e.firstChild ?? e, 1);
      return r.getBoundingClientRect().left;
    });
    expect(x, `幅 ${w} の h1 の 1 文字目`).toBeGreaterThanOrEqual(0);
    await addBtn(page).click();
    await inView();
    expect(await over(), `幅 ${w} の足す小窓の横溢れ`).toBe(0);
    await btn(page, DIALOG, "やめる").click();
    await startRemove(page);
    await expect(checkDialog(page)).toBeVisible();
    await inView();
    expect(await over(), `幅 ${w} の取り直しの小窓の横溢れ`).toBe(0);
  }
});
