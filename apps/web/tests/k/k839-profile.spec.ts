// K-839「プロフィールの画面（/account）を口 getMe・updateMe・uploadAvatar につなぐ：通常・保存しました・名前の誤り・顔の写真・見え方・入っているワークスペース」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-profile・me-saved・me-name-error・me-avatar（本番と同じ部品 features/F10/account/profile.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。自分の設定の口（getMe・updateMe・uploadAvatar）だけを網の手前で差し替える（f10-ops-kit.ts）。メールを変える小窓は K-840・抜ける小窓は K-841 の物で、この葉では押せない形。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi, viewerViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX } from "./f10-kit";
import { DOT, ME_PAIRS, err, me, mockOps, type Me } from "./f10-ops-kit";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/account";
const SEC = 'section[aria-labelledby="profile-title"]';
const FILE = 'input[type="file"]';
const FIVE_MB = 5 * 1024 * 1024;
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const nameBox = (page: Page) => page.getByLabel("名前", { exact: true });
const nickBox = (page: Page) => page.getByLabel("呼ばれ方", { exact: true });
const img = (bytes: number, type = "image/png") => ({
  name: "face.png",
  mimeType: type,
  buffer: Buffer.alloc(bytes, 1),
});
const away = (page: Page) => page.getByRole("heading", { level: 1, name: "プロフィール", exact: true }).click();
/** 小窓の登録：profile-dialogs.tsx の PROFILE_DIALOGS の 1 行（2 字下げの `キー: 部品,`）。K-840 が email、K-841 が leave を足す */
const REGISTERED = new Set(
  [
    ...readFileSync(join(ROOT, "apps/web/features/F10/account/profile-dialogs.tsx"), "utf8").matchAll(
      /^ {2}(email|leave)\s*:/gm,
    ),
  ].map((m) => m[1]!),
);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

const LONG = "ヴィクトリア・アレクサンドラ・ファン・デル・ベルク・高本";
const VICTORIA: Me = me({
  member: {
    call_name: "ヴィクトリア",
    email: "victoria@engine-base.example",
    avatar: { kind: "text", initial: "ヴ", url: null },
  },
});
const PHOTO: Me = me({ member: { avatar: { kind: "image", initial: "高", url: DOT } } });
type Drive = (page: Page, mk: Awaited<ReturnType<typeof mockOps>>) => Promise<void>;
const STATES: Record<string, { me?: Me; skip?: string[]; drive?: Drive }> = {
  "me-profile": {},
  "me-saved": {
    me: VICTORIA,
    skip: ["meta:texts"],
    drive: async (page) => {
      // 保存の時刻は下絵と同じ 11:20（日本時間）に止める。時計の進みは止めない（カード・欄の字にも時刻が入る）
      await page.clock.setFixedTime(new Date("2026-11-02T02:20:00Z"));
      await nameBox(page).fill(LONG);
      await nameBox(page).press("Enter");
      await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
    },
  },
  "me-name-error": {
    drive: async (page, mk) => {
      mk.queue("updateMe", err(503, "E-PAGE-003"));
      await nameBox(page).fill("失敗する名前");
      await nameBox(page).press("Enter");
      await expect(
        page.getByText("保存できませんでした。通信を確かめて、もう一度入れ直してください", { exact: true }),
      ).toBeVisible();
      await nameBox(page).fill("");
      await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
    },
  },
  "me-avatar": {
    me: PHOTO,
    drive: async (page) => {
      await page.locator(FILE).setInputFiles(img(FIVE_MB + 1));
      await expect(page.getByText("写真は 5 MB までです。小さい写真を選んでください", { exact: true })).toBeVisible();
    },
  },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K839-UI-001 ${id} 幅 ${w}：第 2 ナビ・見出し・自分・見え方・入っているワークスペースの位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockOps(page, st.me ? { me: st.me } : {});
          await openAt(page, owner.token, PATH, w);
          await expect(page.locator(SEC)).toBeVisible();
          await st.drive?.(page, mk);
        },
        { pairs: ME_PAIRS, base: MOCK_BASE, blur: id !== "me-name-error", ...(st.skip ? { skip: st.skip } : {}) },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K839-UI-002 /account を直に開くと getMe を 1 回読む。見出し「プロフィール」・第 2 ナビの「プロフィール」が今の場所・パンくずは「自分の設定 › プロフィール」・どの役でも開ける", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "プロフィール", exact: true })).toBeVisible();
  expect(mk.count("me")).toBe(1);
  await expect(page.getByRole("link", { name: "プロフィール", exact: true }).first()).toBeVisible();
  const viewer = await viewerViaApi();
  await openAt(page, viewer.token, PATH);
  await expect(page.locator(SEC)).toBeVisible();
});

test("K839-UI-003 字：名前・呼ばれ方・メールの札・顔の 1 文字（呼ばれ方の 1 文字目）・「N ／ 100」が答えのとおり。入っているワークスペースは答えの並びと「<役割> ・ <グループ>」「自分だけ」", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(nameBox(page)).toHaveValue("高本 聖斗");
  await expect(nickBox(page)).toHaveValue("高本");
  await expect(card(page, "自分")).toContainText("takamoto@engine-base.example");
  await expect(card(page, "自分").locator(".k-f10a-avatar")).toHaveText("高");
  await expect(card(page, "自分")).toContainText("5 ／ 100");
  const rows = card(page, "入っているワークスペース").locator(".k-set-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("株式会社ENGINE BASE");
  await expect(rows.nth(0)).toContainText("管理者 ・ 営業");
  await expect(rows.nth(1)).toContainText("自分だけ");
  await expect(rows.nth(2)).toContainText("メンバー");
});

test("K839-UI-004 名前を直して欄を離れる（Enter でも）：updateMe {name} を 1 回（前後の全角空白を削る）・「✓ 保存しました ・ HH:mm」。開き直すと新しい名前（別の読みで確かめる）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("　高本 聖人 ");
  await away(page);
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  expect(mk.count("updateMe")).toBe(1);
  expect(mk.last("updateMe")!.body).toEqual({ name: "高本 聖人" });
  await page.reload();
  await expect(nameBox(page)).toHaveValue("高本 聖人");
});

test("K839-UI-005 同じ値では送らない（欄を離れただけ・元に戻した）。Enter 連打でも保存は 1 回", async ({ page }) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).click();
  await away(page);
  await nickBox(page).fill("別");
  await nickBox(page).fill("高本");
  await away(page);
  expect(mk.count("updateMe")).toBe(0);
  await nameBox(page).fill("連打の名前");
  await nameBox(page).press("Enter");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  expect(mk.count("updateMe")).toBe(1);
});

test("K839-UI-006 名前の誤りは打つたびに出して送らない：空・空白だけ「名前を入れてください」・101 字「名前は 100 文字までです。短くしてください」。100 字（絵文字も 1 字と数える）は送る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("");
  await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
  await nameBox(page).fill("　");
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前を入れてください", { exact: true })).toBeVisible();
  await nameBox(page).fill("あ".repeat(101));
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前は 100 文字までです。短くしてください", { exact: true })).toBeVisible();
  expect(mk.count("updateMe")).toBe(0);
  await nameBox(page).fill("😀".repeat(100));
  await nameBox(page).press("Enter");
  await expect.poll(() => mk.count("updateMe")).toBe(1);
});

test("K839-UI-007 呼ばれ方：欄を離れて {call_name} を保存・空にすると {call_name: null}（文字に戻る）・21 字は「呼ばれ方は 20 文字までです。短くしてください」で送らない。顔の 1 文字も変わる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nickBox(page).fill("ミサキ");
  await away(page);
  await expect.poll(() => mk.count("updateMe")).toBe(1);
  expect(mk.last("updateMe")!.body).toEqual({ call_name: "ミサキ" });
  await expect(card(page, "自分").locator(".k-f10a-avatar")).toHaveText("ミ");
  await nickBox(page).fill("");
  await away(page);
  await expect.poll(() => mk.count("updateMe")).toBe(2);
  expect(mk.last("updateMe")!.body).toEqual({ call_name: null });
  await nickBox(page).fill("あ".repeat(21));
  await away(page);
  await expect(page.getByText("呼ばれ方は 20 文字までです。短くしてください", { exact: true })).toBeVisible();
  expect(mk.count("updateMe")).toBe(2);
});

test("K839-UI-008 保存の失敗（503）：カードの上に「保存できませんでした。通信を確かめて、もう一度入れ直してください」・入れた字は残る・次に成功すると消える。口の 422（E-ME-002）は欄の下に口の文", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue(
    "updateMe",
    err(503, "E-PAGE-003"),
    err(422, "E-ME-002", { details: [{ field: "name", message: "名前は 100 文字までです。短くしてください" }] }),
  );
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("失敗する名前");
  await nameBox(page).press("Enter");
  await expect(
    page.getByText("保存できませんでした。通信を確かめて、もう一度入れ直してください", { exact: true }),
  ).toBeVisible();
  await expect(nameBox(page)).toHaveValue("失敗する名前");
  await nameBox(page).fill("口に断られる名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("名前は 100 文字までです。短くしてください", { exact: true })).toBeVisible();
  await nameBox(page).fill("成功する名前");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  await expect(page.getByText("保存できませんでした", { exact: false })).toHaveCount(0);
});

test("K839-UI-009 見え方：見た目（明るい・暗い・PC に合わせる）・週のはじめ（日曜・月曜）・時間帯（東京・世界標準の 2 つだけ）を選ぶと、選んだ欄だけ updateMe で送り、成功で今の画面の見た目も切り替わる。言語は「日本語」だけ", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(card(page, "見え方")).toContainText("日本語");
  await card(page, "見え方").getByLabel("暗い", { exact: true }).check();
  await expect.poll(() => mk.count("updateMe")).toBe(1);
  expect(mk.last("updateMe")!.body).toEqual({ theme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await card(page, "見え方").getByLabel("月曜", { exact: true }).check();
  await expect.poll(() => mk.count("updateMe")).toBe(2);
  expect(mk.last("updateMe")!.body).toEqual({ week_start: 1 });
  await card(page, "見え方").getByLabel("時間帯", { exact: true }).click();
  // 選んでいる行（東京）には部品が「✓」を描き、toHaveText は字に含めるので末尾で比べる（components/k/select.tsx の ItemIndicator）
  await expect(page.getByRole("option")).toHaveText([/東京（UTC\+9）$/, /世界標準（UTC）$/]);
  await page.getByRole("option", { name: "世界標準（UTC）", exact: true }).click();
  await expect.poll(() => mk.count("updateMe")).toBe(3);
  expect(mk.last("updateMe")!.body).toEqual({ timezone: "UTC" });
  await page.reload();
  await expect(card(page, "見え方").getByLabel("暗い", { exact: true })).toBeChecked();
  await expect(card(page, "見え方").getByLabel("月曜", { exact: true })).toBeChecked();
});

test("K839-UI-010 見え方の保存の失敗（503）：選びは前のまま・見た目も切り替わらない・カードの上に赤い箱", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("updateMe", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await card(page, "見え方").getByLabel("暗い", { exact: true }).check();
  await expect(card(page, "見え方").getByText("Kaname の調子が悪くなっています", { exact: false })).toBeVisible();
  await expect(card(page, "見え方").getByLabel("明るい", { exact: true })).toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  expect(mk.count("updateMe")).toBe(1);
});

test("K839-UI-011 顔の写真を選ぶ：uploadAvatar を multipart の file 欄で 1 回（reset なし）・顔が写真（img の src は答えの url）に・「文字に戻す」が押せる・開き直しても写真。ファイル欄は PNG・JPEG・WebP だけを受ける", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(page.getByRole("button", { name: "文字に戻す", exact: true })).toBeDisabled();
  await expect(page.locator(FILE)).toHaveAttribute("accept", /image\/png.*image\/jpeg.*image\/webp/);
  await page.locator(FILE).setInputFiles(img(1024));
  await expect(card(page, "自分").locator("img.k-f10a-photo")).toHaveAttribute("src", DOT);
  expect(mk.count("avatar")).toBe(1);
  expect(mk.last("avatar")!.form).toMatchObject({ file: "face.png", mime: "image/png", reset: null });
  await expect(page.getByRole("button", { name: "文字に戻す", exact: true })).toBeEnabled();
  await page.reload();
  await expect(card(page, "自分").locator("img.k-f10a-photo")).toHaveAttribute("src", DOT);
});

test("K839-UI-012 写真が 5 MB を超える：口を呼ばずに「写真は 5 MB までです。小さい写真を選んでください」・前の顔のまま。ちょうど 5 MB は送る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await page.locator(FILE).setInputFiles(img(FIVE_MB + 1));
  await expect(page.getByText("写真は 5 MB までです。小さい写真を選んでください", { exact: true })).toBeVisible();
  expect(mk.count("avatar")).toBe(0);
  await expect(card(page, "自分").locator("img.k-f10a-photo")).toHaveCount(0);
  await page.locator(FILE).setInputFiles(img(FIVE_MB));
  await expect.poll(() => mk.count("avatar")).toBe(1);
  await expect(page.getByText("写真は 5 MB までです", { exact: false })).toHaveCount(0);
});

test("K839-UI-013 写真の口の断り：413 E-ME-010・422 E-ME-011（種類）・502 E-ME-012（置けない）・503 は、それぞれ口の文を赤い箱に出し、前の顔のまま。次に選べば送り直せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue(
    "avatar",
    err(413, "E-ME-010", { message: "写真は 5 MB までです。小さい写真を選んでください" }),
    err(422, "E-ME-011", { message: "写真は PNG・JPEG・WebP の画像にしてください" }),
    err(502, "E-ME-012", { message: "写真を置けませんでした。少し待ってやり直してください" }),
    err(503, "E-PAGE-003"),
  );
  await openAt(page, owner.token, PATH);
  for (const text of [
    "写真は 5 MB までです。小さい写真を選んでください",
    "写真は PNG・JPEG・WebP の画像にしてください",
    "写真を置けませんでした。少し待ってやり直してください",
    "Kaname の調子が悪くなっています",
  ]) {
    await page.locator(FILE).setInputFiles(img(100));
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    await expect(card(page, "自分").locator("img.k-f10a-photo")).toHaveCount(0);
  }
  expect(mk.count("avatar")).toBe(4);
});

test("K839-UI-014 「文字に戻す」：uploadAvatar を reset=true の欄だけ（file なし）で 1 回・顔が呼ばれ方の 1 文字に戻る・ボタンが押せなくなる", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: PHOTO });
  await openAt(page, owner.token, PATH);
  await page.getByRole("button", { name: "文字に戻す", exact: true }).click();
  await expect(card(page, "自分").locator(".k-f10a-avatar")).toHaveText("高");
  expect(mk.count("avatar")).toBe(1);
  expect(mk.last("avatar")!.form).toEqual({ file: null, mime: null, reset: "true" });
  await expect(page.getByRole("button", { name: "文字に戻す", exact: true })).toBeDisabled();
});

test("K839-UI-015 メールの行：今のメールの札と「変える」。小窓の登録（PROFILE_DIALOGS の email）が無い間は「変える」が aria-disabled・押しても何も起きない。登録があれば押せる形（K-840 が足す）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  const row = card(page, "自分").locator(".k-set-row").filter({ hasText: "メール" });
  await expect(row).toContainText("takamoto@engine-base.example");
  const b = row.getByRole("button", { name: "変える", exact: true });
  if (REGISTERED.has("email")) {
    await expect(b).not.toHaveAttribute("aria-disabled", "true");
  } else {
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(mk.calls.map((c) => c.op)).toEqual(["me"]);
  }
});

test("K839-UI-016 入っているワークスペースの「抜ける」：自分だけの場所は押せない形。抜けられる場所は、小窓の登録（PROFILE_DIALOGS の leave）が無い間は aria-disabled。登録があれば押せる形（K-841 が足す）。兼務の人も主のグループの名前だけを出す（D-154.15）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  const rows = card(page, "入っているワークスペース").locator(".k-set-row");
  await expect(rows.nth(1).getByRole("button", { name: "抜ける", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  const leave = rows.nth(2).getByRole("button", { name: "抜ける", exact: true });
  if (REGISTERED.has("leave")) {
    await expect(leave).not.toHaveAttribute("aria-disabled", "true");
  } else {
    await expect(leave).toHaveAttribute("aria-disabled", "true");
    await leave.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(rows.nth(0)).toContainText("管理者 ・ 営業");
  expect(mk.calls.map((c) => c.op)).toEqual(["me"]);
});

test("K839-UI-017 読めない（503 E-PAGE-003）：調子が悪い画面と「もう一度読む」・押すと本文が出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("me", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("PAGE-", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(nameBox(page)).toHaveValue("高本 聖斗");
  expect(mk.count("me")).toBe(2);
});

test("K839-UI-018 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。100 字の名前・長いメール・写真の誤りでも 0", async ({
  page,
}) => {
  const long = me({ member: { name: "長".repeat(100), email: `${"a".repeat(60)}@${"b".repeat(60)}.example` } });
  await mockOps(page, { me: long });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await expect(page.locator(SEC)).toBeVisible();
    await page.locator(FILE).setInputFiles(img(FIVE_MB + 1));
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K839-UI-019 二重の口なし：StrictMode でも開いたとき getMe は 1 回。保存・写真・見え方のあとに読み直さない（答えで差し替える）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await expect(nameBox(page)).toHaveValue("高本 聖斗");
  await nameBox(page).fill("読み直さない");
  await nameBox(page).press("Enter");
  await expect(page.getByText("保存しました", { exact: false })).toBeVisible();
  await page.locator(FILE).setInputFiles(img(100));
  await expect(card(page, "自分").locator("img.k-f10a-photo")).toBeVisible();
  expect(mk.count("me")).toBe(1);
});

test("K839-UI-020 自分の分だけ：他の人・他の会社を指す欄が画面に無い（口へ送る体は name・call_name・language・theme・week_start・timezone だけ）。書き出し・退会の操作が無い", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("体の鍵を見る");
  await nameBox(page).press("Enter");
  await card(page, "見え方").getByLabel("月曜", { exact: true }).check();
  await expect.poll(() => mk.count("updateMe")).toBe(2);
  const allowed = new Set(["name", "call_name", "language", "theme", "week_start", "timezone"]);
  for (const c of mk.of("updateMe")) expect(Object.keys(c.body ?? {}).every((k) => allowed.has(k))).toBe(true);
  await expect(page.locator(SEC)).not.toContainText("書き出");
});

test("K839-UI-021 ログインが切れた（401）：入り直しへ送られる（書きかけは入り直したあとの道に戻る）。保存の口が 401 でも本文は壊れない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("updateMe", err(401, "E-PAGE-005"));
  await openAt(page, owner.token, PATH);
  await nameBox(page).fill("切れる名前");
  await nameBox(page).press("Enter");
  await expect(page).toHaveURL(/\/login/);
  expect(mk.count("updateMe")).toBe(1);
});
