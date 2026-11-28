// K-806「グループを直す・並びを替える・層の名前と並びを直す小窓を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の gr-edit・gr-order・gr-layers（本番と同じ部品 features/F10/members/group-dialogs.tsx・代表 OK 2026-11-22）。
//   入口（各グループの見出しの右の「直す」・頭の「＋ グループ」の隣の「並びを替える」・グループを足す小窓の層 ▾ の中の「層の名前と並びを直す」）は D-154.53 の置き場で、下絵にも在る。
//   色は画面のトークンの tone の鍵（teal・plum・indigo・amber・coral・sage）で送り・読む（K-802）。
//   ログイン・外枠・役は本物。並び（getWorkspaceMembers）・グループと層の一覧（listScopes・listLayers）・グループを直す（updateScope・K-804）・層を直す（updateLayer・K-803）だけを
//   網の手前で差し替える（f10-kit.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import {
  F10_PAIRS,
  ID,
  MOCK_BASE,
  WS_NAME,
  err,
  membersBody,
  mockApi,
  ok,
  openAt,
  overflowX,
  toast,
  type Api,
} from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function pick(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const PATH = "/members";
const LY = {
  sales: "0193c5a0-0000-7000-8000-00000000c001",
  dev: "0193c5a0-0000-7000-8000-00000000c002",
  acc: "0193c5a0-0000-7000-8000-00000000c003",
};
const TEAL = "teal";
const PLUM = "plum";
const AMBER = "amber";
interface Sc {
  id: string;
  name: string;
  ticket_prefix: string | null;
  color: string;
  parent_id: string | null;
  layer: { id: string; label: string } | null;
  position: number;
  managers: { id: string; name: string }[];
  member_count: number;
  created_at: string;
}
const sc = (
  id: string,
  name: string,
  prefix: string,
  color: string,
  ly: string,
  label: string,
  pos: number,
  mg: Sc["managers"],
  n: number,
): Sc => ({
  id,
  name,
  ticket_prefix: prefix,
  color,
  parent_id: null,
  layer: { id: ly, label },
  position: pos,
  managers: mg,
  member_count: n,
  created_at: "2026-04-01T00:00:00Z",
});
// 会社のいちばん上のグループ（上が空の最初の 1 つ・短い名前と層は無い）。画面から足すグループは全部この下に入る（D-154.31）。
//   listScopes は上のグループが先（depth の順）なので先頭に来る。並びの小窓に出すのはこの子だけで、これ自体は出さない（PM の決め・K806-UI-020）
const ROOT = "0193c5a0-0000-7000-8000-00000000c001";
const root = (): Sc => ({
  ...sc(ROOT, WS_NAME, "", "slate", "", "", 1, [], 0),
  ticket_prefix: null,
  layer: null,
});
const child = (s: Sc): Sc => ({ ...s, parent_id: ROOT });
/** listScopes の並び：上のグループが先（depth の順）・同じ深さの中は position の順（K-804） */
const depthOf = (all: Sc[], s: Sc): number => {
  const up = s.parent_id ? all.find((x) => x.id === s.parent_id) : undefined;
  return up ? depthOf(all, up) + 1 : 0;
};
const listed = (all: Sc[]): Sc[] =>
  [...all].sort((a, b) => depthOf(all, a) - depthOf(all, b) || a.position - b.position);
const SATO = { id: ID.sato, name: "佐藤 花子" };
const TANAKA = { id: ID.tanaka, name: "田中 美咲" };
const layerRow = (id: string, label: string, n: number, g: number) => ({
  id,
  key: `l_${n}0000000`,
  label,
  order_no: n,
  group_count: g,
  created_at: "2026-04-01T00:00:00Z",
});

const dlgEdit = (page: Page) => page.getByRole("dialog", { name: "グループを直す", exact: true });
const dlgOrder = (page: Page) => page.getByRole("dialog", { name: "グループの並びを替える", exact: true });
const dlgLayers = (page: Page) => page.getByRole("dialog", { name: "層の名前と並びを直す", exact: true });
const dlgAdd = (page: Page) => page.getByRole("dialog", { name: "グループを足す", exact: true });
const editBtn = (page: Page, g: string) => page.getByRole("button", { name: `${g}を直す`, exact: true });
const orderBtn = (page: Page) => page.getByRole("button", { name: "並びを替える", exact: true });
const save = (d: ReturnType<typeof dlgEdit>) => d.getByRole("button", { name: "保存する", exact: true });
const notice = (d: ReturnType<typeof dlgEdit>) => d.getByRole("alert");

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
interface Live {
  scopes: Sc[];
  layers: ReturnType<typeof layerRow>[];
}
async function openList(page: Page, width = 1440): Promise<{ mk: Api; live: Live }> {
  const mk = await mockApi(page);
  const live: Live = {
    // 子の 3 つを先に置く（live.scopes[0] は営業）。会社のいちばん上は後ろに足し、listScopes の答えでは listed() で先頭に来る
    scopes: [
      child(sc(ID.EG, "営業", "EG", TEAL, LY.sales, "営業", 1, [SATO], 4)),
      child(sc(ID.JD, "受託開発", "JD", PLUM, LY.dev, "受託開発", 2, [SATO], 2)),
      child(sc(ID.KR, "経理", "KR", AMBER, LY.acc, "経理", 3, [TANAKA], 1)),
      root(),
    ],
    layers: [layerRow(LY.sales, "営業", 1, 1), layerRow(LY.dev, "受託開発", 2, 1), layerRow(LY.acc, "経理", 3, 1)],
  };
  mk.set("scopes", () => ok(listed(live.scopes)));
  // 並びの口（getWorkspaceMembers）もグループの位置の順で返す（本物の口と同じ。並びを保存したあとの読み直しが新しい順になる・K806-UI-010）
  const posOf = (id: string) => live.scopes.find((x) => x.id === id)?.position ?? 0;
  mk.set("members", () => ({
    status: 200,
    body: membersBody({ ...mk.w, groups: [...mk.w.groups].sort((a, z) => posOf(a.id) - posOf(z.id)) }),
  }));
  mk.set("layers", () => ok([...live.layers].sort((a, b) => a.order_no - b.order_no)));
  mk.set("updateScope", (c) => {
    const s = live.scopes.find((x) => x.id === c.id);
    if (!s) return err(404, "E-GRP-002");
    const b = c.body!;
    if (typeof b["name"] === "string") s.name = b["name"];
    if (typeof b["color"] === "string") s.color = b["color"];
    if (typeof b["position"] === "number") {
      // 口は同じ上のグループの兄弟を 1 から振り直す（K-804）
      const rest = live.scopes
        .filter((x) => x.id !== s.id && x.parent_id === s.parent_id)
        .sort((a, z) => a.position - z.position);
      rest.splice(b["position"] - 1, 0, s);
      rest.forEach((x, i) => (x.position = i + 1));
    }
    return ok(s);
  });
  mk.set("updateLayer", (c) => {
    const l = live.layers.find((x) => x.id === c.id)!;
    const b = c.body!;
    if (typeof b["label"] === "string") l.label = b["label"];
    if (typeof b["order_no"] === "number") {
      const rest = live.layers.filter((x) => x.id !== l.id).sort((a, z) => a.order_no - z.order_no);
      rest.splice(b["order_no"] - 1, 0, l);
      rest.forEach((x, i) => (x.order_no = i + 1));
    }
    return ok(l);
  });
  await openAt(page, owner.token, PATH, width);
  await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  return { mk, live };
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page) => Promise<void>> = {
  "gr-edit": async (page) => {
    await editBtn(page, "営業").click();
    await expect(dlgEdit(page)).toBeVisible();
  },
  "gr-order": async (page) => {
    await orderBtn(page).click();
    await expect(dlgOrder(page)).toBeVisible();
  },
  "gr-layers": async (page) => {
    await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
    await pick(page, dlgAdd(page).getByRole("combobox", { name: "層", exact: true }), "層の名前と並びを直す");
    await expect(dlgLayers(page)).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K806-UI-001 ${id} 幅 ${w}：小窓の題・欄・札・上へ下へ・注の字と位置と大きさがモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await openList(page, w);
          // モック（gr-*）の後ろの並びは 3 つのグループとも開いた形。初めは営業だけが開く（K-710）ので、比べる前に受託開発・経理を開く
          for (const g of ["受託開発", "経理"]) {
            const t = page.getByRole("region", { name: g, exact: true }).locator(".k-f10m-toggle");
            await t.click();
            await expect(t).toHaveAttribute("aria-expanded", "true");
          }
          // 開いた経理まで頁が流れている。下絵は頁の上のまま読むので、頁の上に戻してから押す（小窓の y を同じ所から読む）
          await page.evaluate(() => window.scrollTo(0, 0));
          await drive(page);
        },
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 入口・グループを直す
test("K806-UI-002 入口：各グループの見出しに「直す」・頭に「並びを替える」が押せる形で在る。「直す」で直す小窓が開く：名前「営業」・短い名前「EG」は押せず「作ったあとは変えられません」・層は「営業」で押せない・マネージャー「佐藤 花子」・色は青緑・「メンバー 4 人は、メンバーの画面で足す・外す」。グループと層の一覧は各 1 回", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  const d = dlgEdit(page);
  await expect(d.locator('input[name="group-name"]')).toHaveValue("営業");
  await expect(d.locator('input[name="group-code"]')).toHaveValue("EG");
  await expect(d.locator('input[name="group-code"]')).toBeDisabled();
  await expect(d).toContainText("作ったあとは変えられません");
  await expect(d.getByRole("combobox", { name: "層", exact: true })).toBeDisabled();
  await expect(d.getByRole("combobox", { name: "マネージャー", exact: true })).toContainText("佐藤 花子");
  await expect(d.getByRole("radio", { name: "青緑", exact: true })).toBeChecked();
  await expect(d).toContainText("メンバー 4 人は、メンバーの画面で足す・外す");
  expect(mk.count("scopes")).toBe(1);
  expect(mk.count("updateScope")).toBe(0);
});

test("K806-UI-003 直して保存：名前だけ直すと体は { name }（変えていない欄は送らない）・色と担当を直すと { color, manager_member_ids }。小窓が閉じ・知らせ「「営業企画」を直しました」・並びを読み直す（口 2 回）。変えていないとき「保存する」は押せない", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  const d = dlgEdit(page);
  await expect(save(d)).toBeDisabled();
  await d.locator('input[name="group-name"]').fill("営業企画");
  await save(d).click();
  await expect(toast(page)).toContainText("「営業企画」を直しました");
  await expect(d).toHaveCount(0);
  expect(mk.last("updateScope")!.id).toBe(ID.EG);
  expect(mk.last("updateScope")!.body).toEqual({ name: "営業企画" });
  expect(mk.count("members")).toBe(2);
  await editBtn(page, "受託開発").click();
  await d.getByRole("radio", { name: "朱", exact: true }).click();
  await pick(page, d.getByRole("combobox", { name: "マネージャー", exact: true }), "高本 聖斗");
  await save(d).click();
  await expect(d).toHaveCount(0);
  expect(mk.last("updateScope")!.body).toEqual({ color: "coral", manager_member_ids: [ID.takamoto] });
});

test("K806-UI-004 マネージャーが 2 人いるグループ：選ぶのは 1 人目だけ・2 人目は残して送る（manager_member_ids は 1 人目を新しい人に替え、2 人目はそのまま）・「ほか 1 人」の字が出る", async ({
  page,
}) => {
  const { mk, live } = await openList(page);
  live.scopes[0]!.managers = [SATO, TANAKA];
  await page.reload();
  await editBtn(page, "営業").click();
  await expect(dlgEdit(page)).toContainText("ほか 1 人");
  await pick(page, dlgEdit(page).getByRole("combobox", { name: "マネージャー", exact: true }), "鈴木 一郎");
  await save(dlgEdit(page)).click();
  await expect(dlgEdit(page)).toHaveCount(0);
  expect(mk.last("updateScope")!.body).toEqual({ manager_member_ids: [ID.suzuki, ID.tanaka] });
});

test("K806-UI-005 兼務（D-154.15）：2 つのグループのマネージャーを兼ねる佐藤を、経理のマネージャーに替えても、佐藤の営業・受託開発の行は変わらない（読み直したあとの並びで佐藤が 2 つのグループにマネージャーのまま）。別の部署に入っている田中をマネージャーにも選べる", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "経理").click();
  await pick(page, dlgEdit(page).getByRole("combobox", { name: "マネージャー", exact: true }), "佐藤 花子");
  await save(dlgEdit(page)).click();
  await expect(toast(page)).toBeVisible();
  expect(mk.last("updateScope")!.body).toEqual({ manager_member_ids: [ID.sato] });
  // グループは名前で 1 つに決める（hasText だと「受託開発も兼ねる」の行を持つ営業のカードにも当たる）。
  //   初めは自分の主のグループ（営業）だけが開く（K-710）ので、受託開発の行は見る前に開く
  const card = (g: string) => page.getByRole("region", { name: g, exact: true });
  const dev = card("受託開発").locator(".k-f10m-toggle");
  await dev.click();
  await expect(dev).toHaveAttribute("aria-expanded", "true");
  await expect(card("営業").locator(".k-f10m-row").filter({ hasText: "佐藤 花子" })).toContainText("マネージャー");
  await expect(card("受託開発").locator(".k-f10m-row").filter({ hasText: "佐藤 花子" })).toContainText("マネージャー");
});

test("K806-UI-006 名前が空・空白だけ：「名前を入れてください」・口 0 回。409 E-GRP-011（同じ名前）は名前の欄の下に正本の文・中身は残る", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  const d = dlgEdit(page);
  await d.locator('input[name="group-name"]').fill("  ");
  await save(d).click();
  await expect(d).toContainText("名前を入れてください");
  expect(mk.count("updateScope")).toBe(0);
  mk.queue("updateScope", err(409, "E-GRP-011"));
  await d.locator('input[name="group-name"]').fill("経理");
  await save(d).click();
  await expect(d.locator('input[name="group-name"]')).toHaveAttribute("aria-invalid", "true");
  await expect(d.locator('input[name="group-name"]')).toHaveValue("経理");
});

test("K806-UI-007 失敗の出し分け：404 E-GRP-002（もう無い）→ 小窓を閉じて赤い箱と並びの読み直し／404 E-GRP-015・409 E-GRP-016・017（マネージャーが選べない）→ 小窓の赤い箱・小窓は残る／403 → 赤い箱／503 → 赤い箱・中身は残り押し直せる", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  const d = dlgEdit(page);
  await d.locator('input[name="group-name"]').fill("営業企画");
  mk.queue(
    "updateScope",
    err(409, "E-GRP-016", { detail: { 名前: "山口 健", 訳: "止まっている" } }),
    err(409, "E-GRP-017", { detail: { 名前: "山口 健" } }),
    err(404, "E-GRP-015"),
    err(403, "FORBIDDEN"),
    err(503, "E-PAGE-003"),
  );
  for (let i = 0; i < 5; i++) {
    await save(d).click();
    await expect(notice(d)).toBeVisible();
  }
  await expect(d.locator('input[name="group-name"]')).toHaveValue("営業企画");
  mk.queue("updateScope", err(404, "E-GRP-002"));
  await save(d).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator(".k-callout").first()).toBeVisible();
  await expect.poll(() => mk.count("members")).toBe(2);
  expect(mk.count("updateScope")).toBe(6);
});

test("K806-UI-008 二度押し：答えを待つ間「保存する」は押せない・口は 1 回", async ({ page }) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  const d = dlgEdit(page);
  await d.locator('input[name="group-name"]').fill("営業企画");
  const release = mk.hold("updateScope");
  await save(d).click();
  await expect(save(d)).toBeDisabled();
  await save(d).click({ force: true });
  release();
  await expect(d).toHaveCount(0);
  expect(mk.count("updateScope")).toBe(1);
});

// ---------------------------------------------------------------- 並びを替える
test("K806-UI-009 並びの小窓：営業・受託開発・経理の順に札・名前・人数・「上へ」「下へ」。いちばん上の「上へ」・いちばん下の「下へ」は押せない。動かすとその場で順が替わる・口はまだ呼ばない・動かしていないとき「保存する」は押せない", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await orderBtn(page).click();
  const d = dlgOrder(page);
  await expect(d.locator(".k-f10m-order-row")).toContainText(["営業", "受託開発", "経理"]);
  await expect(d.getByRole("button", { name: "営業を上へ", exact: true })).toBeDisabled();
  await expect(d.getByRole("button", { name: "経理を下へ", exact: true })).toBeDisabled();
  await expect(save(d)).toBeDisabled();
  await d.getByRole("button", { name: "営業を下へ", exact: true }).click();
  await expect(d.locator(".k-f10m-order-row")).toContainText(["受託開発", "営業", "経理"]);
  expect(mk.count("updateScope")).toBe(0);
});

test("K806-UI-010 並びを保存：営業を 1 つ下げると updateScope は 1 回（受託開発 を position 1）・2 つ動かすと動いた順に 2 回（体は { position }）。小窓が閉じ・知らせ・並びを読み直す・読み直した並びが新しい順", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await orderBtn(page).click();
  const d = dlgOrder(page);
  await d.getByRole("button", { name: "営業を下へ", exact: true }).click();
  await save(d).click();
  await expect(d).toHaveCount(0);
  expect(mk.of("updateScope").map((c) => [c.id, c.body])).toEqual([[ID.JD, { position: 1 }]]);
  await expect(page.locator(".k-f10m-group .k-inv-group-name")).toHaveText(["受託開発", "営業", "経理"]);
  await orderBtn(page).click();
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await save(d).click();
  await expect(d).toHaveCount(0);
  expect(
    mk
      .of("updateScope")
      .slice(1)
      .map((c) => [c.id, c.body]),
  ).toEqual([[ID.KR, { position: 1 }]]);
  await expect(page.locator(".k-f10m-group .k-inv-group-name")).toHaveText(["経理", "受託開発", "営業"]);
});

test("K806-UI-011 並びの保存の途中で落ちた（2 つ目が 503）：赤い箱「…保存できませんでした」・並びを読み直して小窓の並びが口の並びに戻る・1 つ目は効いている", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await orderBtn(page).click();
  const d = dlgOrder(page);
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await d.getByRole("button", { name: "営業を下へ", exact: true }).click();
  mk.queue("updateScope", ok({}), err(503, "E-PAGE-003"));
  await save(d).click();
  await expect(notice(d)).toBeVisible();
  expect(mk.count("updateScope")).toBe(2);
  await expect.poll(() => mk.count("scopes")).toBeGreaterThanOrEqual(2);
  await expect(d).toBeVisible();
});

// ---------------------------------------------------------------- 層の名前と並び
test("K806-UI-012 入口：グループを足す小窓の層の ▾ に「層の名前と並びを直す」が在り、選ぶと層の小窓が開く（足す小窓の書きかけは残る）。層の小窓：営業・受託開発・経理の順に名前の欄・「1 グループ」・上へ下へ・「層を消すことは、ここではできません」・「＋ 層を足す」。層の一覧 1 回", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  await dlgAdd(page).locator('input[name="group-name"]').fill("書きかけ");
  await pick(page, dlgAdd(page).getByRole("combobox", { name: "層", exact: true }), "層の名前と並びを直す");
  const d = dlgLayers(page);
  const vals = await d
    .locator("input.k-f10m-layer-input")
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(vals).toEqual(["営業", "受託開発", "経理"]);
  await expect(d).toContainText("1 グループ");
  await expect(d).toContainText("層を消すことは、ここではできません");
  await expect(d.getByRole("button", { name: "＋ 層を足す", exact: true })).toBeVisible();
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlgAdd(page).locator('input[name="group-name"]')).toHaveValue("書きかけ");
  expect(mk.count("updateLayer")).toBe(0);
});

test("K806-UI-013 層を直して保存：名前だけ → { label }・並びだけ → { order_no }・両方 → { label, order_no }。変えた層だけ呼ぶ（変えていない層は呼ばない）。閉じて足す小窓に戻り、層の ▾ が新しい名前と並びになる", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  await pick(page, dlgAdd(page).getByRole("combobox", { name: "層", exact: true }), "層の名前と並びを直す");
  const d = dlgLayers(page);
  await expect(save(d)).toBeDisabled();
  await d.getByLabel("層の名前（営業）", { exact: true }).fill("営業部");
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await save(d).click();
  await expect(d).toHaveCount(0);
  const calls = mk.of("updateLayer").map((c) => [c.id, c.body]);
  expect(calls).toContainEqual([LY.sales, { label: "営業部" }]);
  expect(calls).toContainEqual([LY.acc, { order_no: 2 }]);
  expect(calls.some(([id]) => id === LY.dev)).toBe(false);
  await dlgAdd(page).getByRole("combobox", { name: "層", exact: true }).click();
  await expect(page.getByRole("option")).toContainText(["営業部", "経理", "受託開発"]);
  await page.keyboard.press("Escape");
});

test("K806-UI-014 層の誤り：名前が空 →「名前を入れてください」・41 字 →「層の名前は 40 字までです」・口 0 回／409 E-GRP-019（同じ名前の層）はその層の欄の下に正本の文／404 E-GRP-007（もう無い）→ 赤い箱と層の読み直し／503 → 赤い箱・中身は残る", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  await pick(page, dlgAdd(page).getByRole("combobox", { name: "層", exact: true }), "層の名前と並びを直す");
  const d = dlgLayers(page);
  const f = d.getByLabel("層の名前（営業）", { exact: true });
  await f.fill("");
  await save(d).click();
  await expect(d).toContainText("名前を入れてください");
  await f.fill("あ".repeat(41));
  await save(d).click();
  await expect(d).toContainText("層の名前は 40 字までです");
  expect(mk.count("updateLayer")).toBe(0);
  await f.fill("経理");
  mk.queue("updateLayer", err(409, "E-GRP-019"), err(404, "E-GRP-007"), err(503, "E-PAGE-003"));
  await save(d).click();
  await expect(f).toHaveAttribute("aria-invalid", "true");
  await save(d).click();
  await expect(notice(d)).toBeVisible();
  await expect.poll(() => mk.count("layers")).toBeGreaterThanOrEqual(2);
  await f.fill("営業部");
  await save(d).click();
  await expect(notice(d)).toBeVisible();
  await expect(d).toBeVisible();
});

test("K806-UI-015 層の小窓の「＋ 層を足す」：層の小窓を閉じ、足す小窓の層の ▾ が「＋ 層を足す」を選んだ形（新しい層の名前の欄）に戻る。名前・短い名前の書きかけは残る・口は呼ばない", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  await dlgAdd(page).locator('input[name="group-code"]').fill("ab");
  await pick(page, dlgAdd(page).getByRole("combobox", { name: "層", exact: true }), "層の名前と並びを直す");
  await dlgLayers(page).getByRole("button", { name: "＋ 層を足す", exact: true }).click();
  await expect(dlgLayers(page)).toHaveCount(0);
  await expect(dlgAdd(page).locator('input[name="group-new-layer"]')).toBeVisible();
  await expect(dlgAdd(page).locator('input[name="group-code"]')).toHaveValue("ab");
  expect(mk.calls.filter((c) => c.op.startsWith("update") || c.op.startsWith("create"))).toEqual([]);
});

test("K806-UI-016 やめる・Esc：3 つの小窓どれも口 0 回・焦点は開いたボタン（その行の「直す」・「並びを替える」・足す小窓）に戻る・開き直すと口の今の値（書きかけは残らない）", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await editBtn(page, "営業").click();
  await dlgEdit(page).locator('input[name="group-name"]').fill("書きかけ");
  await page.keyboard.press("Escape");
  await expect(dlgEdit(page)).toHaveCount(0);
  await expect(editBtn(page, "営業")).toBeFocused();
  await editBtn(page, "営業").click();
  await expect(dlgEdit(page).locator('input[name="group-name"]')).toHaveValue("営業");
  await page.keyboard.press("Escape");
  await orderBtn(page).click();
  await dlgOrder(page).getByRole("button", { name: "営業を下へ", exact: true }).click();
  await dlgOrder(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(orderBtn(page)).toBeFocused();
  await orderBtn(page).click();
  await expect(dlgOrder(page).locator(".k-f10m-order-row")).toContainText(["営業", "受託開発", "経理"]);
  expect(mk.count("updateScope")).toBe(0);
});

test("K806-UI-017 幅 320・375・768・1024・1440：3 つの小窓どれを開いても横のはみ出し 0（数値）・「直す」「並びを替える」が画面の中に収まり押せる（高さ 32px 以上）", async ({
  page,
}) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openList(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    for (const b of [editBtn(page, "営業"), orderBtn(page)]) {
      const r = (await b.boundingBox())!;
      expect(r.x + r.width, `幅 ${w}`).toBeLessThanOrEqual(w);
      expect(r.height).toBeGreaterThanOrEqual(32);
    }
    await editBtn(page, "営業").click();
    expect(await overflowX(page), `直す 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await orderBtn(page).click();
    expect(await overflowX(page), `並び 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
});

// ---------------------------------------------------------------- 層の一覧が読めない・並びの対象
test("K806-UI-018 層の一覧が読めない（listLayers 503）：足す小窓の層 ▾ は「＋ 層を足す」だけ（「層の名前と並びを直す」は出ない）。読めれば 2 つとも出る", async ({
  page,
}) => {
  const { mk } = await openList(page);
  mk.queue("layers", err(503, "E-PAGE-003"));
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  const sel = dlgAdd(page).getByRole("combobox", { name: "層", exact: true });
  await sel.click();
  // 選んでいる行には部品が「✓」を描き、toHaveText は字に含めるので末尾で比べる（components/k/select.tsx の ItemIndicator）
  await expect(page.getByRole("option")).toHaveText([/＋ 層を足す$/]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dlgAdd(page)).toHaveCount(0);
  await page.getByRole("button", { name: "＋ グループ", exact: true }).click();
  await sel.click();
  await expect(page.getByRole("option")).toContainText([
    "営業",
    "受託開発",
    "経理",
    "＋ 層を足す",
    "層の名前と並びを直す",
  ]);
  expect(mk.count("layers")).toBe(2);
});

test("K806-UI-019 並びの対象：listScopes に営業の下の深いグループ（上のグループが営業）が在っても、並びの小窓は営業・受託開発・経理の 3 つだけ・深いグループは出ない・保存しても深いグループに updateScope を送らない", async ({
  page,
}) => {
  const { mk, live } = await openList(page);
  const DEEP = "0193c5a0-0000-7000-8000-00000000d001";
  live.scopes.push({ ...sc(DEEP, "法人営業", "HE", "sage", LY.sales, "営業", 1, [SATO], 1), parent_id: ID.EG });
  await orderBtn(page).click();
  const d = dlgOrder(page);
  await expect(d.locator(".k-f10m-order-row")).toHaveCount(3);
  await expect(d.locator(".k-f10m-order-name")).toHaveText(["営業", "受託開発", "経理"]);
  await d.getByRole("button", { name: "営業を下へ", exact: true }).click();
  await save(d).click();
  await expect(d).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op === "updateScope").map((c) => c.id)).not.toContain(DEEP);
  expect(mk.count("updateScope")).toBeGreaterThanOrEqual(1);
});

test("K806-UI-020 並びの対象は会社のいちばん上のグループの子だけ：listScopes の先頭に会社のいちばん上のグループ（上が空）が在っても、並びの小窓は営業・受託開発・経理の 3 つだけ・いちばん上は出ない（上へ・下へも無い）・保存してもいちばん上に updateScope を送らない", async ({
  page,
}) => {
  const { mk } = await openList(page);
  await orderBtn(page).click();
  const d = dlgOrder(page);
  await expect(d.locator(".k-f10m-order-row")).toHaveCount(3);
  await expect(d.locator(".k-f10m-order-name")).toHaveText(["営業", "受託開発", "経理"]);
  await expect(d).not.toContainText(WS_NAME);
  await expect(d.getByRole("button", { name: `${WS_NAME}を下へ`, exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "経理を上へ", exact: true }).click();
  await save(d).click();
  await expect(d).toHaveCount(0);
  expect(mk.of("updateScope").map((c) => [c.id, c.body])).toEqual([[ID.KR, { position: 2 }]]);
  expect(mk.of("updateScope").map((c) => c.id)).not.toContain(ROOT);
});
