// K-822「メンバーを外す小窓（担当の引き継ぎ先を管理者が選び、すぐ移る）を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の md-remove・md-remove-each・md-remove-none・md-remove-last-admin（本番と同じ部品 features/F10/member/dialog-remove.tsx・代表 OK 2026-11-22）。
//   外すときは管理者が引き継ぎ先を選び、選んだ人にそのまま移る（相手の「受ける」は待たない・D-154.6）。書き出しは無い（D-154.4）。
//   ログイン・外枠・役は本物。メンバーの 1 人（getMember）・外す前の下見（previewMemberRemoval・K-815）・外す（removeMember・K-848）・メンバーの並び・本人確認の取り直しだけを
//   網の手前で差し替える（f10-kit.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import {
  F10_PAIRS,
  ID,
  MOCK_BASE,
  WS_NAME,
  detailBody,
  err,
  mockApi,
  ok,
  openAt,
  overflowX,
  passStepUp,
  person,
  stepDlg,
  toast,
  type Api,
} from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function pick(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const PATH = `/members/${ID.suzuki}`;
const T = {
  a: "0193c5a0-0000-7000-8000-00000000f001",
  b: "0193c5a0-0000-7000-8000-00000000f002",
  c: "0193c5a0-0000-7000-8000-00000000f003",
  d: "0193c5a0-0000-7000-8000-00000000f004",
};
const tk = (id: string, number: string, title: string, stage: string, handing = false) => ({
  id,
  number,
  title,
  stage,
  handing,
});
const TICKETS = [
  tk(T.a, "EG-126", "セイコー様 更新の見積", "確認中"),
  tk(T.b, "EG-129", "契約書の更新版を送る", "未着手"),
  tk(T.c, "EG-131", "セイコー様 来期の提案", "作業中"),
  tk(T.d, "EG-119", "問い合わせ（山田様）に一次返信", "渡し中", true),
];
const preview = (over: Record<string, unknown> = {}, name = "鈴木 一郎", id: string = ID.suzuki) => ({
  member: { id, name },
  blocked_by: null,
  tickets: TICKETS,
  handovers_cancelled: [{ id: "h1", ticket_id: T.d, number: "EG-119", side: "from" }],
  approvals_reassigned: [],
  sole_approver: [],
  deleted: [{ key: "memories", count: 3 }],
  kept: [{ key: "events" }],
  restorable_until: "2026-12-23T09:00:00Z",
  ...over,
});
const dlg = (page: Page) => page.getByRole("dialog", { name: "鈴木 一郎 さんをワークスペースから外す", exact: true });
const outBtn = (page: Page) => page.getByRole("button", { name: "ワークスペースから外す", exact: true });
const goBtn = (page: Page) => dlg(page).getByRole("button", { name: "本人確認して外す", exact: true });
const allSel = (page: Page) => dlg(page).getByRole("combobox", { name: "全部の引き継ぎ先", exact: true });
const mode = (page: Page, label: string) => dlg(page).getByRole("radio", { name: label, exact: true });
const removed = (mk: Api, n = 4) =>
  mk.set("remove", (c) =>
    ok({ member_id: c.id, tickets_moved: n, handovers_cancelled: 1, restorable_until: "2026-12-23T09:00:00Z" }),
  );

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
async function openAs(
  page: Page,
  o: { prev?: Record<string, unknown>; detail?: Record<string, unknown>; path?: string; width?: number } = {},
): Promise<Api> {
  const mk = await mockApi(page, o.detail ? { detail: o.detail } : {});
  mk.set("preview", () => ok(o.prev ?? preview()));
  await openAt(page, owner.token, o.path ?? PATH, o.width ?? 1440);
  await expect(page.locator("section h1").first()).toBeVisible();
  return mk;
}
async function open(page: Page): Promise<void> {
  await outBtn(page).click();
  await expect(dlg(page)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<
  string,
  { prev?: Record<string, unknown>; detail?: Record<string, unknown>; drive: (page: Page) => Promise<void> }
> = {
  "md-remove": { drive: open },
  "md-remove-each": {
    drive: async (page) => {
      await open(page);
      await mode(page, "1 件ずつ決める").click();
    },
  },
  "md-remove-none": { prev: preview({ tickets: [], handovers_cancelled: [] }), drive: open },
  "md-remove-last-admin": {
    prev: preview({ blocked_by: "last_admin" }, "佐藤 花子", ID.sato),
    // 下絵 md-remove-last-admin の佐藤：役割が変わった注は無い（佐藤の役割は変えていない）
    detail: {
      member: { ...detailBody().data.member, id: ID.sato, name: "佐藤 花子", role: "admin", role_changed: null },
    },
    drive: async (page) => {
      await outBtn(page).click();
      await expect(page.locator(".k-callout")).toBeVisible();
    },
  },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K822-UI-001 ${id} 幅 ${w}：小窓の題・引き継ぎ先の選び・チケットの行・注意の箱・すぐ消える／残る・足のボタン（最後の管理者は赤い箱）の字と位置と大きさがモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await openAs(page, {
            ...(st.prev ? { prev: st.prev } : {}),
            ...(st.detail ? { detail: st.detail, path: `/members/${ID.sato}` } : {}),
            width: w,
          });
          await st.drive(page);
        },
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く
test("K822-UI-002 「ワークスペースから外す」（直に ?do=remove でも）：外す前の下見 GET /members/<id>/remove-preview を 1 回・小窓の題「鈴木 一郎 さんをワークスペースから外す」・副題「外すと入れなくなり、鈴木のAI も止まる」・「担当しているチケット 4 件の引き継ぎ先」・チケット 4 行（番号 ・ 段・題）・すぐ消える／残る・「外したことは記録に残る。30 日のあいだは…」。書き出しの案内は無い", async ({
  page,
}) => {
  const mk = await openAs(page);
  await open(page);
  expect(mk.count("preview")).toBe(1);
  expect(mk.last("preview")!.id).toBe(ID.suzuki);
  await expect(dlg(page)).toContainText("外すと入れなくなり、鈴木のAI も止まる");
  await expect(dlg(page)).toContainText("担当しているチケット 4 件の引き継ぎ先");
  await expect(dlg(page).locator(".k-f10d-ticket")).toHaveCount(4);
  await expect(dlg(page).locator(".k-f10d-ticket").first()).toContainText("EG-126 ・ 確認中");
  await expect(dlg(page)).toContainText("すぐ消える（戻せない）");
  await expect(dlg(page)).toContainText("30 日のあいだは同じメールで招き直すと、グループと役割だけ戻る");
  await expect(dlg(page)).not.toContainText("書き出");
  await page.keyboard.press("Escape");
  await page.goto(`${PATH}?do=remove`);
  await expect(dlg(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  expect(mk.count("remove")).toBe(0);
});

test("K822-UI-003 引き継ぎ先の候補：有効で閲覧のみ・依頼する側でない人だけ（佐藤・高本・田中）。外す本人（鈴木）・止めている人・閲覧のみの山口・招待中の人は出ない。兼ねて 2 つのグループに出る佐藤・田中は 1 度だけ。初めの選びは主のグループのマネージャー（佐藤）", async ({
  page,
}) => {
  const mk = await openAs(page);
  mk.w.groups[0]!.members.push(
    person({ id: "0193c5a0-0000-7000-8000-000000000a09", name: "止 太郎", group_role: "member", suspended: true }),
  );
  await page.reload();
  await open(page);
  await allSel(page).click();
  // 選んでいる行（佐藤 花子）には部品が「✓」を描き、toHaveText は字に含めるので末尾で比べる（components/k/select.tsx の ItemIndicator）
  await expect(page.getByRole("option")).toHaveText([/佐藤 花子$/, /高本 聖斗$/, /田中 美咲$/]);
  await page.keyboard.press("Escape");
  await expect(allSel(page)).toContainText("佐藤 花子");
});

// ---------------------------------------------------------------- 外す
test("K822-UI-004 全部を同じ人に：高本を選んで「本人確認して外す」→ removeMember の体は { transfer_to_member_id: 高本 } だけ（transfers は送らない）・POST /members/<id>/remove を 1 回", async ({
  page,
}) => {
  const mk = await openAs(page);
  removed(mk);
  await open(page);
  await pick(page, allSel(page), "高本 聖斗");
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.of("remove")).toHaveLength(1);
  expect(mk.last("remove")!.id).toBe(ID.suzuki);
  expect(mk.last("remove")!.body).toEqual({ transfer_to_member_id: ID.takamoto });
});

test("K822-UI-005 1 件ずつ決める：4 行それぞれに引き継ぎ先の選び（既定は全部の選び）・EG-129 を田中・EG-131 を高本にして外す → 体は { transfers: [{ticket_id, to_member_id} × 4] }（transfer_to_member_id は送らない）。全部を同じ人に戻すと選びが全部の選びに揃う", async ({
  page,
}) => {
  const mk = await openAs(page);
  removed(mk);
  await open(page);
  await mode(page, "1 件ずつ決める").click();
  await expect(dlg(page).getByRole("combobox", { name: /の引き継ぎ先$/ })).toHaveCount(4);
  await pick(page, dlg(page).getByRole("combobox", { name: "EG-129 の引き継ぎ先", exact: true }), "田中 美咲");
  await pick(page, dlg(page).getByRole("combobox", { name: "EG-131 の引き継ぎ先", exact: true }), "高本 聖斗");
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.last("remove")!.body).toEqual({
    transfers: [
      { ticket_id: T.a, to_member_id: ID.sato },
      { ticket_id: T.b, to_member_id: ID.tanaka },
      { ticket_id: T.c, to_member_id: ID.takamoto },
      { ticket_id: T.d, to_member_id: ID.sato },
    ],
  });
});

test("K822-UI-006 担当が 0 件：「担当しているチケットはありません。引き継ぎは要りません」・引き継ぎの区画は出ない・体は {}。外すと /members に戻る", async ({
  page,
}) => {
  const mk = await openAs(page, { prev: preview({ tickets: [], handovers_cancelled: [] }) });
  removed(mk, 0);
  await open(page);
  await expect(dlg(page)).toContainText("担当しているチケットはありません。引き継ぎは要りません");
  await expect(dlg(page).getByRole("combobox", { name: "全部の引き継ぎ先", exact: true })).toHaveCount(0);
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.last("remove")!.body).toEqual({});
});

test("K822-UI-007 渡し中：下見の tickets で渡し中のチケット（EG-119）に注意の箱「渡し中の EG-119 は、外す前に取り消される（佐藤 花子 さんへの渡しは成り立っていない）」。渡し中が無ければ箱は出ない", async ({
  page,
}) => {
  const mk = await openAs(page);
  await open(page);
  await expect(dlg(page).locator(".k-callout")).toHaveCount(1);
  await expect(dlg(page)).toContainText("渡し中の EG-119 は、外す前に取り消される");
  await page.keyboard.press("Escape");
  mk.set("preview", () => ok(preview({ tickets: TICKETS.slice(0, 3), handovers_cancelled: [] })));
  await page.reload();
  await open(page);
  await expect(dlg(page).locator(".k-callout")).toHaveCount(0);
});

test("K822-UI-008 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「鈴木 一郎 をワークスペースから外す前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ removeMember。やめると何も送らず外す小窓に戻る・下見は読み直さない", async ({
  page,
}) => {
  const mk = await openAs(page);
  removed(mk);
  // やめた後の押し直しは送らず取り直しの小窓から・取り直した後に 1 回だけ送る（口 2 回・K-820 の形に揃える PM の決め 2026-11-28）
  mk.queue("remove", err(403, "STEP_UP_REQUIRED"));
  await open(page);
  await goBtn(page).click();
  await expect(stepDlg(page)).toContainText("鈴木 一郎 をワークスペースから外す前に、本人か確かめます");
  expect(mk.count("security")).toBe(1);
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(0);
  await goBtn(page).click();
  await passStepUp(page);
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("remove")).toBe(2);
  expect(mk.count("preview")).toBe(1);
  expect(mk.of("remove")[0]!.body).toEqual(mk.of("remove")[1]!.body);
});

test("K822-UI-009 外せた：/members に移り、知らせ「鈴木 一郎 さんを外しました。担当のチケット 4 件は 佐藤 花子 さんに移りました。30 日のあいだは、同じメールで招き直すと戻せます」・並びを読み直す。外した人は営業の行から消える", async ({
  page,
}) => {
  const mk = await openAs(page);
  removed(mk);
  await open(page);
  mk.w.groups[0]!.members = mk.w.groups[0]!.members.filter((m) => m.id !== ID.suzuki);
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(toast(page)).toContainText(
    "鈴木 一郎 さんを外しました。担当のチケット 4 件は 佐藤 花子 さんに移りました",
  );
  await expect(toast(page)).toContainText("30 日のあいだは、同じメールで招き直すと戻せます");
  await expect(page.locator(".k-f10m-row").filter({ hasText: "鈴木 一郎" })).toHaveCount(0);
});

test("K822-UI-010 兼務（D-154.15）：営業と経理を兼ねる田中を外すと、メンバーの画面で営業の行も経理の行も消える（片方だけ残らない）。1 件ずつの引き継ぎで、別の部署のチケットも引き継ぎ先を選べる", async ({
  page,
}) => {
  const mk = await openAs(page, {
    path: `/members/${ID.tanaka}`,
    detail: { member: { ...detailBody().data.member, id: ID.tanaka, name: "田中 美咲" } },
    prev: preview({}, "田中 美咲", ID.tanaka),
  });
  removed(mk);
  const d = page.getByRole("dialog", { name: "田中 美咲 さんをワークスペースから外す", exact: true });
  await outBtn(page).click();
  await d.getByRole("radio", { name: "1 件ずつ決める", exact: true }).click();
  await expect(d.getByRole("combobox", { name: /の引き継ぎ先$/ })).toHaveCount(4);
  for (const g of mk.w.groups) g.members = g.members.filter((m) => m.id !== ID.tanaka);
  await d.getByRole("button", { name: "本人確認して外す", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
  // 初めは自分の主のグループ（営業）だけが開く（K-710）。経理の行も見るために、見る前に経理を開く
  const acc = page.getByRole("region", { name: "経理", exact: true }).locator(".k-f10m-toggle");
  await acc.click();
  await expect(acc).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".k-f10m-row").filter({ hasText: "田中 美咲" })).toHaveCount(0);
});

// ---------------------------------------------------------------- 外せない・口の断り
test("K822-UI-011 最後の管理者：下見の blocked_by が last_admin なら小窓は開かず、上の赤い箱「外せません」「佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、外してください」・外す口は呼ばない。下見が通ったあとの外す口が 409 E-MEM-004 でも同じ赤い箱（小窓は閉じる）", async ({
  page,
}) => {
  const mk = await openAs(page, {
    path: `/members/${ID.sato}`,
    prev: preview({ blocked_by: "last_admin" }, "佐藤 花子", ID.sato),
    detail: { member: { ...detailBody().data.member, id: ID.sato, name: "佐藤 花子", role: "admin" } },
  });
  await outBtn(page).click();
  await expect(page.locator(".k-callout")).toContainText("外せません");
  await expect(page.locator(".k-callout")).toContainText(
    "佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、外してください",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mk.count("remove")).toBe(0);
  mk.set("preview", () => ok(preview({}, "佐藤 花子", ID.sato)));
  mk.queue("remove", err(409, "E-MEM-004"));
  await page.reload();
  await outBtn(page).click();
  await page.getByRole("button", { name: "本人確認して外す", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".k-callout")).toContainText("外せません");
});

test("K822-UI-012 担当が変わった（409 E-MEM-020）：下見を読み直して小窓のチケットの行が新しくなり、小窓の赤い箱「担当しているチケットが変わりました。もう一度確かめてください」・外すは押し直せる（引き継ぎ先の選びは残る）", async ({
  page,
}) => {
  const mk = await openAs(page);
  await open(page);
  await pick(page, allSel(page), "田中 美咲");
  mk.queue("remove", err(409, "E-MEM-020"));
  mk.set("preview", () => ok(preview({ tickets: TICKETS.slice(0, 2), handovers_cancelled: [] })));
  await goBtn(page).click();
  await expect(dlg(page).getByRole("alert")).toBeVisible();
  await expect(dlg(page).locator(".k-f10d-ticket")).toHaveCount(2);
  await expect(allSel(page)).toContainText("田中 美咲");
  expect(mk.count("preview")).toBe(2);
});

test("K822-UI-013 引き継ぎ先が選べなくなった：404 E-MEM-021（居なくなった）・409 E-MEM-022（止めた・外す本人・detail の名前）・409 E-MEM-023（閲覧のみ・detail の名前）→ 小窓の赤い箱（名前入り）・メンバーの並びを読み直して候補が新しくなる・小窓は閉じず中身は残る", async ({
  page,
}) => {
  const mk = await openAs(page);
  await open(page);
  mk.queue(
    "remove",
    err(404, "E-MEM-021"),
    err(409, "E-MEM-022", { detail: { 名前: "田中 美咲", 訳: "止まっている" } }),
    err(409, "E-MEM-023", { detail: { 名前: "田中 美咲" } }),
  );
  for (let i = 0; i < 3; i++) {
    await goBtn(page).click();
    await expect(dlg(page).getByRole("alert")).toBeVisible();
    await expect.poll(() => mk.count("members")).toBe(2 + i);
  }
  await expect(dlg(page).getByRole("alert")).toContainText("田中 美咲");
  await expect(dlg(page)).toBeVisible();
  expect(mk.count("remove")).toBe(3);
});

test("K822-UI-014 もう居ない（404 E-MEM-002・下見でも外す口でも）：小窓を閉じて「見つかりません」の画面。503・403（下見・外す）：下見が落ちたら小窓は開かず赤い箱「確かめられませんでした」・外す口が落ちたら小窓の赤い箱・押し直せる", async ({
  page,
}) => {
  const mk = await openAs(page);
  mk.queue("preview", err(503, "E-PAGE-003"));
  await outBtn(page).click();
  await expect(page.locator(".k-callout")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open(page);
  mk.queue("remove", err(503, "E-PAGE-003"), err(403, "FORBIDDEN"));
  await goBtn(page).click();
  await expect(dlg(page).getByRole("alert")).toBeVisible();
  await goBtn(page).click();
  await expect(dlg(page).getByRole("alert")).toBeVisible();
  removed(mk);
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.count("remove")).toBe(3);
});

test("K822-UI-015 外す確かめの二度押し：答えを待つ間「本人確認して外す」は押せない・口は 1 回・「やめる」も押せない（途中でやめて二重にならない）", async ({
  page,
}) => {
  const mk = await openAs(page);
  removed(mk);
  const release = mk.hold("remove");
  await open(page);
  await goBtn(page).click();
  await expect(goBtn(page)).toBeDisabled();
  await goBtn(page).click({ force: true });
  release();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.count("remove")).toBe(1);
});

test("K822-UI-016 自分を開いたとき：「ワークスペースから外す」は aria-disabled（title「自分は外せません。抜けるのは自分の設定から」）・?do=remove でも開かない・下見も外す口も 0 回。やめる・Esc：口 0 回・焦点は「ワークスペースから外す」に戻る", async ({
  page,
}) => {
  const mk = await openAs(page, {
    path: `/members/${ID.takamoto}?do=remove`,
    detail: { member: { ...detailBody().data.member, id: ID.takamoto, name: "高本 聖斗", self: true, role: "admin" } },
  });
  const b = outBtn(page);
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await expect(b).toHaveAttribute("title", "自分は外せません。抜けるのは自分の設定から");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await b.click({ force: true });
  expect(mk.count("preview")).toBe(0);
  await openAs(page);
  await open(page);
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(outBtn(page)).toBeFocused();
  await open(page);
  await page.keyboard.press("Escape");
  await expect(outBtn(page)).toBeFocused();
  expect(mk.count("remove")).toBe(0);
});

test("K822-UI-017 幅 320・375・768・1024・1440：全部／1 件ずつ／担当 0 件の小窓を開いても横のはみ出し 0（数値）・足のボタンが画面の中に収まり押せる（高さ 32px 以上）", async ({
  page,
}) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAs(page, { width: w });
    await open(page);
    expect(await overflowX(page), `全部 幅 ${w}`).toBeLessThanOrEqual(0);
    await mode(page, "1 件ずつ決める").click();
    expect(await overflowX(page), `1 件ずつ 幅 ${w}`).toBeLessThanOrEqual(0);
    const r = (await goBtn(page).boundingBox())!;
    expect(r.x + r.width, `幅 ${w}`).toBeLessThanOrEqual(w);
    expect(r.height).toBeGreaterThanOrEqual(32);
    await page.keyboard.press("Escape");
    await openAs(page, { width: w, prev: preview({ tickets: [], handovers_cancelled: [] }) });
    await open(page);
    expect(await overflowX(page), `0 件 幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
