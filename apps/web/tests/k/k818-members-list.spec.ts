// K-818「メンバーの画面（/members）の役割の ▾・行の「⋯」・最後に使った日・権限が無い人の画面」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の mb-list・mb-role-menu・mb-role-stepup・mb-role-last-admin・mb-more・mb-no-access（本番と同じ部品 features/F10/members・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。メンバーの並び（getWorkspaceMembers・K-419・K-808）・役割を変える（updateMemberRole・K-811）・本人確認の取り直しだけを網の手前で差し替える（f10-kit.ts）。
//   招く小窓（K-420）・招待中の行の送り直す・取り消す・このグループに招く（K-809）・＋ グループ（K-805・K-806）はこの葉の外。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi, viewerViaApi } from "../_lib/api";
import {
  F10_PAIRS,
  ID,
  MOCK_BASE,
  WS_NAME,
  err,
  mockApi,
  ok,
  openAt,
  overflowX,
  passStepUp,
  stepDlg,
  toast,
  type Api,
} from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/members";
const SEC = 'section[aria-labelledby="members-title"]';
// グループは名前で 1 つに決める（hasText だと「経理も兼ねる」の行を持つ営業のカードにも当たる）
const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const row = (page: Page, g: string, who: string) => group(page, g).locator(".k-f10m-row").filter({ hasText: who });
const roleBtn = (page: Page, g: string, who: string) =>
  row(page, g, who).getByRole("button", { name: new RegExp(`^${who}の役割を変える`) });
const moreBtn = (page: Page, g: string, who: string) =>
  row(page, g, who).getByRole("button", { name: `${who}のほかの操作`, exact: true });
const pick = (page: Page, name: string | RegExp) => page.getByRole("menuitem", { name }).click();
/** 閉じているグループを開く（初めは自分の主のグループ＝営業だけが開く・K-710）。受託開発・経理の行は見る前にこれで開く */
async function openGroup(page: Page, name: string): Promise<void> {
  const t = group(page, name).locator(".k-f10m-toggle");
  await t.click();
  await expect(t).toHaveAttribute("aria-expanded", "true");
}
const roleOk = (a: Api, role: string) => a.set("role", (c) => ok({ member_id: c.id, company_role: role, groups: [] }));

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

async function openList(page: Page, width = 1440): Promise<Api> {
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH, width);
  await expect(page.locator(SEC).getByRole("heading", { name: "メンバー", level: 1 })).toBeVisible();
  await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page, mk: Api) => Promise<void>> = {
  "mb-list": async () => {},
  "mb-role-menu": async (page) => {
    await roleBtn(page, "営業", "鈴木 一郎").click();
    await expect(page.getByRole("menuitem")).toHaveCount(4);
  },
  "mb-role-stepup": async (page, mk) => {
    mk.queue("role", err(403, "STEP_UP_REQUIRED"));
    await roleBtn(page, "営業", "鈴木 一郎").click();
    await pick(page, /マネージャー/);
    await expect(stepDlg(page)).toBeVisible();
  },
  "mb-role-last-admin": async (page, mk) => {
    mk.queue("role", err(409, "E-MEM-004"));
    await roleBtn(page, "営業", "佐藤 花子").click();
    await pick(page, /メンバー$/);
    await expect(page.locator(".k-callout")).toBeVisible();
  },
  "mb-more": async (page) => {
    await moreBtn(page, "営業", "鈴木 一郎").click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K818-UI-001 ${id} 幅 ${w}：頭・第 2 ナビ・見出し・上の 1 行・グループのカード・人の行・役割の ▾・最後に使った日・メニュー・小窓の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await openList(page, w);
          // モック（mb-*）は 3 つのグループとも開いた形。初めは営業だけが開く（K-710）ので、比べる前に受託開発・経理を開く
          await openGroup(page, "受託開発");
          await openGroup(page, "経理");
          await drive(page, mk);
        },
        // 頭の「＋ グループ」（K-805）・「並びを替える」（K-806）はこの葉では押せない形（aria-disabled・不透明度 0.55）、
        //   下絵は押せる形（1）なので、頭のボタンの濃さと色は比べない（K-420 の INV_PAIRS と同じ訳）。数・大きさ・字は比べる。
        //   押せる形にする葉（K-805・K-806）が自分の突き合わせで比べる
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true, skip: ["acts:opacity", "acts:color"] },
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("h1");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
for (const w of MATCH_WIDTHS) {
  test(`K818-UI-001 mb-no-access 幅 ${w}：権限が無い人の画面（エラーの題・文・導線）の字と位置がモックと同じ`, async ({
    browser,
  }) => {
    const viewer = await viewerViaApi();
    const { bad, rows } = await matchMock(
      browser,
      "mb-no-access",
      w,
      async (page) => {
        await mockApi(page);
        await openAt(page, viewer.token, PATH, w);
        await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
      },
      { pairs: F10_PAIRS, base: MOCK_BASE, blur: true },
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 開く・並び
test("K818-UI-002 /members を開くと並びの口を 1 回だけ読む（StrictMode でも）・左のバーの「ワークスペースの管理」が今の場所", async ({
  page,
}) => {
  const mk = await openList(page);
  expect(mk.count("members")).toBe(1);
  await expect(page.getByRole("link", { name: "ワークスペースの管理" })).toHaveAttribute("aria-current", "page");
});

test("K818-UI-003 並びの字：営業に 4 人（自分・経理も兼ねる・分身 動いている・PC 3 日つながっていない）・受託開発は閲覧のみ「分身なし（見るだけ）」・経理に招待中「招待中 ・ あと 6 日」。「知らせる」のボタンはどこにも無い", async ({
  page,
}) => {
  await openList(page);
  await openGroup(page, "受託開発");
  await openGroup(page, "経理");
  await expect(group(page, "営業").locator(".k-f10m-row")).toHaveCount(4);
  await expect(row(page, "営業", "高本 聖斗")).toContainText("自分");
  await expect(row(page, "営業", "田中 美咲")).toContainText("経理も兼ねる");
  await expect(row(page, "営業", "田中 美咲")).toContainText("PC 3 日つながっていない");
  await expect(row(page, "営業", "鈴木 一郎")).toContainText("分身 動いている");
  await expect(row(page, "受託開発", "山口 健")).toContainText("分身なし（見るだけ）");
  await expect(row(page, "受託開発", "佐藤 花子")).toContainText("兼ねている");
  await expect(group(page, "経理").locator(".k-f10m-row").last()).toContainText("招待中 ・ あと 6 日");
  await expect(page.getByRole("button", { name: /知らせる/ })).toHaveCount(0);
  await expect(page.locator(SEC)).not.toContainText("書き出");
});

test("K818-UI-004 最後に使った日（D-154.1）：今日・3 日前・12 日前から使っていない（目立つ）・まだ使っていません。招待中の行には出ない。7 日以上は目立たせる（data-away）", async ({
  page,
}) => {
  const mk = await openList(page);
  await expect(row(page, "営業", "鈴木 一郎").locator(".k-f10m-last")).toContainText("3 日前");
  await expect(row(page, "営業", "高本 聖斗").locator(".k-f10m-last")).toContainText("今日");
  await expect(row(page, "営業", "田中 美咲").locator(".k-f10m-last")).toContainText("12 日前から使っていない");
  await expect(row(page, "営業", "田中 美咲").locator(".k-f10m-last")).toHaveAttribute("data-away", "true");
  await openGroup(page, "受託開発");
  await expect(row(page, "受託開発", "山口 健").locator(".k-f10m-last")).not.toHaveAttribute("data-away", "true");
  mk.w.groups[0]!.members[2]!.last_used_days = null;
  await page.reload();
  await expect(row(page, "営業", "鈴木 一郎").locator(".k-f10m-last")).toContainText("まだ使っていません");
  await openGroup(page, "経理");
  await expect(group(page, "経理").locator(".k-f10m-row").last().locator(".k-f10m-last")).toHaveText("");
});

test("K818-UI-005 兼務（D-154.15）：佐藤は営業と受託開発のマネージャーを兼ね、両方のグループの行に出て役割はどちらもマネージャー。田中は営業のメンバー・経理のメンバーで別の部署の作業員として入る。人数の数え直しで重ならない（見出しの「N 人」は重ならない人数）", async ({
  page,
}) => {
  await openList(page);
  await openGroup(page, "受託開発");
  await openGroup(page, "経理");
  await expect(roleBtn(page, "営業", "佐藤 花子")).toContainText("マネージャー");
  await expect(roleBtn(page, "受託開発", "佐藤 花子")).toContainText("マネージャー");
  await expect(roleBtn(page, "営業", "田中 美咲")).toContainText("メンバー");
  await expect(roleBtn(page, "経理", "田中 美咲")).toContainText("メンバー");
  await expect(group(page, "営業").locator(".k-inv-sub").first()).toContainText("4 人");
  await expect(group(page, "受託開発").locator(".k-inv-sub").first()).toContainText("2 人");
});

// ---------------------------------------------------------------- 役割の ▾
test("K818-UI-006 役割の ▾：押すと 管理者・マネージャー・メンバー・閲覧のみ の 4 つ・いまのが ✓・ゲストは無い。自分の行の ▾ は aria-disabled（title「自分の役割は、自分では変えられません」）で開かない", async ({
  page,
}) => {
  await openList(page);
  await roleBtn(page, "営業", "鈴木 一郎").click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveCount(4);
  await expect(items).toContainText(["管理者", "マネージャー", "メンバー", "閲覧のみ"]);
  await expect(items.nth(2)).toContainText("✓");
  await expect(page.getByText("ゲスト")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const self = roleBtn(page, "営業", "高本 聖斗");
  await expect(self).toHaveAttribute("aria-disabled", "true");
  await expect(self).toHaveAttribute("title", "自分の役割は、自分では変えられません");
  await self.click({ force: true });
  await expect(page.getByRole("menuitem")).toHaveCount(0);
});

test("K818-UI-007 役割を変える：鈴木をマネージャーに → updateMemberRole の体 { role_key: manager, scope_id: 営業 } を 1 回・知らせ「鈴木 一郎の役割を マネージャー にしました」・並びを読み直す（合わせて 2 回）", async ({
  page,
}) => {
  const mk = await openList(page);
  roleOk(mk, "member");
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /マネージャー/);
  await expect(toast(page)).toContainText("鈴木 一郎の役割を マネージャー にしました");
  expect(mk.of("role")).toHaveLength(1);
  expect(mk.last("role")!.id).toBe(ID.suzuki);
  expect(mk.last("role")!.body).toEqual({ role_key: "manager", scope_id: ID.EG });
  expect(mk.count("members")).toBe(2);
});

test("K818-UI-008 管理者にする：体は { role_key: admin }（scope_id を送らない・会社全体の管理者）。管理者の人をメンバーに下げるときは、その行のグループ scope_id を付ける", async ({
  page,
}) => {
  const mk = await openList(page);
  roleOk(mk, "admin");
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /管理者/);
  await expect(toast(page)).toContainText("管理者 にしました");
  expect(mk.last("role")!.body).toEqual({ role_key: "admin" });
  mk.w.groups[0]!.members[2]!.role = "admin";
  await page.reload();
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /メンバー/);
  expect(mk.last("role")!.body).toEqual({ role_key: "member", scope_id: ID.EG });
});

test("K818-UI-009 いまと同じ役割を選ぶ：口を呼ばない・メニューは閉じる", async ({ page }) => {
  const mk = await openList(page);
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /メンバー/);
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  expect(mk.count("role")).toBe(0);
});

test("K818-UI-010 兼ねる側の行で役割を変える（D-154.15）：田中の経理の行でマネージャーに → scope_id は経理（営業ではない）。営業の行の役割は変わらない（読み直しのあとも）", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.set("role", (c) => {
    mk.w.groups[2]!.members[0]!.group_role = "manager";
    return ok({ member_id: c.id, company_role: "member", groups: [] });
  });
  await openGroup(page, "経理");
  await roleBtn(page, "経理", "田中 美咲").click();
  await pick(page, /マネージャー/);
  await expect(roleBtn(page, "経理", "田中 美咲")).toContainText("マネージャー");
  expect(mk.last("role")!.body).toEqual({ role_key: "manager", scope_id: ID.KR });
  await expect(roleBtn(page, "営業", "田中 美咲")).toContainText("メンバー");
});

test("K818-UI-011 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓「鈴木 一郎の役割を「メンバー」から「マネージャー」に変えます」→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ updateMemberRole（押し直させない）", async ({
  page,
}) => {
  const mk = await openList(page);
  roleOk(mk, "member");
  mk.queue("role", err(403, "STEP_UP_REQUIRED"));
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /マネージャー/);
  await expect(stepDlg(page)).toContainText("鈴木 一郎の役割を「メンバー」から「マネージャー」に変えます");
  expect(mk.count("security")).toBe(1);
  await passStepUp(page);
  await expect(toast(page)).toContainText("マネージャー にしました");
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.of("role").map((c) => c.body)).toEqual([
    { role_key: "manager", scope_id: ID.EG },
    { role_key: "manager", scope_id: ID.EG },
  ]);
});

test("K818-UI-012 取り直しを「やめる」：stepUp 0 回・updateMemberRole のやり直し 0 回・役割は前のまま・知らせは出ない", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("role", err(403, "STEP_UP_REQUIRED"));
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /マネージャー/);
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("role")).toBe(1);
  await expect(roleBtn(page, "営業", "鈴木 一郎")).toContainText("メンバー");
  await expect(toast(page)).toHaveCount(0);
});

test("K818-UI-013 最後の管理者（409 E-MEM-004）：上に赤い箱「役割を変えられません」「佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、変えてください」・役割は前のまま・口は 1 回", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("role", err(409, "E-MEM-004"));
  await roleBtn(page, "営業", "佐藤 花子").click();
  await pick(page, /メンバー/);
  const box = page.locator(".k-callout");
  await expect(box).toContainText("役割を変えられません");
  await expect(box).toContainText(
    "佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、変えてください",
  );
  await expect(roleBtn(page, "営業", "佐藤 花子")).toContainText("マネージャー");
  expect(mk.count("role")).toBe(1);
});

test("K818-UI-014 失敗の出し分け：404 E-MEM-002（もう居ない）→ 赤い箱と並びの読み直し／404 E-MEM-006・409 E-MEM-007（グループが変わった）→ 赤い箱と読み直し／403（権限を外した直後・別のタブで）→ 赤い箱で役割は前のまま／409 E-MEM-003（自分）→ 赤い箱／503 → 赤い箱で並びは前のまま・押し直せる", async ({
  page,
}) => {
  const mk = await openList(page);
  const change = async () => {
    await roleBtn(page, "営業", "鈴木 一郎").click();
    await pick(page, /マネージャー/);
  };
  for (const [reply, reads] of [
    [err(404, "E-MEM-002"), 2],
    [err(404, "E-MEM-006"), 3],
    [err(409, "E-MEM-007"), 4],
  ] as const) {
    mk.queue("role", reply);
    await change();
    await expect(page.locator(".k-callout").first()).toBeVisible();
    await expect.poll(() => mk.count("members")).toBe(reads);
  }
  mk.queue("role", err(403, "FORBIDDEN"));
  await change();
  await expect(page.locator(".k-callout").first()).toBeVisible();
  await expect(roleBtn(page, "営業", "鈴木 一郎")).toContainText("メンバー");
  mk.queue("role", err(409, "E-MEM-003"));
  await change();
  await expect(page.locator(".k-callout")).toContainText("自分");
  mk.queue("role", err(503, "E-PAGE-003"));
  await change();
  await expect(page.locator(".k-callout").first()).toBeVisible();
  await expect(roleBtn(page, "営業", "鈴木 一郎")).toContainText("メンバー");
  roleOk(mk, "member");
  await change();
  await expect(toast(page)).toContainText("マネージャー にしました");
});

test("K818-UI-015 二度押し：答えを待つ間に別の役割を選んでも updateMemberRole は 1 回（▾ は押せない）", async ({
  page,
}) => {
  const mk = await openList(page);
  roleOk(mk, "member");
  const release = mk.hold("role");
  await roleBtn(page, "営業", "鈴木 一郎").click();
  await pick(page, /マネージャー/);
  await expect(roleBtn(page, "営業", "鈴木 一郎")).toHaveAttribute("aria-disabled", "true");
  await roleBtn(page, "営業", "鈴木 一郎").click({ force: true });
  release();
  await expect(toast(page)).toBeVisible();
  expect(mk.count("role")).toBe(1);
});

// ---------------------------------------------------------------- 行の「⋯」
test("K818-UI-016 「⋯」：役割を変える・グループを移す・兼ねるグループを足す・担当しているチケットを見る・一時的に止める・ワークスペースから外す の 6 つ。「役割を変える」は役割の ▾ と同じメニューを開く。止まっている人は「一時的に止める」が「戻す」に替わる。自分の行は止める・外すが aria-disabled", async ({
  page,
}) => {
  const mk = await openList(page);
  await moreBtn(page, "営業", "鈴木 一郎").click();
  await expect(page.getByRole("menuitem")).toHaveCount(6);
  await expect(page.getByRole("menuitem")).toContainText([
    "役割を変える",
    "グループを移す",
    "兼ねるグループを足す",
    "担当しているチケットを見る",
    "一時的に止める",
    "ワークスペースから外す",
  ]);
  await pick(page, /^役割を変える/);
  await expect(page.getByRole("menuitem")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await moreBtn(page, "営業", "高本 聖斗").click();
  await expect(page.getByRole("menuitem", { name: /一時的に止める/ })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("menuitem", { name: /ワークスペースから外す/ })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  mk.w.groups[1]!.members[1]!.suspended = true;
  await page.reload();
  await openGroup(page, "受託開発");
  await moreBtn(page, "受託開発", "山口 健").click();
  await expect(page.getByRole("menuitem", { name: /戻す/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /一時的に止める/ })).toHaveCount(0);
  await expect(row(page, "受託開発", "山口 健")).toContainText("一時的に止まっている");
});

test("K818-UI-017 「⋯」の行き先：名前・担当しているチケットを見る → /members/<id>／グループを移す → ?do=move／兼ねる → ?do=also／止める → ?do=suspend／戻す → ?do=resume／外す → ?do=remove。どれも書く口を呼ばない", async ({
  page,
}) => {
  const mk = await openList(page);
  const go = async (g: string, who: string, item: RegExp, want: string) => {
    await moreBtn(page, g, who).click();
    await pick(page, item);
    await expect(page).toHaveURL(new RegExp(`${want.replace("?", "\\?")}$`));
    await page.goBack();
    await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  };
  const base = `/members/${ID.suzuki}`;
  await go("営業", "鈴木 一郎", /担当しているチケットを見る/, base);
  await go("営業", "鈴木 一郎", /グループを移す/, `${base}?do=move`);
  await go("営業", "鈴木 一郎", /兼ねるグループを足す/, `${base}?do=also`);
  await go("営業", "鈴木 一郎", /一時的に止める/, `${base}?do=suspend`);
  await go("営業", "鈴木 一郎", /ワークスペースから外す/, `${base}?do=remove`);
  await row(page, "営業", "鈴木 一郎").getByRole("link", { name: "鈴木 一郎" }).click();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  expect(mk.calls.filter((c) => !["members", "getMember", "security"].includes(c.op))).toEqual([]);
});

// ---------------------------------------------------------------- 権限・上の 1 行・幅
test("K818-UI-018 権限が無い人（閲覧のみ）が直に開く：「この画面を見る権限がありません」・並びの口 0 回・左のバーに「ワークスペースの管理」が無い・外枠は出る", async ({
  page,
}) => {
  const viewer = await viewerViaApi();
  const mk = await mockApi(page);
  await openAt(page, viewer.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "ワークスペースの管理" })).toHaveCount(0);
  await expect(page.locator(".k-f10m-group")).toHaveCount(0);
  expect(mk.count("members")).toBe(0);
});

test("K818-UI-019 上の 1 行：PC が 3 日つながっていない人がいれば「田中 美咲さんの PC が 3 日つながっていません」と招待中の数。誰も居なければ出ない。催促のボタンは無い", async ({
  page,
}) => {
  const mk = await openList(page);
  await expect(page.locator(".k-band")).toContainText("田中 美咲さんの PC が 3 日つながっていません");
  await expect(page.locator(".k-band")).toContainText("招待中 1 人（kimura@…）");
  await expect(page.locator(".k-band").getByRole("button")).toHaveCount(0);
  for (const g of mk.w.groups) for (const m of g.members) m.pc = "ok";
  mk.w.invitations = [];
  await page.reload();
  await expect(page.locator(".k-band")).toHaveCount(0);
});

test("K818-UI-020 読めない（503）：「メンバーを読み込めませんでした」と「もう一度読む」。読めるまで「＋ 招く」「＋ グループ」は押せない。もう一度読むで並びが出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  mk.queue("members", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("メンバーを読み込めませんでした", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 招く", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(".k-f10m-group")).toHaveCount(3);
  expect(mk.count("members")).toBe(2);
});

test("K818-UI-021 幅 320・375・768・1024・1440：横のはみ出し 0（数値）・役割のメニューと「⋯」のメニューを開いても 0。幅 375 は最後に使った日が名前の下の 2 行目に出る", async ({
  page,
}) => {
  await mockApi(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await expect(page.locator(".k-f10m-group")).toHaveCount(3);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    await roleBtn(page, "営業", "鈴木 一郎").click();
    expect(await overflowX(page), `役割の幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    if (w <= 375) {
      const last = await row(page, "営業", "鈴木 一郎").locator(".k-f10m-last").boundingBox();
      const name = await row(page, "営業", "鈴木 一郎").locator(".k-inv-name").boundingBox();
      expect(last!.y, `幅 ${w} の最後に使った日は名前より下`).toBeGreaterThan(name!.y);
    }
  }
});

test("K818-UI-022 キーボード：役割の ▾ に Tab で入って Enter で開き、矢印で選んで Enter で変えられる。Esc で閉じて焦点は ▾ に戻る", async ({
  page,
}) => {
  const mk = await openList(page);
  roleOk(mk, "member");
  await roleBtn(page, "営業", "鈴木 一郎").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(roleBtn(page, "営業", "鈴木 一郎")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(toast(page)).toBeVisible();
  expect(mk.count("role")).toBe(1);
});
