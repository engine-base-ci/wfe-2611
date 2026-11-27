// K-801「段 11 の下絵（/dev/mock/f10 の 63 の状態）と部品（features/F10 の members・member・ws・account）を本線に入れる（K-70 の葉・W0）」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f10（索引と 63 の状態）。
//   モックは本番と同じ部品（features/F10/{members,member,ws,account}・components/k）を決めた値で並べたもの（代表が 2026-11-22 に下絵を見て 13 の問いに答えた形・D-154）。
//   見ること：全部の状態が描ける・幅 375／768／1440 で横のはみ出し 0・状態の持ち主は画面の葉（切り方.md の 5 章どおり）・
//   外した物（知らせる・人ごとのできること・書き出し・取引先・記録の自分の入口）が無い・最後に使った日の列・
//   兼務の形（1 人が複数のグループ）・設定の「プランと支払い」の差し込み口 planRow・部品は口を呼ばない。
//   画面に出す字と並びは下絵が正（この試験は字の細部を写さず、決めの核だけ見る）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCK_DIR = join(WEB, "app/(dev)/dev/mock/f10");
const MOCKS_SRC = join(MOCK_DIR, "mocks.tsx");
const F10 = join(WEB, "features/F10");
const PARTS = ["members", "member", "ws", "account"] as const;

/** 下絵の状態と持ち主の葉（63 の状態・07_functional/段11-F10/切り方.md の 5 章どおり） */
const OWNER: Record<string, string> = {
  "mb-list": "K-818",
  "mb-role-menu": "K-818",
  "mb-role-stepup": "K-818",
  "mb-role-last-admin": "K-818",
  "mb-more": "K-818",
  "mb-no-access": "K-818",
  "mb-invite-menu": "K-809",
  "mb-invite-revoke": "K-809",
  "mb-invite-group": "K-809",
  "gr-add": "K-805",
  "gr-add-error": "K-805",
  "gr-layer-add": "K-805",
  "gr-edit": "K-806",
  "gr-order": "K-806",
  "gr-layers": "K-806",
  "md-view": "K-819",
  "md-self": "K-819",
  "md-suspended": "K-819",
  "md-failed": "K-819",
  "md-move": "K-820",
  "md-also": "K-820",
  "md-suspend": "K-821",
  "md-resume": "K-821",
  "md-2fa-reset": "K-821",
  "md-remove": "K-822",
  "md-remove-each": "K-822",
  "md-remove-none": "K-822",
  "md-remove-last-admin": "K-822",
  "lg-list": "K-825",
  "lg-search": "K-825",
  "lg-filter": "K-825",
  "lg-deleted": "K-825",
  "lg-empty": "K-825",
  "lg-failed": "K-825",
  "lg-manager": "K-825",
  "st-view": "K-831",
  "st-name-saved": "K-831",
  "st-name-error": "K-831",
  "st-logo": "K-831",
  "st-perm": "K-831",
  "st-no-access": "K-831",
  "st-delete": "K-832",
  "st-delete-ready": "K-832",
  "st-deleting": "K-832",
  "me-profile": "K-839",
  "me-saved": "K-839",
  "me-name-error": "K-839",
  "me-avatar": "K-839",
  "me-email": "K-840",
  "me-email-error": "K-840",
  "me-email-sent": "K-840",
  "me-email-done": "K-840",
  "me-leave": "K-841",
  "me-leave-ready": "K-841",
  "me-leave-last-admin": "K-841",
  "me-sessions": "K-842",
  "me-session-revoke": "K-842",
  "me-notify": "K-843",
  "me-notify-quiet": "K-843",
  "me-notify-copy": "K-843",
  "me-notify-failed": "K-843",
  "me-menu": "K-844",
  "me-org": "K-844",
};
/** 代表の答えで外した状態（知らせる・人ごとのできること・書き出し・管理者でない人の記録の入口。lg-mine はマネージャーの分の lg-manager に替えた） */
const REMOVED = ["mb-nudge-sent", "md-perm", "lg-export", "lg-export-running", "lg-export-ready", "lg-mine"] as const;
const IDS = Object.keys(OWNER);
const WIDTHS = [375, 768, 1440] as const;

const read = (f: string) => readFileSync(f, "utf8");
/** 注釈を除いた中身（字や名前の確かめは注釈を見ない） */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
/** MOCKS の並びを、機械（canvas_field_gate.py）と同じ読み方で読む */
function entries(): { id: string; screen: string; ticket: string; leaf: string }[] {
  const arr = /export const MOCKS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(read(MOCKS_SRC))?.[1] ?? "";
  return [
    ...arr.matchAll(
      /\{\s*id:\s*"([^"]+)",\s*no:\s*"[^"]*",\s*screen:\s*"([^"]+)",\s*label:\s*"[^"]*",\s*ticket:\s*"([^"]*)",\s*leaf:\s*"([^"]*)"[^{}]*?\}/g,
    ),
  ].map((m) => ({ id: m[1]!, screen: m[2]!, ticket: m[3]!, leaf: m[4]! }));
}
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}

async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f10/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.getByText(`この状態はまだありません：${id}`)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K801-MK-001 下絵の状態は 63 個で、持ち主の表と余りも欠けも重なりも無く同じ。ticket と leaf は同じ K-番号で、K-0 の字が無い", () => {
  const got = entries();
  const ids = got.map((e) => e.id);
  expect(ids.length).toBe(63);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...IDS].sort());
  for (const e of got) {
    expect(e.ticket, `${e.id} の持ち主`).toBe(OWNER[e.id]);
    expect(e.leaf, `${e.id} の leaf は ticket と同じ`).toBe(e.ticket);
  }
  expect(read(MOCKS_SRC)).not.toMatch(/\bK-0\b/);
});

test("K801-MK-002 外した 6 つの状態の id は MOCKS に 1 つも無く、持ち主は画面の葉だけ（この葉・口の葉・外した葉 K-808・K-813・K-824・K-826 を指さない）", () => {
  const got = entries();
  const ids = got.map((e) => e.id);
  for (const id of REMOVED) expect(ids, `${id} は外した`).not.toContain(id);
  const owners = new Set(got.map((e) => e.ticket));
  for (const bad of ["K-801", "K-808", "K-813", "K-824", "K-826"])
    expect(owners, `${bad} は持ち主にならない`).not.toContain(bad);
  for (const e of got)
    expect(["members", "member-detail", "audit", "company-settings", "account", "tickets"], e.id).toContain(e.screen);
});

test("K801-MK-003 外した部品が無い：ws/export.tsx と、できることの小窓・2 段階認証を戻す確かめ・書き出しの帯と小窓・知らせるの上の 1 行の知らせ方（nudge）が、部品とモックのコードのどこにも無い", () => {
  expect(existsSync(join(F10, "ws/export.tsx"))).toBe(false);
  const re = /\b(PermDialog|ResetTwoFaConfirm|ExportBand|ExportDialog|NudgeState|nudge)\b|ws\/export/;
  const files = [...PARTS.flatMap((d) => sources(join(F10, d))), ...sources(MOCK_DIR)].filter((f) => /\.tsx?$/.test(f));
  for (const f of files) expect(code(f), `${f} が外した部品を読んでいる`).not.toMatch(re);
});

const LIVE = [
  "member/detail-dialogs.tsx",
  "member/member-page.tsx",
  "ws/audit-screen.tsx",
  "ws/settings-screen.tsx",
  "account/leave-workspace.tsx",
  "account/me-menu.tsx",
  "account/notify-screen.tsx",
  "account/profile-screen.tsx",
];
test("K801-MK-004 部品は見た目だけ：F10 の 4 つの置き場の .tsx は口を呼ばず（fetch・lib/api・useRouter・lib/auth）、生の色や大きさを書かない（style=・#色・px）", () => {
  for (const f of PARTS.flatMap((d) => sources(join(F10, d))).filter((p) => p.endsWith(".tsx"))) {
    const src = code(f);
    // 後の画面の葉が口につないだ頁と小窓（口を呼んでよい。生の値の決まりはそのまま）：
    //   member の頁と小窓 K-820〜K-822・会社の記録 K-825・会社の設定 K-818・K-832・自分の頁と抜ける K-840〜K-844
    if (!LIVE.some((x) => f.endsWith(`/${x}`)))
      expect(src, f).not.toMatch(/\bfetch\(|lib\/api|useRouter|from "@\/lib\/auth/);
    expect(src, f).not.toMatch(/style=\{|#[0-9a-fA-F]{3,6}\b|\d+px/);
  }
});

test("K801-MK-005 MOCKS は機械が読める形（{ id, no, screen, label, ticket, leaf } の順）で、書いた行の数と読めた数が同じ", () => {
  const written = [...read(MOCKS_SRC).matchAll(/^\s*\{\s*$|^\s*\{ id: "/gm)].length;
  expect(entries().length, "読めない行がある").toBe(written);
});

test("K801-MK-006 道の一覧に /dev/mock/f10 と /dev/mock/f10/:id が在る（機械生成 scripts/ci/gen_built_routes.py）", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f10");
  expect(BUILT_ROUTES).toContain("/dev/mock/f10/:id");
});

test("K801-MK-007 設定の「プランと支払い」は段 13 の差し込み口 planRow?: ReactNode を受け（labelledBy ws-plan）、「取引先」の区画と「書き出す」の行を持たない", () => {
  const src = code(join(F10, "ws/settings.tsx"));
  expect(src).toMatch(/planRow\?:\s*ReactNode/);
  expect(src).toMatch(/title="プランと支払い"\s+labelledBy="ws-plan"/);
  expect(src).not.toMatch(/取引先|書き出/);
});

test("K801-MK-008 兼務の形（D-154.15）：メンバーの下絵に、1 人が 2 つのグループに入る形が在る（佐藤はマネージャーを 2 つのグループで兼ね、田中は営業のメンバーで経理も兼ねる）", () => {
  const src = read(join(MOCK_DIR, "render-members.tsx"));
  expect([...src.matchAll(/id: "sato"/g)].length).toBeGreaterThanOrEqual(2);
  expect([...src.matchAll(/id: "tanaka"/g)].length).toBeGreaterThanOrEqual(2);
  expect([...src.matchAll(/manager: "佐藤 花子"/g)].length).toBeGreaterThanOrEqual(2);
});

test("K801-CG-001 画面の持ち主の検査（canvas_field_gate.py）が、/dev/mock/f10 の状態を持ち主のチケットの mock に結べる形で読む", () => {
  const out = runPy(["scripts/ci/canvas_field_gate.py", "--no-base"]).concat("");
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|状態が 1 つも無い|が 2 つある/);
});

test("K801-DS-001 正本の値の検査（design_gate --part --scales --usage）に FAIL が無い", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--scales",
    "--usage",
    "apps/web",
    "apps/bridge/src",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
});

test("K801-DS-002 生の長さ（D8・design_gate --raw-lengths）に FAIL が無い（運ぶ F10 の CSS に生の px が無い）", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--no-components",
    "--raw-lengths",
    "--no-base",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
});

test("K801-DS-003 クラスの検査（class_gate）が緑：定義の無いクラス・外枠の決まりの流用・組み立てたクラス名・style が 0", () => {
  const out = runPy(["scripts/ci/class_gate.py", "--no-base"]);
  expect(out).toContain("class_gate：緑");
});

// ---- 実ブラウザ ----

test("K801-UI-001 索引 /dev/mock/f10 は 63 の状態の見出しを並べ、押すとその状態が開く", async ({ page }) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f10"))?.status()).toBe(200);
  const links = page.getByRole("main").getByRole("link");
  await expect(links).toHaveCount(IDS.length);
  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`/dev/mock/f10/${entries()[0]!.id}$`));
  await expect(page.locator(`[data-mock="${entries()[0]!.id}"]`)).toBeVisible();
});

for (const w of WIDTHS) {
  test(`K801-UI-002 幅 ${w}：63 の状態が全部開き、横のはみ出しが 0`, async ({ page }) => {
    await guard(page);
    const bad: string[] = [];
    for (const id of IDS) {
      await openState(page, id, w);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`${id}：横溢れ ${o}px`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K801-UI-003 外した状態の id を開くと「この状態はまだありません」と出て、外枠も部品も出ない", async ({ page }) => {
  await guard(page);
  for (const id of REMOVED) {
    const res = await page.goto(`/dev/mock/f10/${id}`);
    expect(res?.status(), id).toBe(200);
    await expect(page.getByText(`この状態はまだありません：${id}`, { exact: true })).toBeVisible();
    await expect(page.locator(".k-shell"), id).toHaveCount(0);
  }
});

test("K801-UI-004 メンバー（mb-list）：人の 7 行に「最後に使った日」が出て（鈴木 3 日前・田中 12 日前から使っていない）、招待中の行には出ない。「知らせる」のボタンは無く、兼務の佐藤と田中は 2 つのグループに 1 行ずつ出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-list", 1440);
  const rows = page.locator("li.k-f10m-row");
  await expect(rows).toHaveCount(8);
  await expect(page.locator(".k-f10m-last small")).toHaveCount(7);
  await expect(rows.filter({ hasText: "鈴木 一郎" }).locator(".k-f10m-last")).toContainText("3 日前");
  await expect(rows.filter({ hasText: "田中 美咲" }).first().locator(".k-f10m-last")).toContainText(
    "12 日前から使っていない",
  );
  await expect(rows.filter({ hasText: "kimura@engine-base.example" }).locator(".k-f10m-last small")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /知らせる/ })).toHaveCount(0);
  await expect(rows.filter({ hasText: "佐藤 花子" })).toHaveCount(2);
  await expect(rows.filter({ hasText: "田中 美咲" })).toHaveCount(2);
});

test("K801-UI-005 メンバー（mb-role-menu）：役割の ▾ は 管理者・マネージャー・メンバー・閲覧のみ の 4 つを出し（ゲストは出さない・段 12 が足す）、自分の行の役割は押せない形", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-role-menu", 1440);
  const menu = page.getByRole("menu").first();
  await expect(menu).toBeVisible();
  for (const name of ["管理者", "マネージャー", "メンバー", "閲覧のみ"]) {
    await expect(menu.getByRole("menuitem", { name, exact: true }), name).toBeVisible();
  }
  await expect(menu.getByRole("menuitem", { name: /ゲスト/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "管理者 ▾", exact: true })).toHaveAttribute("aria-disabled", "true");
});

test("K801-UI-006 メンバーの 1 人（md-view）：区画は グループと役割・担当しているもの・分身・ログイン・最近の記録 の 5 つで、「できること」の欄も「取引先」の行も無い。2 段階認証を戻す（md-2fa-reset）は押せない形で、確かめの小窓は開かない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "md-view", 1440);
  for (const name of ["グループと役割", "担当しているもの", "分身", "ログイン", "最近の記録"]) {
    await expect(page.getByRole("heading", { name, exact: true }), name).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "できること", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByText("取引先")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /足す・外す/ })).toHaveCount(0);
  await openState(page, "md-2fa-reset", 1440);
  await expect(page.getByRole("button", { name: "2 段階認証を戻す", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K801-UI-007 設定（st-view）：「取引先」の区画も書き出しの字も無く、「プランと支払い」の区画は押せない形の 1 行（プランを変える・請求書）を出す", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "st-view", 1440);
  const main = page.getByRole("main");
  await expect(main.getByText("取引先")).toHaveCount(0);
  await expect(main.getByText(/書き出/)).toHaveCount(0);
  const plan = page.getByRole("region", { name: "プランと支払い", exact: true });
  await expect(plan).toBeVisible();
  await expect(plan.getByRole("button", { name: "プランを変える", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(plan.getByRole("button", { name: "請求書", exact: true })).toHaveAttribute("aria-disabled", "true");
});

test("K801-UI-008 ワークスペースを消す小窓（st-delete）：「先に書き出せる」の案内が無く、名前が合うまで「本人確認して消す手続きをする」は押せない。名前が合う（st-delete-ready）と押せる", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "st-delete", 1440);
  const d = page.getByRole("dialog", { name: "ワークスペースを消す", exact: true });
  await expect(d).toBeVisible();
  await expect(d.getByText(/書き出/)).toHaveCount(0);
  await expect(d.getByRole("button", { name: "本人確認して消す手続きをする", exact: true })).toBeDisabled();
  await openState(page, "st-delete-ready", 1440);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "本人確認して消す手続きをする", exact: true }),
  ).toBeEnabled();
});

test("K801-UI-009 記録：管理者の画面（lg-list）に「書き出す」のボタンも「持ち出し」の札も無い。マネージャーの画面（lg-manager）は検索だけで札も「書き出す」も出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "lg-list", 1440);
  await expect(page.getByRole("button", { name: /書き出/ })).toHaveCount(0);
  const chips = page.getByRole("group", { name: "札で絞る", exact: true });
  await expect(chips.getByRole("button")).toHaveCount(6);
  await expect(chips.getByRole("button", { name: "持ち出し", exact: true })).toHaveCount(0);
  await openState(page, "lg-manager", 1440);
  await expect(page.getByRole("heading", { name: "記録", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "札で絞る", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /書き出/ })).toHaveCount(0);
});

test("K801-UI-010 ワークスペースの切り替え（me-org）：入っている場所は押せる並びで、届いた招待と「新しいワークスペースを作る」は押せない形（aria-disabled・title「まだ使えません」・字に「準備中」が無い）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "me-org", 1440);
  const menu = page.getByRole("menu", { name: "ワークスペースを切り替える", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: /京蟻システム株式会社/ })).toBeEnabled();
  // 届いた招待を押した先は代表の答え待ち（D-154.81）。答えが出たらリンクに戻す
  await expect(menu.getByRole("link", { name: /届いた招待/ })).toHaveCount(0);
  const invited = menu.locator('[aria-disabled="true"]').filter({ hasText: "届いた招待" });
  await expect(invited).toHaveCount(1);
  await expect(invited).toHaveAttribute("title", "まだ使えません");
  await expect(menu.locator('[aria-disabled="true"]').filter({ hasText: "新しいワークスペースを作る" })).toHaveCount(1);
  await expect(menu).not.toContainText("準備中");
});

test("K801-UI-011 ログインと安全（me-sessions）：「入っている端末」の区画は在り、記録の画面（/workspace/log）へのリンクは本文に無い（管理者でない人が自分の記録を開く入口は作らない）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "me-sessions", 1440);
  const body = page.locator('section[aria-labelledby="security-title"]');
  await expect(body.getByRole("region", { name: "入っている端末", exact: true })).toBeVisible();
  await expect(body.locator('a[href*="/workspace/log"]')).toHaveCount(0);
});

test("K801-UI-012 スマホの幅 375（mb-list）：人の行の「最後に使った日」が行の 2 行目に出て、横のはみ出しは 0", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mb-list", 375);
  const row = page.locator("li.k-f10m-row").filter({ hasText: "鈴木 一郎" });
  const last = row.locator(".k-f10m-last");
  await expect(last).toBeVisible();
  await expect(last).toContainText("3 日前");
  const [rowBox, lastBox] = await Promise.all([row.boundingBox(), last.boundingBox()]);
  expect(lastBox!.y, "最後に使った日は名前の行の下").toBeGreaterThan(rowBox!.y + 1);
  expect(await overflowX(page)).toBe(0);
});
