// K-841「ワークスペースから抜ける小窓を口 leaveWorkspace につなぐ：担当が残っている・抜けられる・最後の管理者」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-leave・me-leave-ready・me-leave-last-admin（本番と同じ部品 features/F10/account/dialogs.tsx の LeaveDialog・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。自分の読み（getMe・K-833）と抜ける口（K-838）・本人確認の取り直しは網の手前で差し替える（f10-ops-kit.ts）。
//   別の会社の［担当を渡しにいく］［管理者を決めにいく］が呼ぶ切り替えの口（switchWorkspace・K-851）は、この試験の中で差し替える。
//   分身の記憶は抜けるといつも消える（選べない・D-154.51）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX, passStepUp, stepDlg } from "./f10-kit";
import { KYOTO_ID, ME_PAIRS, err, me, mockOps, ok, type Me, type MeWorkspace, type Reply } from "./f10-ops-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/account";
const KYOTO = "京蟻システム株式会社";
// 小窓が開いている間は後ろの区画が読み上げから外れる（aria-hidden）。小窓を開いたまま後ろの行を見る試験（「行は残る」）のため hidden も探す
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true, includeHidden: true });
const rows = (page: Page) => card(page, "入っているワークスペース").locator(".k-set-row");
const kyoto = (page: Page) => rows(page).filter({ hasText: KYOTO });
const dlg = (page: Page) => page.getByRole("dialog", { name: `${KYOTO} から抜ける`, exact: true });
const leave = (page: Page) => dlg(page).getByRole("button", { name: /^抜ける/ });
const open = async (page: Page) => {
  await kyoto(page).getByRole("button", { name: "抜ける", exact: true }).click();
  await expect(dlg(page)).toBeVisible();
};
const TICKETS = [
  { id: "t1", number: "JD-201", title: "ログイン画面の文言を直す" },
  { id: "t2", number: "JD-204", title: "追加開発の見積" },
];
/** 京蟻の行だけを替えた「自分」 */
const withKyoto = (o: Partial<MeWorkspace>, current = false): Me => {
  const base = me();
  return {
    ...base,
    workspaces: base.workspaces.map((w, i) => {
      if (w.tenant_id === KYOTO_ID) return { ...w, ...o };
      return current && i === 0 ? { ...w, current: false } : w;
    }),
  };
};
const ASSIGNED = withKyoto({ assigned_total: 2, assigned: TICKETS });
const LAST = withKyoto({ role: "admin", last_admin: true });

interface SwApi {
  switches: string[];
  bodies: unknown[];
  queue: (...r: Reply[]) => void;
  hold: () => () => void;
}
/** 切り替えの口 switchWorkspace（K-851）の差し替え（f10-ops-kit の後に足す・こちらが先に当たる）。既定は 200 { tenant_id, switched: true } */
async function mockSwitch(page: Page): Promise<SwApi> {
  const replies: Reply[] = [];
  let held: Promise<void> | null = null;
  const api: SwApi = {
    switches: [],
    bodies: [],
    queue: (...r) => void replies.push(...r),
    hold: () => {
      let release = () => {};
      held = new Promise<void>((res) => (release = res));
      return () => release();
    },
  };
  await page.route(/\/api\/v1\/me\/workspaces\/[^/]+\/switch$/, async (route: Route, req: Request) => {
    const id = new URL(req.url()).pathname.split("/").at(-2)!;
    api.switches.push(id);
    api.bodies.push(req.postDataJSON() ?? {});
    if (held) await held;
    const r = replies.shift() ?? ok({ tenant_id: id, switched: true });
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return api;
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

const STATES: Record<string, Me | undefined> = {
  "me-leave": ASSIGNED,
  "me-leave-ready": undefined,
  "me-leave-last-admin": LAST,
};
for (const [id, who] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K841-UI-001 ${id} 幅 ${w}：小窓（題・あなたは…・説明・担当の一覧／最後の管理者の箱・足のボタン）と後ろのプロフィールの位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows: r } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page, who ? { me: who } : {});
          await openAt(page, owner.token, PATH, w);
          await open(page);
          // ［抜ける］を押すと行まで下に動く。小窓は画面に貼り付くので、下絵（上の端）と同じく頁の上の端で位置を読む
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        {
          pairs: ME_PAIRS,
          base: MOCK_BASE,
          blur: false,
          // 最後の管理者の下絵は、後ろの京蟻の行の役を「メンバー」のまま描く（試験は管理者の答えで最後の管理者にする）。後ろの区画・行の字は比べない（小窓は全部比べる）
          ...(id === "me-leave-last-admin" ? { skip: ["pf-ws:texts", "row:texts"] } : {}),
        },
      );
      expect(r.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K841-UI-002 担当が残っている：小窓の題「京蟻システム株式会社 から抜ける」・「あなたは メンバー」・「担当しているチケット 2 件」と一覧（JD-201 … ・JD-204 …）・「抜ける前に、ほかの人に渡してください」・［担当を渡しにいく］・主ボタン「抜ける（渡し終わってから）」は押せない。開くだけでは口を呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: ASSIGNED });
  await openAt(page, owner.token, PATH);
  await open(page);
  await expect(dlg(page)).toContainText("あなたは メンバー");
  await expect(dlg(page)).toContainText("担当しているチケット 2 件");
  await expect(dlg(page)).toContainText("JD-201 ログイン画面の文言を直す");
  await expect(dlg(page)).toContainText("JD-204 追加開発の見積");
  await expect(dlg(page)).toContainText("抜ける前に、ほかの人に渡してください（受けてもらうまで抜けられない）");
  await expect(dlg(page).getByRole("button", { name: "担当を渡しにいく", exact: true })).toBeVisible();
  await expect(leave(page)).toBeDisabled();
  await expect(leave(page)).toHaveText("抜ける（渡し終わってから）");
  expect(mk.calls.map((c) => c.op)).toEqual(["me"]);
});

test("K841-UI-003 担当が 11 件以上：一覧は口の 10 件まで出し、「ほか N 件」を足す（件数は assigned_total）", async ({
  page,
}) => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, number: `JD-${300 + i}`, title: `仕事 ${i}` }));
  await mockOps(page, { me: withKyoto({ assigned_total: 13, assigned: ten }) });
  await openAt(page, owner.token, PATH);
  await open(page);
  await expect(dlg(page)).toContainText("担当しているチケット 13 件");
  await expect(dlg(page)).toContainText("JD-309 仕事 9");
  await expect(dlg(page)).toContainText("ほか 3 件");
});

test("K841-UI-004 抜けられる：「担当しているチケットはありません。このまま抜けられます」・主ボタン「抜ける」が押せる・「<名前> に残るのは、あなたが書いたやり取り・決定ログだけ。抜けたあとでも、招待されればまた入れる」", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await expect(dlg(page)).toContainText("担当しているチケットはありません。このまま抜けられます");
  await expect(leave(page)).toBeEnabled();
  await expect(leave(page)).toHaveText("抜ける");
  await expect(dlg(page)).toContainText(
    `${KYOTO} のワークスペースに残るのは、あなたが書いたやり取り・決定ログだけ。抜けたあとでも、招待されればまた入れる`,
  );
});

test("K841-UI-005 最後の管理者：「あなたは 管理者」・「最後の管理者です」の箱・［管理者を決めにいく］・主ボタンは押せない。担当も残っているときは最後の管理者が先（口の順と同じ）", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: LAST });
  await openAt(page, owner.token, PATH);
  await open(page);
  await expect(dlg(page)).toContainText("あなたは 管理者");
  await expect(dlg(page)).toContainText("最後の管理者です");
  await expect(dlg(page)).toContainText("ほかの人を管理者にしてから、抜けてください");
  await expect(dlg(page).getByRole("button", { name: "管理者を決めにいく", exact: true })).toBeVisible();
  await expect(leave(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  mk.state.me = withKyoto({ role: "admin", last_admin: true, assigned_total: 2, assigned: TICKETS });
  await page.reload();
  await open(page);
  await expect(dlg(page)).toContainText("最後の管理者です");
  await expect(dlg(page)).not.toContainText("担当しているチケット 2 件");
});

test("K841-UI-006 分身の記憶は選べない（チェックが無い）：「抜けると、あなたの分身が <名前> で覚えたことはすべて消えます」の説明が出る。3 つの形どれでも同じ", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  for (const who of [undefined, ASSIGNED, LAST]) {
    if (who) mk.state.me = who;
    await page.reload();
    await open(page);
    await expect(dlg(page).getByRole("checkbox")).toHaveCount(0);
    await expect(dlg(page)).toContainText(`あなたの分身が ${KYOTO} で覚えたことは、抜けるとすべて消えます`);
    await page.keyboard.press("Escape");
  }
});

test("K841-UI-007 抜ける（別の会社）：leaveWorkspace を道の id＝京蟻の会社の id で 1 回（体は空）・小窓が閉じ・京蟻の行が消える・ほかの行はそのまま・自分を 1 回読み直す・role=status「…から抜けました。30 日のあいだは、同じメールで招かれるとグループと役割が戻ります」（仮）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await leave(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("leave")).toBe(1);
  expect(mk.last("leave")!.id).toBe(KYOTO_ID);
  expect(Object.keys(mk.last("leave")!.body ?? {})).toEqual([]);
  await expect(kyoto(page)).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).toContainText("株式会社ENGINE BASE");
  await expect(page.getByRole("status").filter({ hasText: "から抜けました" })).toContainText(
    "30 日のあいだは、同じメールで招かれるとグループと役割が戻ります",
  );
  expect(mk.count("me")).toBe(2);
});

test("K841-UI-008 今いる会社から抜ける：200 のあとセッションが切れるので、入り直し（/login）へ移る。口は 1 回", async ({
  page,
}) => {
  const base = me();
  const mine = {
    ...me(),
    workspaces: base.workspaces.map((w, i) => (i === 0 ? { ...w, role: "member" as const, last_admin: false } : w)),
  };
  const mk = await mockOps(page, { me: mine });
  // 抜けた後の signOut は本物の口でセッションを切る。同じ組のほかの試験が使う owner を切らないよう、この試験だけの人で入る
  const solo = await signupViaApi(WS_NAME);
  await openAt(page, solo.token, PATH);
  await rows(page).first().getByRole("button", { name: "抜ける", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^抜ける/ })
    .click();
  await expect(page).toHaveURL(/\/login/);
  expect(mk.count("leave")).toBe(1);
});

test("K841-UI-009 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「京蟻システム株式会社 から抜ける前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ口でもう 1 回だけ leaveWorkspace（押し直させない）。行が消える", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("leave", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await leave(page).click();
  await expect(stepDlg(page)).toContainText(`${KYOTO} から抜ける前に、本人か確かめます`);
  await passStepUp(page);
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("leave")).toBe(2);
  expect(mk.of("leave")[1]!.id).toBe(KYOTO_ID);
  await expect(kyoto(page)).toHaveCount(0);
});

test("K841-UI-010 取り直しを「やめる」：stepUp 0 回・やり直し 0 回・抜ける小窓に戻る・行は残る", async ({ page }) => {
  const mk = await mockOps(page);
  mk.queue("leave", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await leave(page).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(dlg(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("leave")).toBe(1);
  await expect(kyoto(page)).toHaveCount(1);
});

test("K841-UI-011 開いている間に担当が増えた（409 E-ME-050・TP-CRUD-01）：自分を読み直して、小窓が「担当が残っている」の形に替わる（押し直さなくてよい）。抜けない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  mk.state.me = ASSIGNED;
  mk.queue("leave", err(409, "E-ME-050"));
  await leave(page).click();
  await expect(dlg(page)).toContainText("担当しているチケット 2 件");
  await expect(leave(page)).toBeDisabled();
  await expect(kyoto(page)).toHaveCount(1);
  expect(mk.count("leave")).toBe(1);
  expect(mk.count("me")).toBe(2);
});

test("K841-UI-012 開いている間にほかの管理者が抜けた（409 E-ME-051）：自分を読み直して、小窓が「最後の管理者です」の形に替わる。抜けない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  mk.state.me = LAST;
  mk.queue("leave", err(409, "E-ME-051"));
  await leave(page).click();
  await expect(dlg(page)).toContainText("最後の管理者です");
  await expect(leave(page)).toBeDisabled();
  expect(mk.count("me")).toBe(2);
});

test("K841-UI-013 もう抜けていた・会社が無い（404・別のタブで先に抜けた）：小窓を閉じ、自分を読み直して行が消え、赤い箱に E-PAGE-001 の文を出す。口は 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  mk.state.me = { ...mk.state.me, workspaces: mk.state.me.workspaces.filter((w) => w.tenant_id !== KYOTO_ID) };
  mk.queue("leave", err(404, "E-PAGE-001"));
  await leave(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(kyoto(page)).toHaveCount(0);
  await expect(
    page.getByText("見つかりませんでした。消されたか、見る権限が無いかもしれません", { exact: false }),
  ).toBeVisible();
  expect(mk.count("leave")).toBe(1);
});

test("K841-UI-014 失敗（503）：小窓の中に Kaname の調子が悪い旨の赤い箱・開いたまま・行は残る・もう一度押せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("leave", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await leave(page).click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(kyoto(page)).toHaveCount(1);
  await leave(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("leave")).toBe(2);
});

test("K841-UI-015 二度押し：答えを待つ間は主ボタンが処理中で、続けて押しても口は 1 回", async ({ page }) => {
  const mk = await mockOps(page);
  const release = mk.hold("leave");
  await openAt(page, owner.token, PATH);
  await open(page);
  await leave(page).dblclick();
  await expect.poll(() => mk.count("leave")).toBe(1);
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("leave")).toBe(1);
});

test("K841-UI-016 小窓を「やめる」・Esc で閉じる：口 0 回・行は残る", async ({ page }) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await open(page);
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("leave")).toBe(0);
  await expect(kyoto(page)).toHaveCount(1);
});

test("K841-UI-017 兼務の人でも会社単位で抜ける（D-154.15）：画面は主のグループの名前だけを出し、送る体にグループ・役割の鍵を入れない（体は空）。自分だけの場所の「抜ける」は押せない形で小窓も出ない", async ({
  page,
}) => {
  const base = me();
  const multi = {
    ...base,
    workspaces: base.workspaces.map((w) =>
      w.tenant_id === KYOTO_ID ? { ...w, group: "受託開発", role: "manager" as const } : w,
    ),
  };
  const mk = await mockOps(page, { me: multi });
  await openAt(page, owner.token, PATH);
  await expect(kyoto(page)).toContainText("マネージャー ・ 受託開発");
  const solo = rows(page).nth(1).getByRole("button", { name: "抜ける", exact: true });
  await expect(solo).toHaveAttribute("aria-disabled", "true");
  await solo.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open(page);
  await leave(page).click();
  await expect.poll(() => mk.count("leave")).toBe(1);
  expect(Object.keys(mk.last("leave")!.body ?? {})).toEqual([]);
});

test("K841-UI-018 ［担当を渡しにいく］：別の会社なら押せる形で、押すと switchWorkspace をその会社の id で 1 回（体は空）・200 で /tickets を開く。今いる会社なら切り替えずに /tickets へ移る", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: ASSIGNED });
  const sw = await mockSwitch(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  const go = dlg(page).getByRole("button", { name: "担当を渡しにいく", exact: true });
  await expect(go).not.toHaveAttribute("aria-disabled", "true");
  await go.click();
  await expect(page).toHaveURL(/\/tickets/);
  expect(sw.switches).toEqual([KYOTO_ID]);
  expect(sw.bodies).toEqual([{}]);
  const base = me();
  mk.state.me = {
    ...base,
    workspaces: base.workspaces.map((w, i) =>
      i === 0 ? { ...w, role: "member" as const, last_admin: false, assigned_total: 1, assigned: [TICKETS[0]!] } : w,
    ),
  };
  await openAt(page, owner.token, PATH);
  await rows(page).first().getByRole("button", { name: "抜ける", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "担当を渡しにいく", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets/);
  expect(sw.switches).toEqual([KYOTO_ID]);
});

test("K841-UI-019 ［管理者を決めにいく］：別の会社なら押せる形で、押すと switchWorkspace をその会社の id で 1 回・200 で /members を開く。今いる会社なら切り替えずに /members へ移る", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: LAST });
  const sw = await mockSwitch(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  const go = dlg(page).getByRole("button", { name: "管理者を決めにいく", exact: true });
  await expect(go).not.toHaveAttribute("aria-disabled", "true");
  await go.click();
  await expect(page).toHaveURL(/\/members/);
  expect(sw.switches).toEqual([KYOTO_ID]);
  const base = me();
  mk.state.me = {
    ...base,
    workspaces: base.workspaces.map((w, i) => (i === 0 ? { ...w, role: "admin" as const, last_admin: true } : w)),
  };
  await openAt(page, owner.token, PATH);
  await rows(page).first().getByRole("button", { name: "抜ける", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "管理者を決めにいく", exact: true }).click();
  await expect(page).toHaveURL(/\/members/);
  expect(sw.switches).toEqual([KYOTO_ID]);
});

test("K841-UI-020 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。3 つの形の小窓・100 字の会社名・担当 10 件の一覧でも 0", async ({
  page,
}) => {
  const ten = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    number: `JD-${300 + i}`,
    title: "長い題".repeat(20),
  }));
  const long = "長".repeat(100);
  const mk = await mockOps(page, { me: withKyoto({ name: long, assigned_total: 12, assigned: ten }) });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await rows(page).nth(2).getByRole("button", { name: "抜ける", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await overflowX(page), `担当あり 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
  mk.state.me = withKyoto({ name: long, role: "admin", last_admin: true });
  await openAt(page, owner.token, PATH, 320);
  await rows(page).nth(2).getByRole("button", { name: "抜ける", exact: true }).click();
  expect(await overflowX(page), "最後の管理者").toBeLessThanOrEqual(0);
});

test("K841-UI-021 二重の口なし：小窓を開くだけでは自分を読み直さない（getMe は 1 回）。抜けたあと読み直すのは 1 回だけ", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  expect(mk.count("me")).toBe(1);
  await page.keyboard.press("Escape");
  await open(page);
  expect(mk.count("me")).toBe(1);
  await leave(page).click();
  await expect(kyoto(page)).toHaveCount(0);
  expect(mk.count("me")).toBe(2);
});

test("K841-UI-022 別の会社への切り替えが断られる：404 は小窓を閉じ・自分を 1 回読み直して行が消え・「そのワークスペースには入れません」（仮）・道は変わらない／503 は小窓の中に E-PAGE-003 の文・開いたまま・もう一度押すと切り替わる／二度押しでも切り替えの口は 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: ASSIGNED });
  const sw = await mockSwitch(page);
  const go = () => dlg(page).getByRole("button", { name: "担当を渡しにいく", exact: true });
  await openAt(page, owner.token, PATH);
  await open(page);
  sw.queue(err(503, "E-PAGE-003"));
  await go().click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  const release = sw.hold();
  await go().dblclick();
  await expect.poll(() => sw.switches.length).toBe(2);
  release();
  await expect(page).toHaveURL(/\/tickets/);
  expect(sw.switches).toEqual([KYOTO_ID, KYOTO_ID]);
  await openAt(page, owner.token, PATH);
  await open(page);
  const before = mk.count("me");
  mk.state.me = { ...mk.state.me, workspaces: mk.state.me.workspaces.filter((w) => w.tenant_id !== KYOTO_ID) };
  sw.queue(err(404, "E-PAGE-001"));
  await go().click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(kyoto(page)).toHaveCount(0);
  await expect(page.getByText("そのワークスペースには入れません", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  expect(mk.count("me")).toBe(before + 1);
  expect(sw.switches.length).toBe(3);
});
