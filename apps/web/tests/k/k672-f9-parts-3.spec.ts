// K-672「段 10 の部品 3：チケットの側・チケットの設定・メンバー（下絵 v2 の 7 状態）を本線に入れ、仮の本文の部品を段 5 の部品に替える（K-69 の葉・W0）」の試験
//   （実 Chrome と、ファイル・検査を読む試験・実装より先に積む）。K-670 の後。
//   的：開発用の置き場 /dev/mock/f9 の、K-672 が描く 7 状態（チケットの側 3・設定 3・メンバー 1）。
//   見ること：7 状態が描ける・幅 375／768／1440 で横のはみ出し 0・完了を止めるのは「必ず守る」から入った確認項目だけ（決め 12）・
//   設定は種別・状態・項目の 3 つだけ（チケットの形は無い）・メンバーはグループごと・仮の本文の部品が無い・生の長さ 0。
//   画面に出す字と並びは下絵が正。テストはチケットを作る人が書き、実装する人は変えない
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DRAWN_BY, MOCK_DIR, WEB, guard, openState, overflowX, read } from "./f9-mock-kit";

const MINE = DRAWN_BY["K-672"];
const KN = join(WEB, "features/F9/knowledge");
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });

test("K672-MK-001 描き手（ticket-mocks.tsx・ws-mocks.tsx）が K-672 の 7 状態を描き、render.tsx がそれを読む", () => {
  const src = strip(read(join(MOCK_DIR, "ticket-mocks.tsx"))) + strip(read(join(MOCK_DIR, "ws-mocks.tsx")));
  for (const id of MINE) expect(src, `${id} を描く所が無い`).toContain(`"${id}"`);
  const r = strip(read(join(MOCK_DIR, "render.tsx")));
  expect(r).toMatch(/renderTicket\(id, theme\)/);
  expect(r).toMatch(/renderWorkspace\(id, theme\)/);
});

test("K672-MK-002 仮の本文の部品（doc-temp.tsx・doc-temp.css）が無く、どこからも読まれない（本文は段 5 の DocEditor・DocView）", () => {
  expect(existsSync(join(KN, "doc-temp.tsx"))).toBe(false);
  expect(existsSync(join(KN, "doc-temp.css"))).toBe(false);
  for (const dir of [join(WEB, "app"), join(WEB, "features"), join(WEB, "components")]) {
    for (const f of sources(dir)) expect(strip(read(f)), `${f} が仮の部品を読む`).not.toMatch(/doc-temp|k-f9d-/);
  }
  const body =
    strip(read(join(MOCK_DIR, "ticket-mocks.tsx"))) + strip(read(join(WEB, "features/F9/settings/views.tsx")));
  expect(body).toMatch(/from "@\/features\/F4\/doc\/editor"/);
});

test("K672-MK-003 部品（ticket-views・settings・members）は口を呼ばず、編集の部品を直に読まない", () => {
  const files = [
    join(KN, "ticket-views.tsx"),
    ...sources(join(WEB, "features/F9/settings")).filter((p) => p.endsWith(".tsx")),
    ...sources(join(WEB, "features/F9/members")).filter((p) => p.endsWith(".tsx")),
  ];
  for (const f of files) {
    const src = strip(read(f));
    expect(src, `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
    expect(src, `${f} が編集の部品を読む`).not.toMatch(/@tiptap\/|prosemirror-/);
  }
});

test("K672-MK-004 状態 tk-blocked の小窓の部品は、止める行を「必ず守る」から入った行（from あり）だけに絞る（決め 12）", () => {
  const src = strip(read(join(KN, "ticket-views.tsx")));
  expect(src).toMatch(/left\.filter\(\(r\) => r\.from\)/);
});

test("K672-DS-001 G72（D8 生の長さ）で、ticket.css・settings.css・members.css・ticket-views・settings・members に台帳に無い生の値が 0 件", () => {
  let out = "";
  try {
    out = execFileSync(
      "python3",
      [
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
      ],
      { cwd: join(WEB, "../.."), encoding: "utf8", timeout: 300_000 },
    );
  } catch (e) {
    out = String((e as { stdout?: string }).stdout ?? "");
  }
  const mine = out
    .split("\n")
    .filter((l) =>
      /D8 apps\/web\/features\/F9\/(settings|members)\/|D8 apps\/web\/features\/F9\/knowledge\/(ticket|ticket-views)\./.test(
        l,
      ),
    );
  expect(mine, mine.join("\n")).toEqual([]);
});

test("K672-UI-001 7 状態が全部開き（200・外枠が出る）、口を 1 回も呼ばない", async ({ page }) => {
  const calls = await guard(page);
  for (const id of MINE) await openState(page, id, 1440);
  expect(calls, calls.join(", ")).toEqual([]);
});

test("K672-UI-002 7 状態が幅 375 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 375);
    expect(await overflowX(page), `${id} が幅 375 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K672-UI-003 7 状態が幅 768 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 768);
    expect(await overflowX(page), `${id} が幅 768 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K672-UI-004 7 状態が幅 1440 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 1440);
    expect(await overflowX(page), `${id} が幅 1440 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K672-UI-005 tk-guard：やり取りに AI の「このチケットで守る物」が並び、必ず守る（確認項目に入れました）と開いたページの 2 つの区切りが出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-guard", 1440);
  const guardBox = page.getByLabel("このチケットで守る物", { exact: true });
  await expect(guardBox).toBeVisible();
  await expect(guardBox.getByRole("region", { name: "必ず守る", exact: true })).toBeVisible();
  await expect(guardBox.getByRole("region", { name: "このチケットのために開いたページ", exact: true })).toBeVisible();
  await expect(guardBox.getByRole("link", { name: "請求書の送り方", exact: true })).toBeVisible();
});

test("K672-UI-006 tk-opened：AI が開いたページがやり取りの 1 行ずつ残り（題名はリンク・場所が横に出る）、守れていなかった決まりの行が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-opened", 1440);
  const feed = page.getByRole("feed", { name: "やり取り", exact: true });
  await expect(feed.getByRole("link", { name: "セイコー商事との決めごと", exact: true })).toBeVisible();
  await expect(feed.getByText(/グループ：営業/)).toBeVisible();
  await expect(feed.getByText("守れていなかった決まりが 1 つ", { exact: false })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("部署");
});

test("K672-UI-007 tk-blocked：完了を止める小窓に並ぶのは「必ず守る」から入った未チェックの行（外に出す前の確かめ）だけで、人が足した行は並ばない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-blocked", 1440);
  const dlg = page.getByRole("dialog", { name: "まだ完了にできません", exact: true });
  const list = dlg.getByRole("list", { name: "チェックの付いていない、必ず守る確認項目", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("外に出す前に、人が中身を見た");
  await expect(list).toContainText("ナレッジ：外に出す前の確かめ");
  await expect(list).not.toContainText("先月と同じ書式になっている");
});

test("K672-UI-008 tk-blocked：人が足した未チェックの行は完了を止めない注意だけ（小窓に「完了は止めません」の 1 行）・外に出る操作は人の承認が別に要るの 1 行も出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-blocked", 1440);
  const dlg = page.getByRole("dialog", { name: "まだ完了にできません", exact: true });
  await expect(dlg.getByText("完了は止めませんが", { exact: false })).toBeVisible();
  await expect(dlg.getByText("外に出る操作は、チェックとは別に人の承認が要ります", { exact: false })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "確認項目に戻る", exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
});

test("K672-UI-009 tk-blocked：右のパネルの確認項目は、ナレッジから入った行に「ナレッジ：ページの名前」の印が付き、人が足した行（先月と同じ書式）には付かない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "tk-blocked", 1440);
  const specs = page.getByRole("region", { name: "確認項目", exact: true });
  await expect(specs.getByText("ナレッジ：請求書の送り方", { exact: true }).first()).toBeVisible();
  const human = specs.getByRole("listitem").filter({ hasText: "先月と同じ書式になっている" });
  await expect(human).toHaveCount(1);
  await expect(human).not.toContainText("ナレッジ：");
  await expect(specs.getByText("あと 2 つ", { exact: true })).toBeVisible();
});

test("K672-UI-010 set-kinds：チケットの設定に「種別」「状態」「項目」の 3 つのタブだけがあり、「チケットの形」は無い。種別は名前・色・本文のひな形の欄を持つ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "set-kinds", 1440);
  const tabs = page.getByRole("tablist", { name: "チケットの設定の中", exact: true }).getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs).toHaveText(["種別", "状態", "項目"]);
  expect(await page.locator("body").innerText()).not.toContain("チケットの形");
  const form = page.getByRole("form", { name: /^種別「.+」を直す$/ });
  await expect(form.getByRole("textbox", { name: "名前", exact: false })).toBeVisible();
  await expect(form.getByRole("group", { name: "色", exact: true })).toBeVisible();
  await expect(form.getByText("本文のひな形", { exact: true })).toBeVisible();
});

test("K672-UI-011 set-kinds：色は見分けの色 8 つから選ぶ（ラジオが 8 つ・選ばれているのは 1 つ）", async ({ page }) => {
  await guard(page);
  await openState(page, "set-kinds", 1440);
  const colors = page.getByRole("group", { name: "色", exact: true }).getByRole("radio");
  await expect(colors).toHaveCount(8);
  await expect(page.getByRole("group", { name: "色", exact: true }).getByRole("radio", { checked: true })).toHaveCount(
    1,
  );
});

test("K672-UI-012 set-stages：状態は並べ替えのつまみつきで上から並び、編集中の 1 行に名前の欄と「やめる」「保存する」が出る（色の選びもある）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "set-stages", 1440);
  const list = page.getByRole("list", { name: "状態", exact: true });
  await expect(list.getByRole("button", { name: /を並べ替える$/ }).first()).toBeVisible();
  await expect(list.getByRole("textbox", { name: "名前", exact: false })).toBeVisible();
  await expect(list.getByRole("button", { name: "保存する", exact: true })).toBeVisible();
  await expect(list.getByRole("group", { name: "色", exact: true })).toBeVisible();
});

test("K672-UI-013 set-stages：始めと終わりの状態は消せず（消すボタンが押せない形）、途中の状態は消せる", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "set-stages", 1440);
  const del = (n: string) => page.getByRole("button", { name: `${n}を消す`, exact: true });
  await expect(del("未着手")).toHaveAttribute("aria-disabled", "true");
  await expect(del("完了")).toHaveAttribute("aria-disabled", "true");
  await expect(del("作業中")).not.toHaveAttribute("aria-disabled", "true");
});

test("K672-UI-014 set-fields：会社が足した項目の一覧に必須の印が付く行があり、選んだ項目に型・選ぶ物・説明・どの種別で出すかの欄が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "set-fields", 1440);
  const list = page.getByRole("list", { name: "会社が足した項目", exact: true });
  await expect(list.getByText("必須", { exact: true }).first()).toBeVisible();
  const form = page.getByRole("form", { name: /^項目「.+」を直す$/ });
  await expect(form.getByRole("textbox", { name: "名前", exact: false })).toBeVisible();
  await expect(form.getByText("型", { exact: true })).toBeVisible();
  await expect(form.getByRole("group", { name: "選ぶ物", exact: true })).toBeVisible();
  await expect(form.getByRole("textbox", { name: "説明", exact: false })).toBeVisible();
  await expect(form.getByRole("group", { name: "どの種別で出すか", exact: true })).toBeVisible();
});

test("K672-UI-015 mem-groups：メンバーはグループごとに 1 行で、開いた「営業」の中にだけメンバーが出る・「＋ グループ」は押せない形・「＋ 招く」は主ボタン", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mem-groups", 1440);
  const heads = page.locator("button.k-f9m-head");
  await expect(heads).toHaveCount(3);
  await expect(heads.first()).toHaveAttribute("aria-expanded", "true");
  await expect(heads.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("佐藤 花子", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ グループ", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "＋ 招く", exact: true })).toBeEnabled();
  expect(await page.locator("body").innerText()).not.toContain("部署");
});

test("K672-UI-016 mem-groups：頭の説明に「グループを押すと、そのグループのメンバーが出ます」があり、第 2 ナビの「チケットの設定」が押せる形", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "mem-groups", 1440);
  await expect(page.getByText("グループを押すと、そのグループのメンバーが出ます", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "チケットの設定", exact: true })).toBeVisible();
});
