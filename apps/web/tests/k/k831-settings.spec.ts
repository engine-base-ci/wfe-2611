// K-831「設定の画面（/settings/company）を口 getWorkspaceSettings・updateWorkspace・uploadWorkspaceLogo・updateWorkspacePermissions につなぐ：通常・名前を直して保存・名前の誤り・ロゴ・誰ができるか・権限が無い人」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の st-view・st-name-saved・st-name-error・st-logo・st-perm・st-no-access（本番と同じ部品 features/F10/ws/settings.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。設定の 4 つの口だけを網の手前で差し替える（f10-ops-kit.ts）。押せる区画は口の答えの access（K-827・D-154.83）で決める。
//   「プランと支払い」の区画の中身は段 13 の K-962 が差すので突き合わせない（SET_PAIRS・K-962 の決め (a)）。消す小窓・手続き中の帯は K-832・プランと支払いは段 13（K-962）の物で、この葉では押せない形。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import { signupViaApi, viewerViaApi } from "../_lib/api";
import { ID, MOCK_BASE, WS_NAME, openAt, overflowX, passStepUp, stepDlg } from "./f10-kit";
import { DOT, SET_PAIRS, err, mockOps, settings } from "./f10-ops-kit";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/settings/company";
const SEC = 'section[aria-labelledby="wset-title"]';
const FILE = 'input[type="file"]';
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const nameBox = (page: Page) => page.getByLabel("名前", { exact: true });
const pick = (page: Page, i: number) => card(page, "誰ができるか").locator(".k-set-row").nth(i).getByRole("button");
const png = (bytes: number) => ({ name: "logo.png", mimeType: "image/png", buffer: Buffer.alloc(bytes, 1) });
const TWO_MB = 2 * 1024 * 1024;
/** 押せる形にした小窓の登録：settings-dialogs.tsx の SETTINGS_DIALOGS の 1 行（2 字下げの `キー: 部品,`）。K-832 が delete を足す */
const REGISTERED = new Set(
  [
    ...readFileSync(join(ROOT, "apps/web/features/F10/ws/settings-dialogs.tsx"), "utf8").matchAll(
      /^ {2}(delete)\s*:/gm,
    ),
  ].map((m) => m[1]!),
);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

type Drive = (page: Page) => Promise<void>;
const STATES: Record<
  string,
  { token?: "viewer"; settings?: ReturnType<typeof settings>; drive?: Drive; skip?: string[] }
> = {
  "st-view": {},
  "st-name-saved": {
    skip: ["meta:texts"],
    drive: async (page) => {
      // 保存の時刻は下絵と同じ 11:20（日本時間）に止める。時計の進みは止めない（カード・欄の字にも時刻が入る）
      await page.clock.setFixedTime(new Date("2026-11-02T02:20:00Z"));
      await nameBox(page).fill("ENGINE BASE 株式会社");
      await nameBox(page).press("Enter");
      await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
    },
  },
  "st-name-error": {
    drive: async (page) => {
      await nameBox(page).fill("");
      await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
    },
  },
  "st-logo": {
    skip: ["mark:texts"],
    settings: settings({ workspace: { id: ID.EG, name: WS_NAME, logo: { kind: "image", url: DOT } } }),
    drive: async (page) => {
      await page.locator(FILE).setInputFiles(png(TWO_MB + 1));
      await expect(page.getByText("ロゴは 2 MB までです。小さい画像を選んでください", { exact: true })).toBeVisible();
    },
  },
  "st-perm": {
    drive: async (page) => {
      await pick(page, 1).click();
      await expect(page.getByRole("menu")).toBeVisible();
    },
  },
  "st-no-access": { token: "viewer" },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K831-UI-001 ${id} 幅 ${w}：頭・第 2 ナビ・区画・名前の行・ロゴ・選び・権限なしの位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const viewer = st.token === "viewer" ? await viewerViaApi() : null;
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page, st.settings ? { settings: st.settings } : {});
          await openAt(page, (viewer ?? owner).token, PATH, w);
          await expect(page.locator(`${SEC}, section[aria-label="設定"]`).first()).toBeVisible();
          await st.drive?.(page);
        },
        { pairs: SET_PAIRS, base: MOCK_BASE, blur: id !== "st-name-error", ...(st.skip ? { skip: st.skip } : {}) },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K831-UI-002 /settings/company を直に開くと getWorkspaceSettings を 1 回読む。見出し「設定」・名前の欄・「N ／ 100」・第 2 ナビの「設定」が今の場所・パンくずは「ワークスペースの管理 › 設定」", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "設定", exact: true })).toBeVisible();
  await expect(nameBox(page)).toHaveValue(WS_NAME);
  await expect(card(page, "このワークスペース")).toContainText(`${Array.from(WS_NAME).length} ／ 100`);
  expect(mk.count("settings")).toBe(1);
  await expect(page.getByText("ワークスペースの管理", { exact: true }).first()).toBeVisible();
});

test("K831-UI-003 第 2 ナビの行き先：設定は /settings/company（設定が今の場所）。記録は道 /audit が作られるまで押せない形（aria-disabled・K-818 の形）・作られたら /audit へのリンク（K-825）。決まっている物の字は口の fixed_rules を並べたとおり", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  const log = page.locator(".k-me-sub-i").filter({ hasText: /^\s*記録\s*$/ });
  if (BUILT_ROUTES.includes("/audit")) await expect(log).toHaveAttribute("href", "/audit");
  else await expect(log).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("link", { name: "設定", exact: true }).first()).toHaveAttribute("href", PATH);
  const note = card(page, "誰ができるか");
  await expect(note).toContainText("ログインはパスキーを勧めます。2 段階認証はそれぞれが自分の設定で付けられ");
  await expect(note).toContainText("操作がないと 12 時間で切れます。PC が閉じている間に承認した仕事は");
  await expect(note).toContainText("変えられません）");
});

test("K831-UI-004 名前を直して欄を離れる：updateWorkspace {name} を 1 回（前後の全角空白を削る）・「✓ 保存しました ・ HH:mm」・「N ／ 100」。開き直すと新しい名前（別の読みで確かめる）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("　新しい名前 株式会社 ");
  await page.getByRole("heading", { level: 1, name: "設定", exact: true }).click();
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  expect(mk.count("rename")).toBe(1);
  expect(mk.last("rename")!.body).toEqual({ name: "新しい名前 株式会社" });
  await expect(card(page, "このワークスペース")).toContainText("10 ／ 100");
  await page.reload();
  await expect(nameBox(page)).toHaveValue("新しい名前 株式会社");
});

test("K831-UI-005 同じ名前では送らない（欄を離れただけ・打って元に戻した）。Enter 連打でも保存は 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).click();
  await page.getByRole("heading", { level: 1, name: "設定", exact: true }).click();
  await nameBox(page).fill(`${WS_NAME}x`);
  await nameBox(page).fill(WS_NAME);
  await page.getByRole("heading", { level: 1, name: "設定", exact: true }).click();
  expect(mk.count("rename")).toBe(0);
  await nameBox(page).fill("連打の名前");
  await nameBox(page).press("Enter");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  expect(mk.count("rename")).toBe(1);
});

test("K831-UI-006 名前の誤りは打つたびに出して送らない：空・空白だけ「名前を入れてください」・101 字「名前は 100 文字までです。短くしてください」。絵文字 100 字（1 字と数える）は送る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("");
  await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
  await nameBox(page).fill("　 　");
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
  await nameBox(page).fill("あ".repeat(101));
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前は 100 文字までです。短くしてください", { exact: true })).toBeVisible();
  expect(mk.count("rename")).toBe(0);
  await nameBox(page).fill("😀".repeat(100));
  await nameBox(page).press("Enter");
  await expect.poll(() => mk.count("rename")).toBe(1);
  await expect(page.getByText("名前は 100 文字までです", { exact: false })).toHaveCount(0);
});

test("K831-UI-007 保存の失敗（503）：「保存できませんでした。もう一度、入れ直してください」・入れた字は残る・直して離れると送り直せる。成功すると誤りが消える", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("rename", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("失敗する名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存できませんでした。もう一度、入れ直してください", { exact: true })).toBeVisible();
  await expect(nameBox(page)).toHaveValue("失敗する名前");
  await nameBox(page).fill("成功する名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  await expect(page.getByText("保存できませんでした", { exact: false })).toHaveCount(0);
  expect(mk.count("rename")).toBe(2);
});

test("K831-UI-008 口の最後の砦（422 E-WS-002）：画面の確かめをすり抜けた形の誤りは、欄の下に口の文を出す（保存しましたは出ない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue(
    "rename",
    err(422, "E-WS-002", { details: [{ field: "name", message: "名前は 100 文字までです。短くしてください" }] }),
  );
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("口に断られる名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前は 100 文字までです。短くしてください", { exact: true })).toBeVisible();
  await expect(page.getByText("保存しました", { exact: false })).toHaveCount(0);
});

test("K831-UI-009 ロゴを変える：ファイルを選ぶと uploadWorkspaceLogo を multipart の file 欄で 1 回・左のロゴが画像になる・開き直しても画像。ファイル欄は PNG・JPEG・WebP だけを受ける", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(page.locator(FILE)).toHaveAttribute("accept", /image\/png.*image\/jpeg.*image\/webp/);
  await page.locator(FILE).setInputFiles(png(1024));
  await expect(card(page, "このワークスペース").locator("img")).toHaveAttribute("src", DOT);
  expect(mk.count("logo")).toBe(1);
  expect(mk.last("logo")!.form).toMatchObject({ file: "logo.png", mime: "image/png" });
  await page.reload();
  await expect(card(page, "このワークスペース").locator("img")).toHaveAttribute("src", DOT);
});

test("K831-UI-010 ロゴが 2 MB を超える：口を呼ばずに「ロゴは 2 MB までです。小さい画像を選んでください」・前のロゴのまま。ちょうど 2 MB は送る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await page.locator(FILE).setInputFiles(png(TWO_MB + 1));
  await expect(page.getByText("ロゴは 2 MB までです。小さい画像を選んでください", { exact: true })).toBeVisible();
  expect(mk.count("logo")).toBe(0);
  await expect(card(page, "このワークスペース").locator("img")).toHaveCount(0);
  await page.locator(FILE).setInputFiles(png(TWO_MB));
  await expect.poll(() => mk.count("logo")).toBe(1);
  await expect(page.getByText("ロゴは 2 MB までです", { exact: false })).toHaveCount(0);
});

test("K831-UI-011 ロゴの口の断り：413 E-WS-010・422 E-WS-011（種類）・502 E-WS-012（置けない）・503 は、それぞれ口の文を赤い箱に出し、前のロゴのまま。次に選べば送り直せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue(
    "logo",
    err(413, "E-WS-010", { message: "ロゴは 2 MB までです。小さい画像を選んでください" }),
    err(422, "E-WS-011", { message: "ロゴは PNG・JPEG・WebP の画像にしてください" }),
    err(502, "E-WS-012", { message: "ロゴを置けませんでした。少し待ってやり直してください" }),
    err(503, "E-PAGE-003"),
  );
  await openAt(page, owner.token, PATH);
  for (const text of [
    "ロゴは 2 MB までです。小さい画像を選んでください",
    "ロゴは PNG・JPEG・WebP の画像にしてください",
    "ロゴを置けませんでした。少し待ってやり直してください",
    "Kaname の調子が悪くなっています",
  ]) {
    await page.locator(FILE).setInputFiles(png(100));
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    await expect(card(page, "このワークスペース").locator("img")).toHaveCount(0);
  }
  expect(mk.count("logo")).toBe(4);
});

test("K831-UI-012 「誰ができるか」：プランと支払い・ワークスペースを消すの 2 行だけ（書き出しの行が無い）・▾ で選び直すと updateWorkspacePermissions を 1 回、選んだ鍵だけ送る・値が「管理者とマネージャー」に変わる・開き直しても同じ", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(card(page, "誰ができるか").locator(".k-set-row")).toHaveCount(2);
  await pick(page, 0).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await expect.poll(() => mk.count("perms")).toBe(1);
  expect(mk.last("perms")!.body).toEqual({ billing: "admin_manager" });
  await expect(pick(page, 0)).toContainText("管理者とマネージャー");
  await page.reload();
  await expect(pick(page, 0)).toContainText("管理者とマネージャー");
  await expect(pick(page, 1)).toContainText("管理者");
  await expect(pick(page, 1)).not.toContainText("マネージャー");
});

test("K831-UI-013 今の値を選び直しても送らない（メニューが閉じるだけ）", async ({ page }) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await pick(page, 1).click();
  await page.getByRole("menuitem", { name: "管理者", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(mk.count("perms")).toBe(0);
});

test("K831-UI-014 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「プランと支払いを変える前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ updateWorkspacePermissions（押し直させない）。値が変わる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("perms", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await pick(page, 0).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await expect(stepDlg(page)).toContainText("プランと支払いを変える前に、本人か確かめます");
  await passStepUp(page);
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("perms")).toBe(2);
  expect(mk.of("perms")[1]!.body).toEqual({ billing: "admin_manager" });
  await expect(pick(page, 0)).toContainText("管理者とマネージャー");
});

test("K831-UI-015 取り直しを「やめる」：stepUp 0 回・やり直し 0 回・値は前のまま・赤い箱は出ない", async ({ page }) => {
  const mk = await mockOps(page);
  mk.queue("perms", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await pick(page, 1).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("perms")).toBe(1);
  await expect(pick(page, 1)).not.toContainText("マネージャー");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("K831-UI-016 変更の失敗（503）：Kaname の調子が悪い旨の赤い箱・値は前のまま・次に選べば送り直せる。権限の 403（STEP_UP_REQUIRED でない）は「この画面を見る権限がありません」の画面に替える", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("perms", err(503, "E-PAGE-003"), err(403, "FORBIDDEN"));
  await openAt(page, owner.token, PATH);
  await pick(page, 0).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await expect(card(page, "誰ができるか").getByText("Kaname の調子が悪くなっています", { exact: false })).toBeVisible();
  await expect(pick(page, 0)).not.toContainText("マネージャー");
  await pick(page, 0).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
});

test("K831-UI-017 プランと支払い：差し込み口 planRow を渡さない間は押せない 1 行（「プランを変える」「請求書」が aria-disabled・口を呼ばない）。入れ物のファイルに planRow の受け口が 1 つある（段 13 の K-962 が使う）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  const src = readFileSync(join(ROOT, "apps/web/features/F10/ws/settings-screen.tsx"), "utf8");
  expect(src).toMatch(/planRow\??:\s*ReactNode|planRow=\{/);
  await openAt(page, owner.token, PATH);
  // 段 13 の K-962 が planRow を渡した後は、2 つのボタンは押せる形（押した後の動きは K-962 の試験が受ける）。渡す前は押せない形で口を呼ばない
  const plugged = /planRow=\{/.test(src);
  for (const name of ["プランを変える", "請求書"]) {
    const b = card(page, "プランと支払い").getByRole("button", { name, exact: true });
    if (plugged) {
      await expect(b).not.toHaveAttribute("aria-disabled", "true");
      continue;
    }
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
  }
  expect(mk.calls.map((c) => c.op)).toEqual(["settings"]);
});

test("K831-UI-018 作らない物が無い：「取引先」の区画・取引先の見える人の既定・書き出し・ダウンロードの字が画面に無い（D-154.22・D-154.4）", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  for (const t of ["取引先", "書き出", "ダウンロード", "エクスポート"]) {
    await expect(page.locator(SEC)).not.toContainText(t);
  }
  await expect(page.locator(`${SEC} section.k-set-card`)).toHaveCount(4);
});

test("K831-UI-019 「消す手続き」：小窓の登録（SETTINGS_DIALOGS の delete）が無い間は aria-disabled で押しても何も起きない。登録がある（K-832 が足す）と押せる形", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  const b = card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true });
  if (REGISTERED.has("delete")) {
    await expect(b).not.toHaveAttribute("aria-disabled", "true");
  } else {
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(mk.calls.map((c) => c.op)).toEqual(["settings"]);
  }
});

test("K831-UI-020 権限が無い人：閲覧のみ（依頼する側）は「この画面を見る権限がありません」・口を呼ばない・左のバーに「ワークスペースの管理」が無い。口が 403（管理者でなくなった直後）でも同じ画面", async ({
  page,
}) => {
  const viewer = await viewerViaApi();
  const mk = await mockOps(page);
  await openAt(page, viewer.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "メニュー" }).getByRole("link", { name: "ワークスペースの管理" }),
  ).toHaveCount(0);
  expect(mk.count("settings")).toBe(0);
  const mk2 = await mockOps(page);
  mk2.set("settings", () => err(403, "FORBIDDEN"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
});

test("K831-UI-021 読めない（503 E-PAGE-003）：調子が悪い画面と「もう一度読む」・押すと読み直して本文が出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("settings", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("PAGE-", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(nameBox(page)).toHaveValue(WS_NAME);
  expect(mk.count("settings")).toBe(2);
});

test("K831-UI-022 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。100 字の名前・ロゴの誤り・開いた選びのメニューでも 0", async ({
  page,
}) => {
  const mk = await mockOps(page, {
    settings: settings({ workspace: { id: ID.EG, name: "長".repeat(100), logo: { kind: "text", url: null } } }),
  });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await expect(page.locator(SEC)).toBeVisible();
    await page.locator(FILE).setInputFiles(png(TWO_MB + 1));
    await pick(page, 0).click();
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
  expect(mk.count("logo")).toBe(0);
});

test("K831-UI-023 二重の口なし：StrictMode でも開いたとき getWorkspaceSettings は 1 回。保存・変更のあとに読み直さない（答えで差し替える）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(nameBox(page)).toHaveValue(WS_NAME);
  await nameBox(page).fill("読み直さない名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  await pick(page, 0).click();
  await page.getByRole("menuitem", { name: "管理者とマネージャー", exact: true }).click();
  await expect(pick(page, 0)).toContainText("管理者とマネージャー");
  expect(mk.count("settings")).toBe(1);
});

test("K831-UI-024 管理者でなく「誰ができるか」でも可でない人（兼務でグループのマネージャーなだけの人など・口が 403・D-154.15・D-154.83）：読む口 1 回のあと「この画面を見る権限がありません」・書く口は呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.set("settings", () => err(403, "FORBIDDEN"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
  expect(mk.count("settings")).toBe(1);
  expect(mk.count("rename") + mk.count("perms") + mk.count("logo")).toBe(0);
});

test("K831-UI-025 「誰ができるか」で可になった人（口の access・D-154.83）：管理者でない人には可の区画だけ押せる形・ほかは読むだけの押せない形で出す（隠さない）。名前の欄は読むだけ・ロゴの「変える」と誰ができるかの ▾ は押せない形で口を呼ばない。消す権限が無ければ「消す手続き」も押せない形", async ({
  page,
}) => {
  const mk = await mockOps(page, {
    settings: settings({ access: { admin: false, billing: true, delete_workspace: false } }),
  });
  await openAt(page, owner.token, PATH);
  await expect(nameBox(page)).toHaveValue(WS_NAME);
  await expect(nameBox(page)).toHaveAttribute("readonly", "");
  await nameBox(page).press("Enter");
  const logo = card(page, "このワークスペース").getByRole("button", { name: "変える", exact: true });
  await expect(logo).toHaveAttribute("aria-disabled", "true");
  for (const i of [0, 1]) await expect(pick(page, i)).toHaveAttribute("aria-disabled", "true");
  await pick(page, 0).click({ force: true });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(card(page, "プランと支払い")).toBeVisible();
  const del = card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true });
  await expect(del).toHaveAttribute("aria-disabled", "true");
  expect(mk.count("settings")).toBe(1);
  expect(mk.count("rename") + mk.count("perms") + mk.count("logo")).toBe(0);
});
