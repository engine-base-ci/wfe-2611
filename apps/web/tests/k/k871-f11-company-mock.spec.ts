// K-871「段 12 の会社の側の部品（ゲストに見せる・届いた依頼の一覧と開いた依頼）と下絵の置き場 /dev/mock/f11 を本線に入れる」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f11（索引）と /dev/mock/f11/<状態>。この葉が描ける状態＝メンバーの画面の mb-*（18・参加の mb-join は K-877）とチケットの詳細の tk-*（9）。
//   届いた依頼の状態（rq-*）は K-872、ゲストの場所（pt-*）は K-873 が本物の描き手を入れる（この葉は空の形＝null を返す）。
//   口は呼ばない（網の手前で 599）。本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { isBuilt } from "../../lib/built-routes";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const PLACE = join(WEB, "app/(dev)/dev/mock/f11");
const F11 = join(WEB, "features/F11");
const MOCKS_SRC = join(PLACE, "mocks.tsx");

/** 状態の持ち主の画面の葉と状態の数（mocks.tsx の ticket・leaf と同じ・71） */
const OWNERS: Record<string, number> = {
  "K-874": 9,
  "K-877": 1,
  "K-898": 15,
  "K-899": 2,
  "K-905": 8,
  "K-911": 7,
  "K-912": 11,
  "K-913": 3,
  "K-928": 4,
  "K-930": 6,
  "K-931": 5,
};
const TOTAL = Object.values(OWNERS).reduce((a, b) => a + b, 0);
/** この葉が描く状態 */
const MB = [
  "mb-members",
  "mb-guests",
  "mb-add",
  "mb-add-pick",
  "mb-add-group-new",
  "mb-add-created",
  "mb-add-from-group",
  "mb-group-new",
  "mb-group-new-dup",
  "mb-group-menu",
  "mb-group-rename",
  "mb-group-rename-dup",
  "mb-group-delete",
  "mb-guest-menu",
  "mb-guest-suspend",
  "mb-guest-suspended",
  "mb-guest-resume",
  "mb-guest-remove",
];
const TK = [
  "tk-private",
  "tk-share",
  "tk-share-empty",
  "tk-share-saving",
  "tk-share-failed",
  "tk-shown",
  "tk-shown-readonly",
  "tk-unshare",
  "tk-from-request",
];
const MINE = [...MB, ...TK];
const WIDTHS = [375, 768, 1440] as const;
/** 幅ごとの行 ID（F1 が字で引けるよう、行 ID をそのまま書く） */
const WIDTH_ROW: Record<(typeof WIDTHS)[number], string> = {
  375: "K871-UI-002",
  768: "K871-UI-003",
  1440: "K871-UI-004",
};
const SEIKO = "セイコー株式会社（ゲスト）";

function mockEntries(): { id: string; ticket: string; leaf: string }[] {
  const src = readFileSync(MOCKS_SRC, "utf8");
  return [...src.matchAll(/\{\s*id:\s*"([^"]+)",[^{}]*?\bticket:\s*"([^"]*)",\s*leaf:\s*"([^"]*)"/g)].map((m) => ({
    id: m[1]!,
    ticket: m[2]!,
    leaf: m[3]!,
  }));
}
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openState(page: Page, id: string, width: number, height = width === 375 ? 812 : 900) {
  await page.setViewportSize({ width, height });
  const res = await page.goto(`/dev/mock/f11/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.getByText("この状態はまだありません", { exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K871-MK-001 モックの状態は 71 個で、画面の葉 11 本が持つ数（K-874=9・K-877=1・K-898=15・K-899=2・K-905=8・K-911=7・K-912=11・K-913=3・K-928=4・K-930=6・K-931=5）とちょうど同じ・同じ id が 2 つ無い", () => {
  const entries = mockEntries();
  expect(entries.length).toBe(TOTAL);
  expect(new Set(entries.map((e) => e.id)).size, "同じ id が 2 つある").toBe(TOTAL);
  const count: Record<string, number> = {};
  for (const e of entries) count[e.ticket] = (count[e.ticket] ?? 0) + 1;
  expect(count).toEqual(OWNERS);
});

test("K871-MK-002 各状態の持ち主（ticket）は K-<数> の字で leaf と同じ・部品の葉（K-871・K-872・K-873）や口の葉を指さない", () => {
  const bad = mockEntries()
    .filter((e) => !/^K-\d+$/.test(e.ticket) || e.ticket !== e.leaf || !(e.ticket in OWNERS))
    .map((e) => `${e.id}：ticket ${e.ticket}・leaf ${e.leaf}`);
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K871-MK-003 画面に出る文に「取引先」「クライアント」「先方の人」が 0：features/F11 と下絵の置き場（stage9 の写しを含む）の字（注を除く）に無い（呼び名は「ゲスト」「ゲストの場所」に 1 つ）", () => {
  const files = [...walk(F11), ...walk(PLACE)].filter((f) => /\.(tsx?|css)$/.test(f));
  expect(files.length).toBeGreaterThan(10);
  const WORDS = ["取引先", "クライアント", "先方の人"];
  const bad = files
    .filter((f) => WORDS.some((w) => noComments(readFileSync(f, "utf8")).includes(w)))
    .map((f) => f.replace(ROOT, ""));
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K871-MK-004 部品は見た目だけ：share/views.tsx・share/frame.tsx・requests/views.tsx・requests/list.tsx・clients/parts.tsx は口を呼ばない（fetch・lib/api・useEffect・useRouter・lib/auth の import が無い）。CSS は生の色（# と rgb・hsl）を書かず、px は @media の行にしか無い", () => {
  const tsx = [
    "share/views.tsx",
    "share/frame.tsx",
    "requests/views.tsx",
    "requests/list.tsx",
    "clients/parts.tsx",
  ].map((f) => join(F11, f));
  const css = [
    "share/share.css",
    "requests/requests.css",
    "clients/clients.css",
    "clients/clients-page.css",
    "choice.css",
  ].map((f) => join(F11, f));
  for (const f of [...tsx, ...css]) expect(existsSync(f), `${f} が無い`).toBe(true);
  for (const f of tsx) {
    const s = noComments(readFileSync(f, "utf8"));
    expect(s, `${f} が口を呼んでいる`).not.toMatch(/fetch\(|lib\/api|useEffect|useRouter|lib\/auth/);
  }
  for (const f of css) {
    const s = noComments(readFileSync(f, "utf8"));
    expect(s, `${f} に生の色`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    const px = s.split("\n").filter((l) => /\d\s*px/.test(l) && !/@media/.test(l));
    expect(px, `${f} の @media の外に px：${px.join(" / ")}`).toEqual([]);
  }
});

test("K871-MK-005 道の一覧：/dev/mock/f11 と /dev/mock/f11/:id が built-routes に在る", () => {
  expect(isBuilt("/dev/mock/f11")).toBe(true);
  expect(isBuilt("/dev/mock/f11/mb-members")).toBe(true);
});

test("K871-MK-006 後ろの葉の物はこの葉が持たない：render-cu-rq.tsx の renderRq と render-cp.tsx の renderCp は在って関数を出す（中身は K-872・K-873 の物で、この葉は形を見ない）。K-871 の mock の状態はちょうど 27（mb-18・tk-9。rq-・pt- は無い。mb-join は K-877 の物なので描かない・見ない）で、どれも mocks.tsx に在る", () => {
  const rq = noComments(readFileSync(join(PLACE, "render-cu-rq.tsx"), "utf8"));
  const cp = noComments(readFileSync(join(PLACE, "render-cp.tsx"), "utf8"));
  expect(rq).toMatch(/export function renderRq\(/);
  expect(cp).toMatch(/export function renderCp\(/);
  const ids = new Set(mockEntries().map((e) => e.id));
  expect(MINE.length).toBe(27);
  expect(MINE.filter((i) => /^(rq|pt)-/.test(i))).toEqual([]);
  expect(MINE.filter((i) => !ids.has(i))).toEqual([]);
});

// ---- 実ブラウザ ----

test("K871-UI-001 索引 /dev/mock/f11：h1「段 12 のモック（ゲストと回す）」と、状態のリンクが 71 本（/dev/mock/f11/<状態>）", async ({
  page,
}) => {
  await guard(page);
  const res = await page.goto("/dev/mock/f11");
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "段 12 のモック（ゲストと回す）", exact: true }),
  ).toBeVisible();
  await expect(page.locator('main ul a[href^="/dev/mock/f11/"]')).toHaveCount(TOTAL);
});

for (const w of WIDTHS) {
  test(`${WIDTH_ROW[w]} 幅 ${w}：mb-18・tk-9 の 27 状態がどれも 200 で開き、「この状態はまだありません」が無く、横のはみ出し 0`, async ({
    page,
  }) => {
    await guard(page);
    for (const id of MINE) {
      await openState(page, id, w);
      expect(await overflowX(page), `${id} が幅 ${w} で横にはみ出す`).toBe(0);
    }
  });
}

test("K871-UI-005 失敗：27 状態を描いて pageerror と hydration の知らせが 0", async ({ page }) => {
  await guard(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  for (const id of MINE) await openState(page, id, 1440);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K871-UI-006 チケットの詳細・社内だけ（tk-private）：右のパネルに見出し「ゲストに見せる」と字「ゲストには見えません」、押せる「ゲストに見せる」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-private", 1440);
  await expect(page.getByRole("heading", { name: "ゲストに見せる", exact: true })).toBeVisible();
  await expect(page.getByText("ゲストには見えません", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ゲストに見せる", exact: true })).toBeEnabled();
});

test("K871-UI-007 ゲストに見せる小窓（tk-share・tk-share-empty）：選べる 3 つのゲストのグループ（セイコー・京蟻システム・合同会社ミナト）。グループが無いときは「ゲストのグループがまだありません」と、メンバーの画面で作る案内", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-share", 1440);
  const dlg = page.getByRole("dialog");
  await expect(
    dlg.getByText(`${SEIKO}山田 花子 様・鈴木 健太 様 ほか（3 人・招待中 1）`, { exact: true }),
  ).toBeVisible();
  await expect(dlg.getByText("京蟻システム株式会社（ゲスト）大橋 誠 様（1 人）", { exact: true })).toBeVisible();
  await expect(dlg.getByText("合同会社ミナト（ゲスト）小林 様（1 人）", { exact: true })).toBeVisible();
  await openState(page, "tk-share-empty", 1440);
  await expect(page.getByText("ゲストのグループがまだありません", { exact: true })).toBeVisible();
  await expect(
    page.getByText("メンバーの画面の「ゲスト」のタブで、ゲストのグループを作ってから、もう一度開いてください。", {
      exact: true,
    }),
  ).toBeVisible();
});

test("K871-UI-008 見せた後（tk-shown・tk-shown-readonly・tk-from-request）：右のパネルに「セイコー株式会社（ゲスト）」とチャットの頭の印「ゲストに見えるやり取り」。読むだけの人は見せる相手を変えるボタンが押せない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-shown", 1440);
  await expect(page.getByText(SEIKO, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("ゲストに見えるやり取り", { exact: true })).toBeVisible();
  await openState(page, "tk-from-request", 1440);
  await expect(page.getByText("ゲストに見えるやり取り", { exact: true })).toBeVisible();
  await openState(page, "tk-shown-readonly", 1440);
  await expect(page.getByRole("button", { name: "相手を選ぶ", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "見せるのをやめる", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("K871-UI-009 小窓の確かめ（tk-share-saving・tk-share-failed・tk-unshare）：決めている間は押せない・失敗の知らせが出る・やめる確かめは「ゲストの画面から、このチケットは消えます。」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-share-saving", 1440);
  await expect(page.getByRole("dialog").getByRole("button", { name: "やめる", exact: true })).toBeDisabled();
  await openState(page, "tk-share-failed", 1440);
  await expect(page.getByText("見せる相手を決められませんでした", { exact: true })).toBeVisible();
  await openState(page, "tk-unshare", 1440);
  await expect(page.getByText("ゲストの画面から、このチケットは消えます。", { exact: true })).toBeVisible();
});

test("K871-UI-010 メンバーの画面（mb-members・mb-guests）：ゲストのタブはゲストのグループ（セイコー株式会社（ゲスト））ごとにゲストが並び、メンバーのタブには社内の人だけ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-guests", 1440);
  await expect(page.getByText(SEIKO, { exact: true }).first()).toBeVisible();
  await openState(page, "mb-members", 1440);
  await expect(page.locator("body")).not.toContainText(SEIKO);
});

test("K871-UI-011 招くの小窓（mb-add・mb-add-pick・mb-add-group-new・mb-add-created・mb-add-from-group）：題「招く」・役割「ゲスト」とゲストのグループの選び肢・最後に「＋ 新しいゲストのグループを作る」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-add", 1440);
  await expect(page.getByText("招く", { exact: true }).first()).toBeVisible();
  await openState(page, "mb-add-pick", 1440);
  await expect(page.getByText("＋ 新しいゲストのグループを作る", { exact: true })).toBeVisible();
  await openState(page, "mb-add-group-new", 1440);
  await expect(page.getByText("ゲストのグループを作る", { exact: true }).first()).toBeVisible();
  await openState(page, "mb-add-created", 1440);
  await expect(page.getByText(SEIKO, { exact: true }).first()).toBeVisible();
  await openState(page, "mb-add-from-group", 1440);
  await expect(page.getByText(SEIKO, { exact: true }).first()).toBeVisible();
});

test("K871-UI-012 ゲストのグループの作る・名前を直す・消す（mb-group-new・mb-group-new-dup・mb-group-menu・mb-group-rename・mb-group-delete）：題と、同じ名前の入力の誤りの字、消す確かめの「チケットは残る」の字", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-group-new", 1440);
  await expect(page.getByText("ゲストのグループを作る", { exact: true }).first()).toBeVisible();
  await openState(page, "mb-group-new-dup", 1440);
  await expect(
    page.getByText("同じ名前のゲストのグループがあります。別の名前にしてください", { exact: true }),
  ).toBeVisible();
  await openState(page, "mb-group-menu", 1440);
  await expect(page.getByRole("menuitem", { name: "名前を直す", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "消す", exact: true })).toBeVisible();
  await openState(page, "mb-group-rename", 1440);
  await expect(page.getByText("ゲストのグループの名前を直す", { exact: true })).toBeVisible();
  await openState(page, "mb-group-delete", 1440);
  await expect(page.getByText("見せていたチケットから外れます。チケットは残ります。", { exact: true })).toBeVisible();
});

test("K871-UI-013 押せる物の大きさ（幅 375・tk-private・mb-guests・mb-group-menu）：ボタンは幅も高さも 24px 以上", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["tk-private", "mb-guests", "mb-group-menu"]) {
    await openState(page, id, 375);
    const small = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>("button:not([disabled]), [role=menuitem]")]
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24)).length,
    );
    expect(small, `${id}：24px に足りないボタン`).toBe(0);
  }
});

test("K871-UI-014 小窓 × 高さ 812・560（幅 375・tk-share・mb-add・mb-group-delete）：頭の上端が 0 以上・足の下端が画面の高さ以下", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["tk-share", "mb-add", "mb-group-delete"]) {
    for (const h of [812, 560]) {
      await openState(page, id, 375, h);
      const box = await page.getByRole("dialog").or(page.getByRole("alertdialog")).first().boundingBox();
      expect(box, `${id} の小窓が無い`).not.toBeNull();
      expect(box!.y, `${id}@${h} の上端`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${id}@${h} の下端`).toBeLessThanOrEqual(h);
    }
  }
});
