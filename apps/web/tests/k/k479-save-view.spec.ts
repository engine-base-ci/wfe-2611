// K-479「検索条件を保存する・開く・直す・消す（保存の小窓・左のメニューのグループの下の並び）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-save-dialog・f7-save-error・f7-saved-menu（本番と同じ部品 features/F7/saved・代表 OK 待ち）。
//   口は網の手前で差し替える：保存した条件の「読み」は外枠の口 getShell の答えの saved_views（K-465 が載せる・1 件は K-475 の 13 個の鍵・K-466 が画面ごとの口の数を増やさないために 1 本で読む）。
//   書く口（createSavedView・updateSavedView・deleteSavedView）は K-475・K-476 の md の形（入力は name・share・scope_id・filters・columns・density・エラーは E-VWS-001〜008・020・021）。
//   listSavedViews（GET /api/v1/saved_views）は画面から呼ばない（0 回を見る）。書いたあとは外枠の答えを読み直す（K479-UI-019）。
//   一覧の口・絞りの部品は K-478 の道具 f7-list-mock.ts。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { countWrites, overflowX, WIDTHS } from "./kit";
import { gate, idOf, open, rowsOf } from "./list-mock";
import { ME, SALES, STAGE_DOING, SUZUKI, mockMine, queryOf, type Reply } from "./f7-list-mock";
import { ACCT, GROUP_SALES, shellData } from "./shell-answer";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP_PATH = `/tickets?view=all&scope=${SALES}`;
const GROUP_ACCT = { id: ACCT, name: "経理", ticket_prefix: "AC", writable: true, open_count: 0 };
const COLUMNS_KEY = "kaname.ticket-list.columns";
const ALL_COLUMNS = ["kind", "number", "title", "stage", "assignee", "scope", "due", "estimate", "updated"];
/** 正本（errors.json・K-475・K-476）の文。画面は番号から引いた文をそのまま出す */
const TEXT = {
  noName: "名前を入れてください",
  same: "同じ名前の保存した条件が、もうあります。別の名前にしてください",
  full: "保存できる条件は 50 件までです。いらないものを消してから保存してください",
  noScope: "見せるグループが見つかりませんでした。消されたか、見る権限が無いかもしれません",
  loadFailed: "読み込めませんでした。",
} as const;

interface SavedView {
  id: string;
  name: string;
  share: "self" | "group";
  scope_id: string | null;
  filters: Record<string, unknown>;
  columns: string[];
  density: "normal" | "compact";
  member_id: string;
  member_name: string;
  mine: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}
const view = (i: number, o: Partial<SavedView> = {}): SavedView => ({
  id: idOf(900 + i),
  name: `保存した条件 ${i}`,
  share: "self",
  scope_id: SALES,
  filters: { v: 1, view: "all", params: { done: "false" } },
  columns: ALL_COLUMNS,
  density: "normal",
  member_id: ME,
  member_name: "高本",
  mine: true,
  can_edit: true,
  created_at: "2026-11-20T00:00:00Z",
  updated_at: "2026-11-20T00:00:00Z",
  ...o,
});

interface Saved {
  views: SavedView[];
  /** 口に届いた書き込み（方法・体・Idempotency-Key） */
  writes: { method: string; path: string; body: Record<string, unknown> | null; key: string | null }[];
  /** 外枠の口 getShell を読んだ数（保存した条件の読みはこの答えの saved_views） */
  reads: number;
  /** 画面から listSavedViews（GET /api/v1/saved_views）を呼んだ数（0 でなければならない） */
  listReads: number;
  /** 外枠の答えの saved_views の形：ok＝配列・missing＝鍵が無い（古い口）・notarray＝配列でない */
  shape: "ok" | "missing" | "notarray";
  /** 次の書き込みの答えを替える（1 回だけ使う） */
  next: (method: string) => Reply | undefined | Promise<Reply | undefined>;
}

/** 保存した条件の口の差し替え（mockMine の後に呼ぶ。後から足した道すじが先に当たる） */
async function mockSaved(page: Page, views: SavedView[] = []): Promise<Saved> {
  const s: Saved = { views: [...views], writes: [], reads: 0, listReads: 0, shape: "ok", next: () => undefined };
  // 外枠の口（後から足した道すじが先に当たる）：営業と経理の 2 グループ・保存した条件は saved_views に載せる
  await page.route(/\/api\/v1\/shell(\?|$)/, async (route: Route) => {
    s.reads += 1;
    const data = shellData({ groups: [GROUP_SALES, GROUP_ACCT] });
    const extra =
      s.shape === "ok" ? { saved_views: s.views } : s.shape === "notarray" ? { saved_views: "読めない形" } : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...data, ...extra } }),
    });
  });
  await page.route(/\/api\/v1\/saved_views(\/[^/?]+)?(\?|$)/, async (route: Route) => {
    const req = route.request();
    const id = new URL(req.url()).pathname.split("/")[4] ?? null;
    let r: Reply;
    if (req.method() === "GET") {
      s.listReads += 1;
      r = { status: 200, body: { data: s.views, meta: { limit: 500 } } };
    } else {
      const body = (req.postDataJSON() as Record<string, unknown> | null) ?? null;
      s.writes.push({
        method: req.method(),
        path: new URL(req.url()).pathname,
        body,
        key: req.headers()["idempotency-key"] ?? null,
      });
      const own = await s.next(req.method());
      s.next = () => undefined;
      if (own) r = own;
      else if (req.method() === "POST") {
        const v = view(s.views.length + 1, {
          name: String(body?.["name"]),
          share: body?.["share"] as SavedView["share"],
          scope_id: (body?.["scope_id"] as string | null) ?? null,
          filters: body?.["filters"] as Record<string, unknown>,
          columns: body?.["columns"] as string[],
          density: body?.["density"] as SavedView["density"],
        });
        s.views.push(v);
        r = { status: 201, body: { data: v } };
      } else if (req.method() === "PATCH") {
        s.views = s.views.map((v) => (v.id === id ? { ...v, name: String(body?.["name"] ?? v.name) } : v));
        r = { status: 200, body: { data: s.views.find((v) => v.id === id) } };
      } else {
        s.views = s.views.filter((v) => v.id !== id);
        r = { status: 200, body: { data: { id } } };
      }
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return s;
}
const fail = (status: number, code: string): Reply => ({ status, body: { error: "error", code } });

const saveBtn = (p: Page) =>
  p.getByRole("region", { name: "検索条件", exact: true }).getByRole("button", { name: "検索条件を保存", exact: true });
const dlg = (p: Page) => p.getByRole("dialog", { name: "検索条件を保存", exact: true });
const nameBox = (p: Page) => dlg(p).getByRole("textbox", { name: "名前", exact: true });
const nav = (p: Page) => p.getByRole("list", { name: "営業の保存した検索条件", exact: true });
const item = (p: Page, name: string) => nav(p).getByRole("link", { name: new RegExp(`^${name}`) });
const menuBtn = (p: Page, name: string) => p.getByRole("button", { name: `${name}の操作`, exact: true });

/** 営業の一覧を開き、状態「完了以外」と担当者「鈴木」で絞っておく（K-478 の部品） */
async function openGroup(page: Page, width = 1440) {
  await open(page, GROUP_PATH, width);
  await expect(rowsOf(page)).toHaveCount(3);
  const box = page.getByRole("region", { name: "検索条件", exact: true });
  await box
    .getByRole("group", { name: "状態", exact: true })
    .getByRole("button", { name: "完了以外", exact: true })
    .click();
  await box.getByRole("combobox", { name: "担当者", exact: true }).selectOption({ label: "鈴木" });
  await expect(rowsOf(page)).toHaveCount(3);
}
async function setup(page: Page, views: SavedView[] = []) {
  const m = await mockMine(page);
  const saved = await mockSaved(page, views);
  return { m, saved };
}

// ---------------------------------------------------------------- 保存の小窓
test("K479-UI-001 小窓を開く：一覧（営業）で絞って「検索条件を保存」を押すと、題「検索条件を保存」・補足「いまの条件と見え方に名前をつけて、あとから 1 回で開く」の小窓。名前の欄（必須・60 字まで）に焦点があり、条件の要約が 担当者・状態・列 の順に並ぶ。保存の口はまだ 0 回", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page)).toContainText("いまの条件と見え方に名前をつけて、あとから 1 回で開く");
  await expect(nameBox(page)).toBeFocused();
  await expect(nameBox(page)).toHaveAttribute("maxlength", "60");
  await expect(nameBox(page)).toBeEmpty();
  await expect(dlg(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem")).toHaveText([
    "担当者：鈴木",
    "状態：完了でない",
    "列：9",
  ]);
  expect(saved.writes).toEqual([]);
});

test("K479-UI-002 見える人：グループの一覧では「自分だけ」（押した形）と「営業グループの全員」が選べる。グループを選んでいない自分に関わるものの「条件を保存」は押せない形（aria-disabled・薄さ 0.55・押しても小窓は開かず口を呼ばない）", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  const who = dlg(page).getByRole("group", { name: "見える人", exact: true });
  await expect(who.getByRole("button", { name: "自分だけ", exact: true })).toHaveAttribute("aria-pressed", "true");
  await who.getByRole("button", { name: "営業グループの全員", exact: true }).click();
  await expect(who.getByRole("button", { name: "営業グループの全員", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const mineSave = page
    .getByRole("group", { name: "自分に関わるものの絞り込み", exact: true })
    .getByRole("button", { name: "条件を保存", exact: true });
  await expect(mineSave).toHaveAttribute("aria-disabled", "true");
  await mineSave.click({ force: true });
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toEqual([]);
});

test("K479-UI-003 押せない物：「左のメニューに出す」「当てはまるチケットが増えたら知らせる」の 2 つのスイッチは aria-disabled・押しても入らず、口を呼ばない（作らない・D-151.9）", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  for (const name of ["左のメニューに出す", "当てはまるチケットが増えたら知らせる"]) {
    const sw = dlg(page).getByRole("switch", { name, exact: true });
    await expect(sw).toHaveAttribute("aria-disabled", "true");
    await sw.click({ force: true });
    await expect(sw).toHaveAttribute("aria-checked", "false");
  }
  expect(saved.writes).toEqual([]);
});

test("K479-UI-004 保存（自分だけ）：名前を入れて「保存する」を押すと、口に 1 回 { name, share: self, scope_id: 営業, filters: { v: 1, view: all, params: 今の絞り }, columns: 9 つ, density: normal } が飛び、小窓が閉じ、「「…」を保存しました」が出て、左のメニューの営業の下に並ぶ（外枠の答えを読み直して）", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await expect.poll(() => saved.reads).toBe(1);
  await saveBtn(page).click();
  await nameBox(page).fill("鈴木さん 今週の提案");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toHaveLength(1);
  const w = saved.writes[0]!;
  expect(w.method).toBe("POST");
  expect(w.body).toMatchObject({
    name: "鈴木さん 今週の提案",
    share: "self",
    scope_id: SALES,
    filters: { v: 1, view: "all", params: { done: "false", assignee_id: SUZUKI } },
    columns: ALL_COLUMNS,
    density: "normal",
  });
  await expect(page.getByText("「鈴木さん 今週の提案」を保存しました", { exact: true })).toBeVisible();
  await expect(item(page, "鈴木さん 今週の提案")).toBeVisible();
  await expect.poll(() => saved.reads).toBe(2);
});

test("K479-UI-005 保存（グループの全員）：「営業グループの全員」にして保存すると share: group・scope_id: 営業。左のメニューの項目に札「全員」が付く", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("営業の期限切れ");
  await dlg(page).getByRole("button", { name: "営業グループの全員", exact: true }).click();
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes[0]!.body).toMatchObject({ share: "group", scope_id: SALES });
  await expect(item(page, "営業の期限切れ")).toContainText("全員");
});

test("K479-UI-006 開き直す（再取得）：保存した後に再読み込みしても左のメニューに残り、押すと 一覧の URL に保存した絞り（view・scope・done・assignee_id）が付き、最初の口の問い合わせからその欄つきで読む。列と行の高さは保存した値が効き、開いた条件は aria-current=page", async ({
  page,
}) => {
  const v = view(1, {
    name: "鈴木さん 今週の提案",
    filters: { v: 1, view: "all", params: { done: "false", assignee_id: SUZUKI } },
    columns: ["kind", "number", "title", "due"],
    density: "compact",
  });
  const { m } = await setup(page, [v]);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await item(page, "鈴木さん 今週の提案").click();
  await expect(page).toHaveURL(new RegExp(`view=all`));
  await expect(page).toHaveURL(new RegExp(`scope=${SALES}`));
  await expect(page).toHaveURL(/done=false/);
  await expect(page).toHaveURL(new RegExp(`assignee_id=${SUZUKI}`));
  await expect(rowsOf(page)).toHaveCount(3);
  const q = queryOf(m.listCalls[m.listCalls.length - 1]!);
  expect(q).toMatchObject({ view: "all", scope_id: SALES, done: "false", assignee_id: SUZUKI });
  expect(await page.evaluate((k) => window.localStorage.getItem(k), COLUMNS_KEY)).toBe(
    JSON.stringify(["kind", "number", "title", "due"]),
  );
  await expect(page.getByRole("table", { name: "チケットの一覧" }).getByRole("columnheader")).toHaveText([
    "種別",
    "番号",
    "題名",
    "期限",
  ]);
  await expect(item(page, "鈴木さん 今週の提案")).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(item(page, "鈴木さん 今週の提案")).toHaveAttribute("aria-current", "page");
});

test("K479-UI-007 開いた条件の絞りを替えると、左のメニューの aria-current が外れる（絞りが保存した値と違えば今の条件ではない）", async ({
  page,
}) => {
  const v = view(1, { name: "完了以外", filters: { v: 1, view: "all", params: { done: "false" } } });
  await setup(page, [v]);
  await open(page, `${GROUP_PATH}&done=false`);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(item(page, "完了以外")).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("region", { name: "検索条件", exact: true })
    .getByRole("group", { name: "親子", exact: true })
    .getByRole("button", { name: "親だけ", exact: true })
    .click();
  await expect(item(page, "完了以外")).not.toHaveAttribute("aria-current", "page");
});

// ---------------------------------------------------------------- 保存の失敗（書いた中身は消えない）
test("K479-UI-008 名前が空：「保存する」を押しても口に 0 回で、名前の欄の下に「名前を入れてください」（aria-invalid）。小窓は開いたまま。空白だけ（全角も）も同じ", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByText(TEXT.noName, { exact: true })).toBeVisible();
  await expect(nameBox(page)).toHaveAttribute("aria-invalid", "true");
  await nameBox(page).fill("　 ");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByText(TEXT.noName, { exact: true })).toBeVisible();
  expect(saved.writes).toEqual([]);
  await expect(dlg(page)).toBeVisible();
});

test("K479-UI-009 名前は 60 字まで：70 字を入れても欄には 60 字までしか入らず、保存の体の name は 60 字", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("あ".repeat(70));
  await expect(nameBox(page)).toHaveValue("あ".repeat(60));
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(String(saved.writes[0]!.body?.["name"])).toHaveLength(60);
});

test("K479-UI-010 同じ名前（口が 409 E-VWS-005）：名前の欄の下に正本の文「同じ名前の保存した条件が、もうあります。別の名前にしてください」。入れた名前・見える人は残り、小窓は開いたまま。名前を変えて押し直すと保存できる", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("同じ名前");
  await dlg(page).getByRole("button", { name: "営業グループの全員", exact: true }).click();
  saved.next = () => fail(409, "E-VWS-005");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByText(TEXT.same, { exact: true })).toBeVisible();
  await expect(nameBox(page)).toHaveAttribute("aria-invalid", "true");
  await expect(nameBox(page)).toHaveValue("同じ名前");
  await expect(dlg(page).getByRole("button", { name: "営業グループの全員", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await nameBox(page).fill("別の名前");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toHaveLength(2);
});

test("K479-UI-011 保存できる数に達した（口が 409 E-VWS-006）・見せるグループが無い（404 E-VWS-004）：小窓の上の role=alert に正本の文。名前は残り小窓は開いたまま", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("多すぎる");
  saved.next = () => fail(409, "E-VWS-006");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByRole("alert")).toContainText(TEXT.full);
  await expect(nameBox(page)).toHaveValue("多すぎる");
  saved.next = () => fail(404, "E-VWS-004");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByRole("alert")).toContainText(TEXT.noScope);
  await expect(dlg(page)).toBeVisible();
});

test("K479-UI-012 口が落ちた（500）：小窓の上の role=alert に正本 E-PAGE-007 の文の 1 文目。入れた名前・見える人は残り、押し直すと保存できて小窓が閉じる", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("落ちた後に通る");
  saved.next = () => fail(500, "INTERNAL");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page).getByRole("alert")).toContainText(TEXT.loadFailed);
  await expect(nameBox(page)).toHaveValue("落ちた後に通る");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toHaveLength(2);
});

test("K479-UI-013 二度押し：答えを止めた間に「保存する」を押し、口に 1 回届いたのを待ってから、ボタンが押せない（busy）のを見てもう 1 回押す：口は 1 回だけ。答えを返すと小窓が閉じる", async ({
  page,
}) => {
  const { saved } = await setup(page);
  const hold = gate();
  await openGroup(page);
  await saveBtn(page).click();
  await nameBox(page).fill("二度押し");
  saved.next = async () => {
    await hold.wait;
    return undefined;
  };
  const save = dlg(page).getByRole("button", { name: "保存する", exact: true });
  await save.click();
  await expect.poll(() => saved.writes.length).toBe(1);
  await expect(save).toBeDisabled();
  await save.click({ force: true });
  expect(saved.writes).toHaveLength(1);
  hold.open();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toHaveLength(1);
});

test("K479-UI-014 キーボード：Esc で小窓を閉じ、焦点は「検索条件を保存」に戻り、口は 0 回。名前の欄で Enter を押すと保存できる。「やめる」でも閉じて口は 0 回", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await openGroup(page);
  await saveBtn(page).click();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(saveBtn(page)).toBeFocused();
  await saveBtn(page).click();
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toEqual([]);
  await saveBtn(page).click();
  await nameBox(page).fill("Enter で保存");
  await nameBox(page).press("Enter");
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toHaveLength(1);
});

// ---------------------------------------------------------------- 左のメニューの並び・直す・消す
test("K479-UI-015 左のメニューの並び：営業の下に営業の保存した条件が名前の順に並ぶ（全員向けは札「全員」）。ほかのグループの条件は営業の下に出ない。作った人（can_edit）の項目にだけ「…」があり、開く・直す・消すの口は 0 回", async ({
  page,
}) => {
  const { saved } = await setup(page, [
    view(1, { name: "鈴木さん 今週の提案", share: "group" }),
    view(2, { name: "期限が近い承認待ち" }),
    view(3, { name: "セイコー様まわり", share: "group", mine: false, can_edit: false, member_name: "鈴木" }),
    view(4, { name: "経理の条件", scope_id: ACCT }),
  ]);
  const writes = countWrites(page);
  await open(page, GROUP_PATH);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(nav(page).getByRole("listitem")).toHaveCount(3);
  await expect(item(page, "鈴木さん 今週の提案")).toContainText("全員");
  await expect(item(page, "期限が近い承認待ち")).not.toContainText("全員");
  await expect(item(page, "経理の条件")).toHaveCount(0);
  await expect(menuBtn(page, "鈴木さん 今週の提案")).toBeVisible();
  await expect(menuBtn(page, "セイコー様まわり")).toHaveCount(0);
  expect(writes.n).toBe(0);
  expect(saved.writes).toEqual([]);
  // グループの行は外枠が描く 1 つだけ（並びは行を描き足さない）。経理の下には経理の条件が並ぶ
  await expect(page.locator('nav[aria-label="メニュー"] [data-group="営業"]')).toHaveCount(1);
  await expect(
    page.getByRole("list", { name: "経理の保存した検索条件", exact: true }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("K479-UI-016 名前を直す：「…」→「名前を直す」→ 今の名前が入った小窓 → 変えて「直す」で、口に PATCH（体は name だけ）が 1 回・左のメニューの字が替わる。同じ名前（409 E-VWS-005）は欄の下に正本の文で、小窓は開いたまま", async ({
  page,
}) => {
  const { saved } = await setup(page, [view(1, { name: "元の名前" })]);
  await open(page, GROUP_PATH);
  await expect(rowsOf(page)).toHaveCount(3);
  await menuBtn(page, "元の名前").click();
  await page.getByRole("menuitem", { name: "名前を直す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "名前を直す", exact: true });
  await expect(d.getByRole("textbox", { name: "名前", exact: true })).toHaveValue("元の名前");
  saved.next = () => fail(409, "E-VWS-005");
  await d.getByRole("textbox", { name: "名前", exact: true }).fill("ぶつかる名前");
  await d.getByRole("button", { name: "直す", exact: true }).click();
  await expect(d.getByText(TEXT.same, { exact: true })).toBeVisible();
  await d.getByRole("textbox", { name: "名前", exact: true }).fill("新しい名前");
  await d.getByRole("button", { name: "直す", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(saved.writes.map((w) => w.method)).toEqual(["PATCH", "PATCH"]);
  expect(saved.writes[1]!.body).toEqual({ name: "新しい名前" });
  await expect(item(page, "新しい名前")).toBeVisible();
  await expect(item(page, "元の名前")).toHaveCount(0);
});

test("K479-UI-017 消す：「…」→「消す」→ 確かめの小窓（題に条件の名前）で「消す」を押すと口に DELETE が 1 回・左のメニューから消える。「やめる」なら口は 0 回で残る。口が 404（もう無い）でも一覧から外れ、正本 E-PAGE-001 の文が出る", async ({
  page,
}) => {
  const { saved } = await setup(page, [view(1, { name: "消す条件" }), view(2, { name: "残す条件" })]);
  await open(page, GROUP_PATH);
  await expect(rowsOf(page)).toHaveCount(3);
  await menuBtn(page, "消す条件").click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const c = page.getByRole("alertdialog");
  await expect(c).toContainText("消す条件");
  await c.getByRole("button", { name: "やめる", exact: true }).click();
  expect(saved.writes).toEqual([]);
  await expect(item(page, "消す条件")).toBeVisible();
  await menuBtn(page, "消す条件").click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(item(page, "消す条件")).toHaveCount(0);
  expect(saved.writes.map((w) => w.method)).toEqual(["DELETE"]);
  await expect(item(page, "残す条件")).toBeVisible();
  saved.next = () => fail(404, "E-PAGE-001");
  await menuBtn(page, "残す条件").click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.getByText("見つかりませんでした。", { exact: false }).first()).toBeVisible();
  await expect(item(page, "残す条件")).toHaveCount(0);
});

test("K479-UI-018 開いている条件を消す：その条件を開いた画面で消すと、絞りは今のまま残る（URL は替えない）が、左のメニューの aria-current は無くなる。別のグループ・別の人の条件には、直す・消すの入口が出ない", async ({
  page,
}) => {
  const v = view(1, { name: "いま開いている", filters: { v: 1, view: "all", params: { done: "false" } } });
  await setup(page, [v]);
  await open(page, `${GROUP_PATH}&done=false`);
  await expect(rowsOf(page)).toHaveCount(3);
  await menuBtn(page, "いま開いている").click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(item(page, "いま開いている")).toHaveCount(0);
  await expect(page).toHaveURL(/done=false/);
});

test("K479-UI-022 保存した条件が外枠の答えに無い（鍵が無い古い口）・配列でない：左のメニューは今のまま（営業の行だけ・並びは出ない）で、エラーの箱も小窓も出ない。外枠のほかの物（グループ）は出て、一覧の画面は使え、「検索条件を保存」は押せる（読めないだけで、保存の小窓は開く）", async ({
  browser,
}) => {
  for (const shape of ["missing", "notarray"] as const) {
    const p = await browser.newPage();
    const { saved } = await setup(p, [view(1, { name: "読めない並び" })]);
    saved.shape = shape;
    await open(p, GROUP_PATH);
    await expect(rowsOf(p)).toHaveCount(3);
    await expect(p.locator('nav[aria-label="メニュー"] [data-group="営業"]')).toHaveCount(1);
    await expect(nav(p)).toHaveCount(0);
    await expect(p.getByRole("alert")).toHaveCount(0);
    await saveBtn(p).click();
    await expect(dlg(p)).toBeVisible();
    expect(saved.listReads).toBe(0);
    await p.close();
  }
});

test("K479-UI-023 中身が読めない保存（filters が決めた形でない）：左のメニューには並び、押すと絞りなしで一覧が開き（欄が URL にも口にも付かない）、「この条件の中身を読めませんでした。絞りなしで開いています」が出る。列と行の高さは触らない", async ({
  page,
}) => {
  const bad = view(1, {
    name: "壊れた条件",
    filters: { junk: true } as Record<string, unknown>,
    columns: ["kind", "number", "title"],
  });
  const { m } = await setup(page, [bad]);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await item(page, "壊れた条件").click();
  await expect(page).toHaveURL(new RegExp(`scope=${SALES}`));
  await expect(
    page.getByText("この条件の中身を読めませんでした。絞りなしで開いています", { exact: true }),
  ).toBeVisible();
  await expect(rowsOf(page)).toHaveCount(3);
  const q = queryOf(m.listCalls[m.listCalls.length - 1]!);
  expect(q["done"]).toBeUndefined();
  expect(q["assignee_id"]).toBeUndefined();
  expect(await page.evaluate((k) => window.localStorage.getItem(k), COLUMNS_KEY)).toBeNull();
});

// ---------------------------------------------------------------- 口の数・幅・書く口
test("K479-UI-019 口の数：保存した条件は外枠の口 getShell の答えから読むので、画面を開いたとき外枠の口は 1 回・保存した条件の口 listSavedViews は 0 回（口は増えない）・保存したあと外枠の答えを読み直して +1・開くだけでは書く口は 0・保存で書く口は 1。同じ問い合わせの二重は無い", async ({
  page,
}) => {
  const { saved, m } = await setup(page, [view(1, { name: "ひとつ目" })]);
  const writes = countWrites(page);
  await open(page, GROUP_PATH);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(item(page, "ひとつ目")).toBeVisible();
  expect(saved.reads).toBe(1);
  expect(saved.listReads).toBe(0);
  expect(writes.n).toBe(0);
  await saveBtn(page).click();
  await nameBox(page).fill("ふたつ目");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(item(page, "ふたつ目")).toBeVisible();
  expect(saved.reads).toBe(2);
  expect(saved.listReads).toBe(0);
  expect(writes.n).toBe(1);
  const keys = m.listCalls.map((q) => q.toString());
  expect(new Set(keys).size, "一覧の口を同じ問い合わせで二重に読んでいない").toBe(keys.length);
});

test("K479-UI-020 幅 320・375・768・1024・1440：小窓（保存・名前を直す・消す）を開いても横溢れ 0。小窓は画面の中（左の端 0 以上・右の端が幅以下・足のボタンが画面の高さの中）。長い名前（60 字）の項目は左のメニューを広げない", async ({
  page,
}) => {
  await setup(page, [view(1, { name: "あ".repeat(60) })]);
  for (const w of WIDTHS) {
    await openGroup(page, w);
    await saveBtn(page).click();
    await expect(dlg(page)).toBeVisible();
    const r = await dlg(page).evaluate((e) => {
      const b = e.getBoundingClientRect();
      return { l: b.left, r: b.right, vw: window.innerWidth, bottom: b.bottom, vh: window.innerHeight };
    });
    expect(r.l, `幅 ${w} 左`).toBeGreaterThanOrEqual(0);
    expect(r.r, `幅 ${w} 右`).toBeLessThanOrEqual(r.vw);
    expect(r.bottom, `幅 ${w} 下`).toBeLessThanOrEqual(r.vh);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await page.keyboard.press("Escape");
  }
});

test("K479-UI-024 グループを選んでいないすべての一覧（?view=all・scope なし）の「検索条件を保存」も押せない形：aria-disabled・押しても小窓は開かず口を呼ばない（保存先のグループが決まらない）", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  const b = saveBtn(page);
  await expect(b).toHaveAttribute("aria-disabled", "true");
  expect(await b.getAttribute("title")).toContain("グループの一覧で保存できます");
  await b.click({ force: true });
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes).toEqual([]);
});

test("K479-UI-025 状態の札が段の絞り（stage_id）のとき：小窓を開いたときに段の口を 1 回だけ読み、条件の札は「状態：{段の名前}」になる（開く前・小窓を開き直しても段の口は 1 回のまま）。保存の体の params には stage_id が入る", async ({
  page,
}) => {
  const { m, saved } = await setup(page);
  await open(page, `${GROUP_PATH}&stage_id=${STAGE_DOING}`);
  await expect(rowsOf(page)).toHaveCount(3);
  expect(m.reads.stages).toBe(0);
  await saveBtn(page).click();
  await expect(dlg(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem")).toContainText([
    "状態：作業中",
    "列：9",
  ]);
  expect(m.reads.stages).toBe(1);
  await page.keyboard.press("Escape");
  await saveBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  expect(m.reads.stages).toBe(1);
  await nameBox(page).fill("作業中の物");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes[0]!.body).toMatchObject({ filters: { v: 1, view: "all", params: { stage_id: STAGE_DOING } } });
});

test("K479-UI-026 URL から開いた絞りも保存の体に入る：札や選びの部品に無い条件（assignee_id が鈴木・done=true・期限の範囲など、URL に付いたままの欄）を付けて開いて保存すると、体の filters.params に URL の欄がそのまま入る（今の絞りの全部＝K-478 の欄の名前の集まりのうち URL に付いている物。部品に出ない欄を黙って捨てない）", async ({
  page,
}) => {
  const { saved } = await setup(page);
  await open(page, `${GROUP_PATH}&assignee_id=${SUZUKI}&done=true&due_from=2026-11-02&due_to=2026-11-08`);
  await expect(rowsOf(page)).toHaveCount(3);
  await saveBtn(page).click();
  await expect(dlg(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem")).toContainText([
    "担当者：鈴木",
  ]);
  await nameBox(page).fill("URL から開いた絞り");
  await dlg(page).getByRole("button", { name: "保存する", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(saved.writes[0]!.body).toMatchObject({
    filters: {
      v: 1,
      view: "all",
      params: { assignee_id: SUZUKI, done: "true", due_from: "2026-11-02", due_to: "2026-11-08" },
    },
  });
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f7）
const CTRL = [
  "width",
  "height",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "border-top-left-radius",
];
const pair = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const DIALOG_PAIRS = [
  pair("dialog", '[role="dialog"]', ["width", "background-color", "border-top-left-radius"]),
  pair("name", '[role="dialog"] input[name="view-name"]', CTRL),
  pair("chips", '[role="dialog"] .k-f7-saved-chips', ["width"]),
  pair("chip", '[role="dialog"] .k-f7-saved-chip', CTRL),
  pair("seg", '[role="dialog"] .k-f7-saved-seg', ["width", "height"]),
  pair("seg-item", '[role="dialog"] .k-f7-saved-seg-item', CTRL),
  pair("switch", '[role="dialog"] .k-f7-saved-switch', ["width", "height", "opacity"]),
];
// 左のメニューの項目：モックは拡大した見本（本文の中）、本番は外枠の中なので、位置と幅は比べず、高さ・字・色・札だけ比べる
const NAV_PAIRS = [
  pair("nav-item", ".k-f7-saved-nav-item", [
    "height",
    "font-size",
    "color",
    "background-color",
    "border-top-left-radius",
  ]),
  pair("nav-share", ".k-f7-saved-nav-share", ["font-size", "color", "background-color"]),
  pair("nav-more", ".k-f7-saved-nav-more", ["width", "height", "color"]),
];

for (const w of MATCH_WIDTHS.filter((x) => x !== 768)) {
  test(`K479-UI-021 モックとの突き合わせ 幅 ${w}：f7-save-dialog・f7-save-error（小窓の箱・名前の欄・条件の札・見える人・スイッチ。欄の下の字は正本の文に替わるので比べない）・f7-saved-menu（1440 だけ：項目・札・「…」）の値が本番と同じ`, async ({
    browser,
  }) => {
    const bad: string[] = [];
    const run = async (
      id: string,
      pairs: ReturnType<typeof pair>[],
      drive: (p: Page) => Promise<void>,
      skip: string[] = [],
    ) => {
      const r = await matchMock(browser, id, w, drive, { pairs, base: "/dev/mock/f7", skip });
      bad.push(...r.bad);
    };
    const openDialog = async (p: Page, notice: boolean) => {
      const { saved } = await setup(p);
      await openGroup(p, w);
      await saveBtn(p).click();
      await nameBox(p).fill("鈴木さん 今週の提案");
      if (notice) {
        saved.next = () => fail(500, "INTERNAL");
        await dlg(p).getByRole("button", { name: "保存する", exact: true }).click();
        await expect(dlg(p).getByRole("alert")).toBeVisible();
      }
    };
    await run("f7-save-dialog", DIALOG_PAIRS, (p) => openDialog(p, false), ["chip:texts", "chips:texts"]);
    await run("f7-save-error", DIALOG_PAIRS, (p) => openDialog(p, true), ["chip:texts", "chips:texts"]);
    // 左のメニューの項目：375 は左のメニューが開く窓の中なので、1440 だけ比べる（375 の並びは K479-UI-020 が幅と溢れを見る）
    // モックの見本は 1 つ目が「いま開いている」（aria-current）・全員向けが 2 つ・「…」が 2 つ。本番も 1 つ目の条件の URL で開いて同じ形にする
    if (w === 1440)
      await run("f7-saved-menu", NAV_PAIRS, async (p) => {
        await setup(p, [
          view(1, {
            name: "鈴木さん 今週の提案",
            share: "group",
            filters: { v: 1, view: "all", params: { done: "false", assignee_id: SUZUKI } },
          }),
          view(2, { name: "期限が近い承認待ち" }),
          view(3, { name: "セイコー様まわり", share: "group", mine: false, can_edit: false }),
        ]);
        await open(p, `${GROUP_PATH}&done=false&assignee_id=${SUZUKI}`, w);
        await expect(rowsOf(p)).toHaveCount(3);
        await expect(nav(p).getByRole("listitem")).toHaveCount(3);
        await expect(item(p, "鈴木さん 今週の提案")).toHaveAttribute("aria-current", "page");
      });
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
