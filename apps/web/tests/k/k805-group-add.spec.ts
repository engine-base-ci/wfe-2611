// K-805「グループを足す小窓（＋ グループ）を口につなぐ：名前・短い名前・層・マネージャー・メンバー・色／層を足す／入力と口の誤り」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の gr-add・gr-add-error・gr-layer-add（本番と同じ部品 features/F10/members/group-dialogs.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。並び（getWorkspaceMembers）・層の一覧（listLayers・K-803 が足す）・グループを足す（createScope・K-802）・層を足す（createLayer・K-803）だけを
//   網の手前で差し替える（f10-kit.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { F10_PAIRS, ID, MOCK_BASE, WS_NAME, err, mockApi, ok, openAt, overflowX, toast, type Api } from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/members";
const L = {
  sales: "0193c5a0-0000-7000-8000-00000000c001",
  dev: "0193c5a0-0000-7000-8000-00000000c002",
  acc: "0193c5a0-0000-7000-8000-00000000c003",
};
const NEW_G = "0193c5a0-0000-7000-8000-00000000e004";
const NEW_L = "0193c5a0-0000-7000-8000-00000000c004";
const layer = (id: string, label: string, n: number) => ({
  id,
  key: `l_${n}0000000`,
  label,
  order_no: n,
  group_count: 1,
  created_at: "2026-04-01T00:00:00Z",
});
const LAYERS = [layer(L.sales, "営業", 1), layer(L.dev, "受託開発", 2), layer(L.acc, "経理", 3)];
const scopeBody = (name: string, prefix: string, color: string, layerId: string | null) => ({
  id: NEW_G,
  name,
  ticket_prefix: prefix,
  color,
  parent_id: ID.EG,
  layer: layerId ? { id: layerId, label: "営業" } : null,
  position: 4,
  managers: [{ id: ID.sato, name: "佐藤 花子" }],
  member_count: 3,
  created_at: "2026-11-23T09:00:00Z",
});
const TEAL = "teal";

const dlg = (page: Page) => page.getByRole("dialog", { name: "グループを足す", exact: true });
const addBtn = (page: Page) => page.getByRole("button", { name: "＋ グループ", exact: true });
const nameF = (page: Page) => dlg(page).locator('input[name="group-name"]');
const codeF = (page: Page) => dlg(page).locator('input[name="group-code"]');
const newLayerF = (page: Page) => dlg(page).locator('input[name="group-new-layer"]');
// 層・マネージャーの ▾ は部品 components/k の Select（Base UI）。素の <select> は無く、選び肢は ▾ を押して開く portal の role=option
const layerSel = (page: Page) => dlg(page).getByRole("combobox", { name: "層", exact: true });
const mgrSel = (page: Page) => dlg(page).getByRole("combobox", { name: "マネージャー", exact: true });
const options = (page: Page) => page.getByRole("option");
async function choose(page: Page, sel: (p: Page) => Locator, label: string): Promise<void> {
  await sel(page).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
/** ▾ を開いて選び肢を見る（見終えたら closeSel で閉じる） */
async function openSel(page: Page, sel: (p: Page) => Locator): Promise<void> {
  await sel(page).click();
}
const closeSel = (page: Page) => page.keyboard.press("Escape");
const search = (page: Page) => dlg(page).locator("#grp-member-search");
const submit = (page: Page) => dlg(page).getByRole("button", { name: "足す", exact: true });
const notice = (page: Page) => dlg(page).getByRole("alert");

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
async function openList(page: Page, width = 1440): Promise<Api> {
  const mk = await mockApi(page);
  mk.set("layers", () => ok(LAYERS));
  mk.set("createScope", (c) =>
    ok(scopeBody(String(c.body!["name"]), String(c.body!["ticket_prefix"]), TEAL, L.sales), 201),
  );
  mk.set("createLayer", (c) => ok({ ...layer(NEW_L, String(c.body!["label"]), 4), group_count: 0 }, 201));
  await openAt(page, owner.token, PATH, width);
  await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  return mk;
}
async function fill(page: Page, name: string, code: string): Promise<void> {
  await nameF(page).fill(name);
  await codeF(page).fill(code);
}
async function open(page: Page): Promise<void> {
  await addBtn(page).click();
  await expect(dlg(page)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page, mk: Api) => Promise<void>> = {
  "gr-add": async (page) => {
    await open(page);
    await fill(page, "カスタマーサポート", "cs");
    await choose(page, layerSel, "営業");
    await choose(page, mgrSel, "佐藤 花子");
    for (const n of ["鈴木 一郎", "田中 美咲"]) {
      await search(page).fill(n);
      await search(page).press("Enter");
    }
  },
  "gr-add-error": async (page, mk) => {
    // 先に 409（短い名前がもう使われている）を受け、名前を消して押す：口の誤りの字はその欄を直すまで残るので、誤りの字が 2 つ
    mk.queue("createScope", err(409, "E-GRP-010"));
    await open(page);
    await fill(page, "営業企画", "EG");
    await submit(page).click();
    await expect(dlg(page).locator(".k-err")).toHaveCount(1);
    await nameF(page).fill("");
    await submit(page).click();
    await expect(dlg(page).locator(".k-err")).toHaveCount(2);
    expect(mk.count("createScope")).toBe(1);
  },
  "gr-layer-add": async (page) => {
    await open(page);
    await fill(page, "カスタマーサポート", "cs");
    await choose(page, layerSel, "＋ 層を足す");
    await newLayerF(page).fill("カスタマー");
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K805-UI-001 ${id} 幅 ${w}：小窓の題・欄・札・色・誤りの字と位置と大きさがモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await openList(page, w);
          // モック（gr-*）の後ろの並びは 3 つのグループとも開いた形。初めは営業だけが開く（K-710）ので、比べる前に受託開発・経理を開く
          for (const g of ["受託開発", "経理"]) {
            const t = page.getByRole("region", { name: g, exact: true }).locator(".k-f10m-toggle");
            await t.click();
            await expect(t).toHaveAttribute("aria-expanded", "true");
          }
          await drive(page, mk);
        },
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く
test("K805-UI-002 「＋ グループ」で小窓が開く：名前に焦点・層の ▾ は 営業・受託開発・経理 と「＋ 層を足す」・マネージャーはメンバーの 4 人（兼ねる人は 1 度だけ）・色 6 つ（既定は青緑）。層の一覧 listLayers 1 回・並びの読み込みは増えない", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await expect(nameF(page)).toBeFocused();
  await openSel(page, layerSel);
  await expect(options(page)).toContainText(["営業", "受託開発", "経理", "＋ 層を足す"]);
  await closeSel(page);
  await openSel(page, mgrSel);
  await expect(options(page)).toContainText(["佐藤 花子", "高本 聖斗", "鈴木 一郎", "田中 美咲"]);
  await expect(options(page)).toHaveCount(4);
  await closeSel(page);
  await expect(dlg(page).getByRole("radio")).toHaveCount(6);
  await expect(dlg(page).getByRole("radio", { name: "青緑", exact: true })).toBeChecked();
  expect(mk.count("layers")).toBe(1);
  expect(mk.count("members")).toBe(1);
});

// ---------------------------------------------------------------- 入力
test("K805-UI-003 入力の誤り：名前が空・空白だけ →「名前を入れてください」／短い名前が空・数字から・9 字・T 1 字 →「短い名前は、英字で始まる 1〜8 字で入れてください（T だけは使えません）」（仮）。口は呼ばない・小窓は閉じない・欄の下に赤字（aria-invalid）", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "  ", "CS");
  await submit(page).click();
  await expect(dlg(page)).toContainText("名前を入れてください");
  await expect(nameF(page)).toHaveAttribute("aria-invalid", "true");
  for (const bad of ["", "1ab", "abcdefghi", "T", "c s"]) {
    await fill(page, "営業企画", bad);
    await submit(page).click();
    await expect(dlg(page)).toContainText("短い名前は、英字で始まる 1〜8 字で入れてください");
    await expect(codeF(page)).toHaveAttribute("aria-invalid", "true");
  }
  expect(mk.count("createScope")).toBe(0);
  await expect(dlg(page)).toBeVisible();
});

test("K805-UI-004 表記ゆらぎ：短い名前に全角「ｃｓ」・前後の空白「 cs 」・小文字を入れても、番号の見本は「CS-1、CS-2 …」・送る ticket_prefix は「CS」。名前の前後の空白は削って送る", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await nameF(page).fill("  カスタマーサポート　");
  await codeF(page).fill("ｃｓ");
  await expect(dlg(page)).toContainText("CS-1、CS-2 …");
  await codeF(page).fill(" cs ");
  await expect(dlg(page)).toContainText("CS-1、CS-2 …");
  await submit(page).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.last("createScope")!.body).toMatchObject({ name: "カスタマーサポート", ticket_prefix: "CS" });
});

test("K805-UI-005 足す（ふつうの形）：体は { name, ticket_prefix: CS, layer_id: 営業の層, manager_member_ids: [佐藤], member_ids: [鈴木, 田中], color: teal }（上のグループ parent_id は送らない）・小窓が閉じ・知らせ「「カスタマーサポート」を足しました」・並びを読み直す（口 2 回）", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "カスタマーサポート", "cs");
  await choose(page, layerSel, "営業");
  await choose(page, mgrSel, "佐藤 花子");
  for (const n of ["鈴木 一郎", "田中 美咲"]) {
    await search(page).fill(n);
    await search(page).press("Enter");
  }
  await submit(page).click();
  await expect(toast(page)).toContainText("「カスタマーサポート」を足しました");
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.of("createScope")).toHaveLength(1);
  expect(mk.last("createScope")!.body).toEqual({
    name: "カスタマーサポート",
    ticket_prefix: "CS",
    layer_id: L.sales,
    manager_member_ids: [ID.sato],
    member_ids: [ID.suzuki, ID.tanaka],
    color: TEAL,
  });
  expect(mk.count("members")).toBe(2);
});

test("K805-UI-006 メンバーの札：名前で探して Enter か候補で足す・同じ人は 1 度だけ・「× 」で外す・探した字に当たる人が無ければ候補は出ない・入っている人（招待中の人）は候補に出ない", async ({
  page,
}) => {
  await openList(page);
  await open(page);
  await search(page).fill("鈴木");
  await search(page).press("Enter");
  await search(page).fill("鈴木");
  await search(page).press("Enter");
  await expect(dlg(page).locator(".k-inv-chip")).toHaveCount(1);
  await search(page).fill("存在しない人");
  await expect(dlg(page).getByRole("option")).toHaveCount(0);
  await search(page).fill("kimura");
  await expect(dlg(page).getByRole("option")).toHaveCount(0);
  await dlg(page).getByRole("button", { name: "鈴木 一郎 を外す", exact: true }).click();
  await expect(dlg(page).locator(".k-inv-chip")).toHaveCount(0);
});

test("K805-UI-007 兼務（D-154.15）：2 つのグループに入っている佐藤を新しいグループのマネージャーに、別の部署に入っている田中をメンバーに足せる。候補に同じ人が 2 度出ない（佐藤・田中は 1 人ずつ）・送る id は人の id", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await openSel(page, mgrSel);
  await expect(page.getByRole("option", { name: "佐藤 花子", exact: true })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "田中 美咲", exact: true })).toHaveCount(1);
  await closeSel(page);
  await fill(page, "経営企画", "bp");
  await choose(page, mgrSel, "佐藤 花子");
  await search(page).fill("田中");
  await search(page).press("Enter");
  await submit(page).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.last("createScope")!.body).toMatchObject({ manager_member_ids: [ID.sato], member_ids: [ID.tanaka] });
});

test("K805-UI-008 色：6 つの色（青緑・赤紫・藍・黄土・朱・若草）を選ぶと体の color が tone の鍵（teal・plum・indigo・amber・coral・sage）のどれかになる", async ({
  page,
}) => {
  const mk = await openList(page);
  const want: [string, string][] = [
    ["青緑", "teal"],
    ["赤紫", "plum"],
    ["藍", "indigo"],
    ["黄土", "amber"],
    ["朱", "coral"],
    ["若草", "sage"],
  ];
  for (const [label, tone] of want) {
    await open(page);
    await fill(page, "色の確かめ", "cc");
    await dlg(page).getByRole("radio", { name: label, exact: true }).click();
    await expect(dlg(page).getByRole("radio", { name: label, exact: true })).toBeChecked();
    await submit(page).click();
    await expect(dlg(page)).toHaveCount(0);
    expect(mk.last("createScope")!.body).toMatchObject({ color: tone });
  }
  expect(mk.count("createScope")).toBe(6);
});

// ---------------------------------------------------------------- 層を足す
test("K805-UI-009 層を足す：層の ▾ で「＋ 層を足す」を選ぶと「新しい層の名前」の欄。足すと createLayer { label: カスタマー } を 1 回 → その id で createScope の layer_id を送る（口の順：createLayer → createScope）。成功の知らせと読み直し", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "カスタマーサポート", "cs");
  await choose(page, layerSel, "＋ 層を足す");
  await newLayerF(page).fill("  カスタマー ");
  await submit(page).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.of("createLayer").map((c) => c.body)).toEqual([{ label: "カスタマー" }]);
  expect(mk.last("createScope")!.body).toMatchObject({ layer_id: NEW_L });
  expect(mk.calls.map((c) => c.op).filter((o) => o === "createLayer" || o === "createScope")).toEqual([
    "createLayer",
    "createScope",
  ]);
});

test("K805-UI-010 層の誤り：新しい層の名前が空 →「名前を入れてください」で口 0 回。409 E-GRP-013（層は 8 つまで）・409 E-GRP-019（同じ名前の層がある）は新しい層の欄の下に正本の文を出し、createScope は呼ばない・小窓は閉じない", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "カスタマーサポート", "cs");
  await choose(page, layerSel, "＋ 層を足す");
  await submit(page).click();
  await expect(dlg(page)).toContainText("名前を入れてください");
  expect(mk.count("createLayer")).toBe(0);
  await newLayerF(page).fill("カスタマー");
  mk.queue("createLayer", err(409, "E-GRP-013"), err(409, "E-GRP-019"));
  await submit(page).click();
  await expect(dlg(page).locator(".k-err")).toHaveCount(1);
  await submit(page).click();
  await expect(dlg(page).locator(".k-err")).toHaveCount(1);
  expect(mk.count("createLayer")).toBe(2);
  expect(mk.count("createScope")).toBe(0);
  await expect(dlg(page)).toBeVisible();
});

test("K805-UI-011 層は足せたがグループが足せなかった（createScope 503）：上の赤い箱・中身は残る。押し直すと createLayer は呼ばず（2 つ目の層を作らない）、足せた層の id で createScope だけを送り直す", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("createScope", err(503, "E-PAGE-003"));
  await open(page);
  await fill(page, "カスタマーサポート", "cs");
  await choose(page, layerSel, "＋ 層を足す");
  await newLayerF(page).fill("カスタマー");
  await submit(page).click();
  await expect(notice(page)).toBeVisible();
  await submit(page).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.count("createLayer")).toBe(1);
  expect(mk.of("createScope").map((c) => c.body!["layer_id"])).toEqual([NEW_L, NEW_L]);
});

// ---------------------------------------------------------------- 口の断り
test("K805-UI-012 短い名前がもう使われている（409 E-GRP-010）：短い名前の欄の下に「この短い名前は、もう使われています」・名前・層・色・メンバーは残る。名前を消して押すと「名前を入れてください」が出て、短い名前の字も残る（誤りの字が 2 つ・口は呼ばない）。名前を戻し短い名前を直すと短い名前の字が消え、押し直すと足せる（口 2 回）", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("createScope", err(409, "E-GRP-010"));
  await open(page);
  await fill(page, "営業企画", "EG");
  await search(page).fill("鈴木");
  await search(page).press("Enter");
  await submit(page).click();
  await expect(dlg(page).locator(".k-err")).toContainText("この短い名前は、もう使われています");
  await expect(codeF(page)).toHaveAttribute("aria-invalid", "true");
  await expect(nameF(page)).toHaveValue("営業企画");
  await expect(dlg(page).locator(".k-inv-chip")).toHaveCount(1);
  await nameF(page).fill("");
  await submit(page).click();
  await expect(dlg(page).locator(".k-err")).toHaveCount(2);
  await expect(dlg(page).locator(".k-err")).toContainText([
    "名前を入れてください",
    "この短い名前は、もう使われています",
  ]);
  expect(mk.count("createScope")).toBe(1);
  await nameF(page).fill("営業企画");
  await codeF(page).fill("EGP");
  await expect(dlg(page).locator(".k-err")).toHaveCount(0);
  await submit(page).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.count("createScope")).toBe(2);
});

test("K805-UI-013 名前がもう使われている（409 E-GRP-011）→ 名前の欄の下／グループが 200 に届いた（409 E-GRP-012）→ 上の赤い箱に正本の文（上限）。どちらも小窓は閉じず、中身は残る", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "営業", "AB");
  mk.queue("createScope", err(409, "E-GRP-011"), err(409, "E-GRP-012"));
  await submit(page).click();
  await expect(nameF(page)).toHaveAttribute("aria-invalid", "true");
  await submit(page).click();
  await expect(notice(page)).toBeVisible();
  await expect(nameF(page)).toHaveValue("営業");
  expect(mk.count("createScope")).toBe(2);
});

test("K805-UI-014 指した物が無い（404 E-GRP-014 層／E-GRP-015 人／E-GRP-020）・人が選べない（409 E-GRP-016 止めた人・E-GRP-017 閲覧のみ）・権限（403）：上の赤い箱に正本の文（人の名前は答えの detail から）・層と並びを読み直す・小窓は閉じない", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "営業企画", "EP");
  mk.queue(
    "createScope",
    err(404, "E-GRP-014"),
    err(404, "E-GRP-015"),
    err(409, "E-GRP-016", { detail: { 名前: "山口 健", 訳: "止まっている" } }),
    err(409, "E-GRP-017", { detail: { 名前: "山口 健" } }),
    err(403, "FORBIDDEN"),
  );
  for (let i = 0; i < 5; i++) {
    await submit(page).click();
    await expect(notice(page)).toBeVisible();
    await expect.poll(() => mk.count("createScope")).toBe(i + 1);
  }
  await expect(notice(page)).toBeVisible();
  expect(mk.count("layers")).toBeGreaterThanOrEqual(2);
  await expect(dlg(page)).toBeVisible();
});

test("K805-UI-015 口が 503：上の赤い箱・小窓は閉じず中身は残る・グループは増えない（並びの行は 3 つのまま）・押し直すと足せる", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("createScope", err(503, "E-PAGE-003"));
  await open(page);
  await fill(page, "営業企画", "EP");
  await submit(page).click();
  await expect(notice(page)).toBeVisible();
  await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  await expect(nameF(page)).toHaveValue("営業企画");
  await submit(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("createScope")).toBe(2);
});

test("K805-UI-016 二度押し：答えを待つ間「足す」は押せない（disabled）・口は 1 回", async ({ page }) => {
  const mk = await openList(page);
  const release = mk.hold("createScope");
  await open(page);
  await fill(page, "営業企画", "EP");
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await submit(page).click({ force: true });
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("createScope")).toBe(1);
});

test("K805-UI-017 やめる・Esc・外側：口 0 回・焦点は「＋ グループ」に戻る・開き直すと空（名前・短い名前・メンバー・新しい層の欄）", async ({
  page,
}) => {
  const mk = await openList(page);
  await open(page);
  await fill(page, "書きかけ", "KK");
  await choose(page, layerSel, "＋ 層を足す");
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(addBtn(page)).toBeFocused();
  await open(page);
  await expect(nameF(page)).toHaveValue("");
  await expect(codeF(page)).toHaveValue("");
  await expect(newLayerF(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op.startsWith("create"))).toEqual([]);
});

test("K805-UI-018 層の一覧が読めない（listLayers 503）：小窓は開くが層の ▾ は「＋ 層を足す」だけ・上の赤い箱・足そうとしても層の欄は新しい層になる。読めれば出る（読み直しは小窓を開くたび）", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("layers", err(503, "E-PAGE-003"));
  await open(page);
  await expect(notice(page)).toBeVisible();
  await openSel(page, layerSel);
  // 選んでいる行には部品が「✓」を描き、toHaveText は字に含めるので末尾で比べる（components/k/select.tsx の ItemIndicator）
  await expect(options(page)).toHaveText([/＋ 層を足す$/]);
  await closeSel(page);
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await open(page);
  await openSel(page, layerSel);
  await expect(options(page)).toContainText(["営業", "受託開発", "経理"]);
  await closeSel(page);
  expect(mk.count("layers")).toBe(2);
});

test("K805-UI-019 幅 320・375・768・1024・1440：横のはみ出し 0（数値）・小窓を開いても 0・新しい層の欄と誤りの赤字が出ても 0", async ({
  page,
}) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    const mk = await mockApi(page);
    mk.set("layers", () => ok(LAYERS));
    await openAt(page, owner.token, PATH, w);
    await expect(page.locator(".k-f10m-group")).toHaveCount(3);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    await open(page);
    await choose(page, layerSel, "＋ 層を足す");
    await submit(page).click();
    await expect(dlg(page).locator(".k-err").first()).toBeVisible();
    expect(await overflowX(page), `小窓 幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K805-UI-020 キーボード：「＋ グループ」から Enter で開き名前に焦点・20 回 Tab しても小窓の外に出ない・Esc で閉じて焦点が戻る", async ({
  page,
}) => {
  await openList(page);
  await addBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(nameF(page)).toBeFocused();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest(".k-dialog"));
    expect(inside, `Tab ${i + 1} 回目`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(addBtn(page)).toBeFocused();
});
