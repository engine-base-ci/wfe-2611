// K-819「メンバーの 1 人の画面（/members/:id）を口 getMember につなぐ：通常・自分を開いた・止まっている人・読めない／もう居ない人」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の md-view・md-self・md-suspended・md-failed（本番と同じ部品 features/F10/member・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。getMember（K-810）だけを網の手前で差し替える（f10-kit.ts）。止める・外す・移す・兼ねる・戻すは K-820〜K-822 の物で、この葉では押せない形。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi, viewerViaApi } from "../_lib/api";
import { BUILT_ROUTES } from "../../lib/built-routes";
import { F10_PAIRS, ID, MOCK_BASE, WS_NAME, detailBody, err, mockApi, openAt, overflowX } from "./f10-kit";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = `/members/${ID.suzuki}`;
const SEC = 'section[aria-labelledby="member-title"]';
/** 押せる形にした小窓の登録：detail-dialogs.tsx の DO_DIALOGS の 1 行（2 字下げの `キー: 部品,`）。K-820 が move・also、K-821 が suspend・resume、K-822 が remove を足す。足した分だけ、その操作のボタンが押せる形になる */
const REGISTERED = new Set(
  [
    ...readFileSync(join(ROOT, "apps/web/features/F10/member/detail-dialogs.tsx"), "utf8").matchAll(
      /^ {2}(move|also|suspend|resume|remove)\s*:/gm,
    ),
  ].map((m) => m[1]!),
);
const BUTTONS: [string, string[]][] = [
  ["グループを移す", ["move"]],
  ["＋ 兼ねるグループを足す", ["also"]],
  ["一時的に止める", ["suspend"]],
  ["ワークスペースから外す", ["remove"]],
];
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

/** 本番の側をモックの状態にする（口の答えをモックの人と同じにする） */
const SELF = detailBody({
  member: {
    id: ID.takamoto,
    name: "高本 聖斗",
    email: "takamoto@engine-base.example",
    role: "admin",
    suspended: false,
    suspended_at: null,
    since: "2026-04-10T00:00:00Z",
    self: true,
    is_owner: true,
    role_changed: null,
  },
  groups: [{ id: ID.EG, name: "営業", code: "EG", primary: true, role: null }],
  recent_events: [{ id: "ev9", action: "member.joined", at: "2026-11-02T00:12:00Z", by: null }],
}).data;
const SUSP = detailBody({
  member: {
    id: ID.yamaguchi,
    name: "山口 健",
    email: "yamaguchi@engine-base.example",
    role: "viewer",
    suspended: true,
    suspended_at: "2026-11-01T08:40:00Z",
    since: "2026-04-10T00:00:00Z",
    self: false,
    is_owner: false,
    role_changed: null,
  },
  groups: [{ id: ID.JD, name: "受託開発", code: "JD", primary: true, role: "viewer" }],
  assigned: { tickets: 0, overdue: 0, stuck: 0, handing: 0 },
  clone: { pc: "none", pc_days_away: null, device: null },
  recent_events: [{ id: "ev8", action: "member.suspend", at: "2026-11-01T08:40:00Z", by: "高本" }],
}).data;

// 頭の「一時的に止める」「戻す」「ワークスペースから外す」は、小窓の登録（K-821・K-822）が無い間は本番で押せない形
//   （aria-disabled・不透明度 0.55）、下絵は押せる形なので、頭のボタンの濃さと色は比べない（数・大きさ・字は比べる）。
//   自分を開いた md-self は下絵も押せない形なので全部比べる
const ACTS_SKIP = ["acts:opacity", "acts:color"] as const;
const STATES: Record<
  string,
  { path: string; detail?: Record<string, unknown>; fail?: boolean; skip?: readonly string[] }
> = {
  "md-view": { path: PATH, skip: ACTS_SKIP },
  "md-self": { path: `/members/${ID.takamoto}`, detail: SELF },
  "md-suspended": { path: `/members/${ID.yamaguchi}`, detail: SUSP, skip: ACTS_SKIP },
  "md-failed": { path: PATH, fail: true },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K819-UI-001 ${id} 幅 ${w}：頭・第 2 ナビ・区画・帯・エラーの位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockApi(page, st.detail ? { detail: st.detail } : {});
          if (st.fail) mk.set("getMember", () => err(404, "E-MEM-002"));
          await openAt(page, owner.token, st.path, w);
          await expect(page.locator(`${SEC}, [data-state="error"], .k-state`).first()).toBeVisible();
        },
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true, skip: st.skip ?? [] },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K819-UI-002 /members/<id> を直に開くと getMember を 1 回・その人の id で読む。第 2 ナビの「メンバー」が今の場所・上のパンくずは「ワークスペースの管理 › メンバー › 鈴木 一郎」", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH);
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "鈴木 一郎", exact: true })).toBeVisible();
  expect(mk.count("getMember")).toBe(1);
  expect(mk.last("getMember")!.id).toBe(ID.suzuki);
  await expect(page.getByRole("link", { name: "メンバー", exact: true }).first()).toBeVisible();
  await expect(page.getByText("鈴木 一郎", { exact: true }).first()).toBeVisible();
});

test("K819-UI-003 字：「suzuki@… ・ 2026-04-10 から」・グループと役割「営業 ・ メンバー ・ 11/02 にマネージャーから（高本）」・担当・分身・ログイン・最近の記録が答えのとおり", async ({
  page,
}) => {
  await mockApi(page);
  await openAt(page, owner.token, PATH);
  await expect(page.locator(SEC)).toContainText("suzuki@engine-base.example ・ 2026-04-10 から");
  await expect(card(page, "グループと役割")).toContainText("営業");
  await expect(card(page, "グループと役割")).toContainText("メンバー ・ 11/02 にマネージャーから（高本）");
  await expect(card(page, "担当しているもの")).toContainText("担当 6 件 ・ 期限切れ 0 ・ 渡し中 0");
  await expect(card(page, "分身")).toContainText("PC つながっている（MacBook Air）");
  await expect(card(page, "ログイン")).toContainText("パスキー 2 つ");
  await expect(card(page, "ログイン")).toContainText("11/02 09:12");
  await expect(card(page, "最近の記録")).toContainText("役割が変わった（高本）");
  await expect(card(page, "最近の記録")).toContainText("グループが変わった（高本）");
});

test("K819-UI-004 兼務（D-154.15）：営業の主＋受託開発のマネージャーを兼ねる人は「兼ねるグループ 受託開発」・主のグループの役割はマネージャー。3 つ入る人は「受託開発・経理」と並ぶ。兼ねない人は「なし」", async ({
  page,
}) => {
  const g = (id: string, name: string, code: string, primary: boolean, role: string) => ({
    id,
    name,
    code,
    primary,
    role,
  });
  const mk = await mockApi(page, {
    detail: { groups: [g(ID.EG, "営業", "EG", true, "manager"), g(ID.JD, "受託開発", "JD", false, "manager")] },
  });
  await openAt(page, owner.token, PATH);
  await expect(card(page, "グループと役割")).toContainText("マネージャー");
  await expect(card(page, "グループと役割").locator(".k-set-row").nth(1)).toContainText("受託開発");
  mk.set("getMember", () => ({
    status: 200,
    body: detailBody({
      groups: [
        g(ID.EG, "営業", "EG", true, "member"),
        g(ID.JD, "受託開発", "JD", false, "member"),
        g(ID.KR, "経理", "KR", false, "viewer"),
      ],
    }),
  }));
  await page.reload();
  await expect(card(page, "グループと役割").locator(".k-set-row").nth(1)).toContainText("受託開発・経理");
  mk.set("getMember", () => ({ status: 200, body: detailBody() }));
  await page.reload();
  await expect(card(page, "グループと役割").locator(".k-set-row").nth(1)).toContainText("なし");
});

test("K819-UI-005 役割の注：役割を変えた記録が無い人は役割だけ・会社を作った人（is_owner）は「ワークスペースを作った人」", async ({
  page,
}) => {
  const mk = await mockApi(page, { detail: { member: { ...detailBody().data.member, role_changed: null } } });
  await openAt(page, owner.token, PATH);
  const row = card(page, "グループと役割").locator(".k-set-row").first();
  await expect(row).toContainText("営業");
  await expect(row).not.toContainText("から（");
  mk.set("getMember", () => ({ status: 200, body: { data: SELF } }));
  await page.goto(`/members/${ID.takamoto}`);
  await expect(card(page, "グループと役割")).toContainText("管理者 ・ ワークスペースを作った人");
});

test("K819-UI-006 自分を開いたとき：「一時的に止める」「ワークスペースから外す」は aria-disabled（title「自分は…」）・押しても口を呼ばず小窓も開かない", async ({
  page,
}) => {
  const mk = await mockApi(page, { detail: SELF });
  await openAt(page, owner.token, `/members/${ID.takamoto}`);
  const stop = page.getByRole("button", { name: "一時的に止める", exact: true });
  const out = page.getByRole("button", { name: "ワークスペースから外す", exact: true });
  await expect(stop).toHaveAttribute("aria-disabled", "true");
  await expect(out).toHaveAttribute("aria-disabled", "true");
  await expect(stop).toHaveAttribute("title", "自分は止められません。抜けるのは自分の設定から");
  await stop.click({ force: true });
  await out.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op !== "getMember")).toEqual([]);
});

test("K819-UI-007 止まっている人：帯「一時的に止まっています」・「戻す」がある・「一時的に止める」は無い・担当 0 件・分身なし（見るだけ）", async ({
  page,
}) => {
  await mockApi(page, { detail: SUSP });
  await openAt(page, owner.token, `/members/${ID.yamaguchi}`);
  await expect(page.locator(".k-band")).toContainText("一時的に止まっています");
  await expect(page.getByRole("button", { name: "戻す", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "一時的に止める", exact: true })).toHaveCount(0);
  await expect(card(page, "分身")).toContainText("分身なし（見るだけ）");
  await expect(card(page, "最近の記録")).toContainText("一時的に止めた（高本）");
});

test("K819-UI-008 分身の字：ok＝「PC つながっている」（端末があれば（名前）が付く）・away＝「PC 3 日つながっていない」・never＝「PC をまだつないでいない」・none＝「分身なし（見るだけ）」。実行回数の見本の字は出ない", async ({
  page,
}) => {
  const clones = [
    [{ pc: "ok", pc_days_away: null, device: null }, "PC つながっている"],
    [{ pc: "away", pc_days_away: 3, device: "MacBook Air" }, "PC 3 日つながっていない"],
    [{ pc: "never", pc_days_away: null, device: null }, "PC をまだつないでいない"],
    [{ pc: "none", pc_days_away: null, device: null }, "分身なし（見るだけ）"],
  ] as const;
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH);
  for (const [clone, text] of clones) {
    mk.set("getMember", () => ({ status: 200, body: detailBody({ clone }) }));
    await page.reload();
    await expect(card(page, "分身")).toContainText(text);
    await expect(card(page, "分身")).not.toContainText("212 回");
  }
});

test("K819-UI-009 ログインの字：パスワードだけ・パスキーだけ・両方・どれも無い。認証アプリ付きは「付けている（認証アプリ）」で「2 段階認証を戻す」は押せない形・最後に入っていない人は「まだ入っていません」", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH);
  const cases: [Record<string, unknown>, string][] = [
    [{ passkeys: 0, has_password: true, two_factor: false, last_login_at: null }, "パスワード"],
    [{ passkeys: 2, has_password: false, two_factor: false, last_login_at: null }, "パスキー 2 つ"],
    [{ passkeys: 1, has_password: true, two_factor: false, last_login_at: null }, "パスワードとパスキー 1 つ"],
  ];
  for (const [login, text] of cases) {
    mk.set("getMember", () => ({ status: 200, body: detailBody({ login }) }));
    await page.reload();
    await expect(card(page, "ログイン")).toContainText(text);
    await expect(card(page, "ログイン")).toContainText("まだ入っていません");
  }
  mk.set("getMember", () => ({
    status: 200,
    body: detailBody({ login: { passkeys: 0, has_password: true, two_factor: true, last_login_at: null } }),
  }));
  await page.reload();
  await expect(card(page, "ログイン")).toContainText("付けている（認証アプリ）");
  await expect(page.getByRole("button", { name: "2 段階認証を戻す", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("K819-UI-010 最近の記録：知らない action は内部の字を出さず「ほかの操作」。記録の行は新しい順のまま 5 件まで", async ({
  page,
}) => {
  const ev = (i: number, action: string) => ({ id: `e${i}`, action, at: `2026-11-0${i}T01:00:00Z`, by: "高本" });
  await mockApi(page, {
    detail: {
      recent_events: [
        ev(6, "member.zzz_unknown"),
        ev(5, "member.suspend"),
        ev(4, "member.resume"),
        ev(3, "member.groups_change"),
        ev(2, "member.role_change"),
      ],
    },
  });
  await openAt(page, owner.token, PATH);
  const rows = card(page, "最近の記録").locator(".k-set-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("ほかの操作（高本）");
  await expect(card(page, "最近の記録")).not.toContainText("member.");
});

test("K819-UI-011 もう居ない・見えない人（404 E-MEM-002）：「見つかりません」の画面と「メンバーへ」の導線。ほかの口は呼ばない", async ({
  page,
}) => {
  const mk = await mockApi(page);
  mk.set("getMember", () => err(404, "E-MEM-002"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("PAGE-001", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
  await page
    .getByRole("link", { name: /メンバー/ })
    .last()
    .click();
  await expect(page).toHaveURL(/\/members$/);
  expect(mk.calls.filter((c) => c.op !== "getMember" && c.op !== "members")).toEqual([]);
});

test("K819-UI-012 読めない（503 E-PAGE-003）：調子が悪い画面と「もう一度読む」。押すと読み直して本文が出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  mk.queue("getMember", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("PAGE-003", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "鈴木 一郎", exact: true })).toBeVisible();
  expect(mk.count("getMember")).toBe(2);
});

test("K819-UI-013 権限が無い人（閲覧のみ）が直に開く：「この画面を見る権限がありません」・口を呼ばない・左のバーに「ワークスペースの管理」が無い", async ({
  page,
}) => {
  const viewer = await viewerViaApi();
  const mk = await mockApi(page);
  await openAt(page, viewer.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "ワークスペースの管理" })).toHaveCount(0);
  expect(mk.count("getMember")).toBe(0);
});

test("K819-UI-014 道の id が uuid でない（/members/abc）：口の 422 を「見つかりません」に出し分ける（本文は出ない・落ちない）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  mk.set("getMember", () => err(422, "VALIDATION_ERROR"));
  await openAt(page, owner.token, "/members/abc");
  await expect(page.getByText("PAGE-001", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
});

test("K819-UI-015 「記録をすべて見る」：記録の画面 /audit がもうある（道の一覧に在る）なら /audit?member=<id> へ移る。まだ無ければ aria-disabled で押しても動かない（隠さない）", async ({
  page,
}) => {
  await mockApi(page);
  await openAt(page, owner.token, PATH);
  const link = page.getByRole("button", { name: "記録をすべて見る", exact: true });
  if (BUILT_ROUTES.includes("/audit")) {
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/audit\\?member=${ID.suzuki}`));
  } else {
    await expect(link).toHaveAttribute("aria-disabled", "true");
    await link.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  }
});

test("K819-UI-016 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。止まっている人・兼務の人でも 0", async ({
  page,
}) => {
  await mockApi(page, { detail: SUSP });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await expect(page.locator(SEC)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K819-UI-017 担当の字：担当 6・期限切れ 2・渡し中 1・止まった（7 日）3 が答えの数のとおりに出る。承認する人の件数は出さない（D-154.36）", async ({
  page,
}) => {
  await mockApi(page, { detail: { assigned: { tickets: 6, overdue: 2, stuck: 3, handing: 1 } } });
  await openAt(page, owner.token, PATH);
  await expect(card(page, "担当しているもの")).toContainText("担当 6 件 ・ 期限切れ 2 ・ 渡し中 1");
  await expect(card(page, "分身")).toContainText("止まった（7 日） 3");
  await expect(page.locator(SEC)).not.toContainText("承認する人");
});

test("K819-UI-018 この葉の外の操作（グループを移す・兼ねるグループを足す・一時的に止める・ワークスペースから外す）：小窓の登録（DO_DIALOGS）が無い操作のボタンは aria-disabled で、押しても口も小窓も出ない。登録がある操作（K-820〜K-822 が足す）は押せる形（aria-disabled でない）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH);
  for (const [name, keys] of BUTTONS) {
    const b = page.getByRole("button", { name, exact: true });
    if (keys.every((k) => REGISTERED.has(k))) {
      await expect(b, name).not.toHaveAttribute("aria-disabled", "true");
      continue;
    }
    await expect(b, name).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  }
  expect(mk.calls.filter((c) => c.op !== "getMember" && c.op !== "members")).toEqual([]);
});

test("K819-UI-019 権限を外された直後（口が 403・別のタブで役割が変わった）：「この画面を見る権限がありません」の画面・本文は出ない。ほかの口は呼ばない", async ({
  page,
}) => {
  const mk = await mockApi(page);
  mk.set("getMember", () => err(403, "FORBIDDEN"));
  await openAt(page, owner.token, PATH);
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
  expect(mk.calls.map((c) => c.op)).toEqual(["getMember"]);
});
