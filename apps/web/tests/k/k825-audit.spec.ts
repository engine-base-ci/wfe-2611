// K-825「記録の画面（/audit）を口 listAuditEvents につなぐ：開いた直後・ことばで探す・札で絞る・消した（戻すは押せない形）・見つからない・読めない・マネージャーの分だけ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の lg-list・lg-search・lg-filter・lg-deleted・lg-empty・lg-failed・lg-manager（本番と同じ部品 features/F10/ws/log.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。listAuditEvents（K-823・K-850）だけを網の手前で差し替える（f10-ops-kit.ts）。書き出しは作らない（D-154.4）・自分の記録の入口は作らない（D-154.2）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi, viewerViaApi } from "../_lib/api";
import { ID, MOCK_BASE, WS_NAME, openAt, overflowX } from "./f10-kit";
import { DELETED, ENTRIES, LOG_PAIRS, MORE, auditBody, entry, err, jst, mockOps } from "./f10-ops-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const SEC = 'section[aria-labelledby="log-title"]';
const SEARCH = "記録をことばで探す";
const box = (page: Page) => page.getByLabel(SEARCH, { exact: true });
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const rows = (page: Page) => page.locator(`${SEC} .k-f10w-entry`);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

const STATES: Record<string, { path: string; entries?: typeof MORE; scope?: "all" | "groups"; fail?: boolean }> = {
  "lg-list": { path: "/audit" },
  "lg-search": { path: `/audit?q=${encodeURIComponent("鈴木さんの役割を変えたのは誰？")}`, entries: ENTRIES },
  "lg-filter": { path: "/audit?kind=perm", entries: ENTRIES },
  "lg-deleted": { path: "/audit?kind=deleted", entries: DELETED },
  "lg-empty": { path: `/audit?q=${encodeURIComponent("請求書の再発行")}`, entries: [] },
  "lg-failed": { path: "/audit", fail: true },
  "lg-manager": { path: "/audit", entries: ENTRIES, scope: "groups" },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K825-UI-001 ${id} 幅 ${w}：頭・第 2 ナビ・見出し・ことば欄・札・行・字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows: r } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockOps(page, {
            ...(st.entries ? { entries: st.entries } : {}),
            ...(st.scope ? { scope: st.scope } : {}),
          });
          if (st.fail) mk.set("audit", () => err(503, "E-PAGE-003"));
          await openAt(page, owner.token, st.path, w);
          // 読み込み中の箱（.k-state[data-state="loading"]）で比べ始めない（答えが来て本文か誤りの箱が出てから読む）
          await expect(
            page.locator(`${SEC}, [data-state="error"], .k-state:not([data-state="loading"])`).first(),
          ).toBeVisible();
        },
        { pairs: LOG_PAIRS, base: MOCK_BASE, blur: true },
      );
      expect(r.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K825-UI-002 /audit を直に開くと listAuditEvents を 1 回（絞りなし）読む。見出し「記録」・第 2 ナビの「記録」が今の場所・パンくずは「ワークスペースの管理 › 記録」・第 2 ナビの記録の行き先は /audit", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit");
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "記録", exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(MORE.length);
  expect(mk.count("audit")).toBe(1);
  expect(mk.last("audit")!.query).toEqual({});
  await expect(page.getByRole("link", { name: "記録", exact: true }).first()).toHaveAttribute("href", "/audit");
});

test("K825-UI-003 行の字：「11/02 09:58」（日本時間）・「高本 聖斗 が …」・「理由：… ・ iPhone から ・ 本人確認を取り直した」。理由・端末・取り直しが無い行は下の 1 行が無い", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, "/audit");
  const a = rows(page).filter({ hasText: "兼務が終わったため" });
  await expect(a.locator("time")).toHaveText(jst("2026-11-02T00:58:00Z"));
  await expect(a).toContainText("高本 聖斗 が 鈴木 一郎 を 営業 の マネージャー → メンバー にした");
  await expect(a).toContainText("理由：兼務が終わったため ・ iPhone から ・ 本人確認を取り直した");
  await expect(rows(page).filter({ hasText: "高本のAI に" }).locator(".k-inv-sub")).toHaveCount(0);
});

test("K825-UI-004 口の並び（新しい順）のまま出す：画面は並べ替えない。同じ時刻の行も口の順", async ({ page }) => {
  const same = ["s3", "s2", "s1"].map((id) =>
    entry({ id, text: `同じ時刻の行 ${id}`, occurred_at: "2026-11-05T01:00:00.000001Z" }),
  );
  await mockOps(page, { entries: same });
  await openAt(page, owner.token, "/audit");
  await expect(rows(page)).toHaveText([/行 s3/, /行 s2/, /行 s1/]);
});

test("K825-UI-005 札で絞る：「権限が変わった」を押すと kind=perm で読み直し（押した札は aria-pressed）・URL に kind=perm。もう一度押すと絞りなしに戻る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit");
  await chip(page, "権限が変わった").click();
  await expect.poll(() => mk.last("audit")!.query["kind"]).toBe("perm");
  await expect(chip(page, "権限が変わった")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/kind=perm/);
  await chip(page, "権限が変わった").click();
  await expect.poll(() => mk.count("audit")).toBe(3);
  expect(mk.last("audit")!.query["kind"]).toBeUndefined();
  await expect(page).not.toHaveURL(/kind=/);
});

test("K825-UI-006 札は 6 つ（権限が変わった・外に出した・新しい端末で入った・分身に許可した・消した（30 日は戻せる）・運営がしたこと）。「運営がしたこと」は押せない形で口を呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit");
  await expect(page.getByRole("group", { name: "札で絞る", exact: true }).getByRole("button")).toHaveCount(6);
  const ops = chip(page, "運営がしたこと");
  await expect(ops).toHaveAttribute("aria-disabled", "true");
  await ops.click({ force: true });
  expect(mk.count("audit")).toBe(1);
  await expect(page.getByText("書き出す", { exact: false })).toHaveCount(0);
  await expect(page.getByText("ダウンロード", { exact: false })).toHaveCount(0);
});

test("K825-UI-007 「消した」の行：札 deleted で読む・各行に「戻す」があるが押せない形（aria-disabled・title「まだ使えません」・押しても口を呼ばない）", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: DELETED });
  await openAt(page, owner.token, "/audit?kind=deleted");
  const back = page.getByRole("button", { name: "戻す", exact: true });
  await expect(back).toHaveCount(2);
  await expect(back.first()).toHaveAttribute("aria-disabled", "true");
  await expect(back.first()).toHaveAttribute("title", "まだ使えません");
  await back.first().click({ force: true });
  expect(mk.calls.map((c) => c.op)).toEqual(["audit"]);
  await expect(rows(page).first()).toContainText("鈴木 一郎 が チケット EG-120 を消した");
});

test("K825-UI-008 ことばで探す：Enter で q を（前後の空白を削って）送る・URL に q・「N 件見つかりました」。欄を空にして Enter で絞りなしに戻る。欄は 100 字まで", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: ENTRIES });
  await openAt(page, owner.token, "/audit");
  await box(page).fill("  鈴木さんの役割を変えたのは誰？ ");
  await box(page).press("Enter");
  await expect.poll(() => mk.last("audit")!.query["q"]).toBe("鈴木さんの役割を変えたのは誰？");
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText("2 件見つかりました", { exact: true })).toBeVisible();
  await expect(box(page)).toHaveAttribute("maxlength", "100");
  await box(page).fill("");
  await box(page).press("Enter");
  await expect.poll(() => mk.last("audit")!.query["q"]).toBeUndefined();
  await expect(page.getByText("件見つかりました", { exact: false })).toHaveCount(0);
});

test("K825-UI-009 ことばと札を組み合わせる：q と kind を同時に送る。続きがあるときは「N 件以上見つかりました」", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.set("audit", () => ({ status: 200, body: auditBody(ENTRIES, { next_cursor: "2026-10-12T05:20:00.000001Z_x" }) }));
  await openAt(page, owner.token, "/audit?kind=perm&q=鈴木");
  await expect.poll(() => mk.count("audit")).toBe(1); // 開いた直後は口をまだ呼んでいない（描いてから読む）
  expect(mk.last("audit")!.query).toMatchObject({ kind: "perm", q: "鈴木" });
  await expect(page.getByText("2 件以上見つかりました", { exact: true })).toBeVisible();
});

test("K825-UI-010 見つからない（0 件・scan_capped なし）：「見つかりませんでした」「ことばを変えるか、札をはずして探してみてください」。scan_capped が true なら「ここまでしか探していません」の字（仮）", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: [] });
  await openAt(page, owner.token, "/audit?q=請求書の再発行");
  await expect(page.getByText("見つかりませんでした", { exact: true })).toBeVisible();
  await expect(page.getByText("ことばを変えるか、札をはずして探してみてください", { exact: true })).toBeVisible();
  mk.set("audit", () => ({ status: 200, body: auditBody([], { scan_capped: true }) }));
  await page.reload();
  await expect(page.getByText("ここまでしか探していません", { exact: false })).toBeVisible();
});

test("K825-UI-011 続きを読む：next_cursor があれば「続きを読む」・押すと cursor を付けて読み・重ならず下に足す・最後は消える。二度押しでも 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page);
  const p1 = [E1(1), E1(2)];
  const p2 = [E1(3)];
  mk.queue(
    "audit",
    { status: 200, body: auditBody(p1, { next_cursor: "C1" }) },
    { status: 200, body: auditBody(p2, { next_cursor: null }) },
  );
  await openAt(page, owner.token, "/audit");
  await expect(rows(page)).toHaveCount(2);
  const more = page.getByRole("button", { name: "続きを読む", exact: true });
  await more.dblclick();
  await expect(rows(page)).toHaveCount(3);
  expect(mk.count("audit")).toBe(2);
  expect(mk.last("audit")!.query["cursor"]).toBe("C1");
  await expect(more).toHaveCount(0);
});
const E1 = (n: number) => entry({ id: `p${n}`, text: `行 ${n}`, occurred_at: `2026-11-0${n}T01:00:00.000001Z` });

test("K825-UI-012 読めない（503 E-PAGE-003）：調子が悪い画面と「もう一度読む」。押すと読み直して並びが出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("audit", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, "/audit");
  await expect(page.getByText("PAGE-", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(rows(page)).toHaveCount(MORE.length);
  expect(mk.count("audit")).toBe(2);
});

test("K825-UI-013 権限が無い人（403）：「この画面を見る権限がありません」・本文は出ない。依頼する側（閲覧のみ）は口を呼ばずに同じ画面", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.set("audit", () => err(403, "FORBIDDEN"));
  await openAt(page, owner.token, "/audit");
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
  const viewer = await viewerViaApi();
  const mk2 = await mockOps(page);
  await openAt(page, viewer.token, "/audit");
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  expect(mk2.count("audit")).toBe(0);
});

test("K825-UI-014 マネージャー（scope groups）：見出しの下は「自分のグループのチケットと、その人たちの操作の記録」・札が無い・頭と第 2 ナビが無い（パンくずは「記録」だけ）。管理者（scope all）は札と第 2 ナビがある", async ({
  page,
}) => {
  await mockOps(page, { scope: "groups", entries: ENTRIES });
  await openAt(page, owner.token, "/audit");
  await expect(page.locator(SEC)).toContainText("自分のグループのチケットと、その人たちの操作の記録");
  await expect(page.getByRole("group", { name: "札で絞る", exact: true })).toHaveCount(0);
  await expect(page.locator(".k-me-sub")).toHaveCount(0);
  await expect(page.locator(".k-inv-ws")).toHaveCount(0);
  await expect(page.locator(SEC)).toContainText("ワークスペース全体の記録は、管理者だけが見られる");
  await mockOps(page, { scope: "all" });
  await page.reload();
  await expect(page.getByRole("group", { name: "札で絞る", exact: true })).toBeVisible();
  await expect(page.locator(".k-me-sub")).toBeVisible();
});

test("K825-UI-015 兼務（D-154.15）：2 つの層を兼ねるマネージャーの答え（両方のグループの行 7 件）は、グループで切らずそのまま全部出す。範囲外を指した絞りの空の答えは「見つかりませんでした」", async ({
  page,
}) => {
  const seven = Array.from({ length: 7 }, (_, i) =>
    entry({ id: `m${i}`, text: `兼務の分 ${i}`, occurred_at: `2026-11-0${i + 1}T01:00:00.000001Z` }),
  );
  const mk = await mockOps(page, { scope: "groups", entries: seven });
  await openAt(page, owner.token, "/audit");
  await expect(rows(page)).toHaveCount(7);
  mk.set("audit", () => ({ status: 200, body: auditBody([], { scope: "groups" }) }));
  await page.goto(`/audit?member=${ID.kimura}`);
  await expect(page.getByText("見つかりませんでした", { exact: true })).toBeVisible();
});

test("K825-UI-016 メンバーの 1 人の画面から来る：/audit?member=<id>（と ticket=<id>）は口に member_id・ticket_id で渡す。「1 人に絞っています」の札・外すと member_id なしで読み直し・URL から member が消える", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: ENTRIES });
  await openAt(page, owner.token, `/audit?member=${ID.suzuki}&ticket=${ID.EG}`);
  await expect.poll(() => mk.count("audit")).toBe(1); // 開いた直後は口をまだ呼んでいない（描いてから読む）
  expect(mk.last("audit")!.query).toMatchObject({ member_id: ID.suzuki, ticket_id: ID.EG });
  await expect(page.getByText("1 人に絞っています", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "1 人に絞っているのを外す", exact: true }).click();
  await expect.poll(() => mk.last("audit")!.query["member_id"]).toBeUndefined();
  await expect(page).not.toHaveURL(/member=/);
});

test("K825-UI-017 URL の値の確かめ：member・ticket が uuid でない・kind が 6 つのどれでもない・知らない鍵（mine=1 など）は口に送らない（絞りなしで読む）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit?member=abc&ticket=xyz&kind=zzz&mine=1&q=");
  await expect.poll(() => mk.count("audit")).toBe(1); // 開いた直後は口をまだ呼んでいない（描いてから読む）
  expect(mk.last("audit")!.query).toEqual({});
  await expect(rows(page)).toHaveCount(MORE.length);
});

test("K825-UI-018 URL を開き直しても同じ絞り（TP-LIST-03）：?kind=perm&q=鈴木 を直に開くと札が押され・欄に字が入り・口へ同じ値。戻るで 1 つ前の絞りに戻る", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: ENTRIES });
  await openAt(page, owner.token, "/audit");
  await chip(page, "権限が変わった").click();
  await expect(page).toHaveURL(/kind=perm/);
  await page.goBack();
  await expect(page).not.toHaveURL(/kind=/);
  await page.goto("/audit?kind=perm&q=鈴木");
  await expect(chip(page, "権限が変わった")).toHaveAttribute("aria-pressed", "true");
  await expect(box(page)).toHaveValue("鈴木");
  expect(mk.last("audit")!.query).toMatchObject({ kind: "perm", q: "鈴木" });
});

test("K825-UI-019 知らない action：口の「<action> を行った」は内部の字を出さず「ほかの操作を行った」に。text が空でも同じ", async ({
  page,
}) => {
  await mockOps(page, {
    entries: [
      entry({ id: "u1", kind: null, action: "member.zzz_unknown", text: "member.zzz_unknown を行った" }),
      entry({ id: "u2", kind: null, action: "x.y", text: "" }),
    ],
  });
  await openAt(page, owner.token, "/audit");
  await expect(rows(page).nth(0)).toContainText("高本 聖斗 が ほかの操作を行った");
  await expect(rows(page).nth(1)).toContainText("高本 聖斗 が ほかの操作を行った");
  await expect(page.locator(SEC)).not.toContainText("member.zzz_unknown");
  await expect(page.locator(SEC)).not.toContainText("x.y");
});

test("K825-UI-020 起こした人が無い行（actor null）：「ワークスペース が …」とせず「Kaname が …」（仮）。名前が空でも落ちない", async ({
  page,
}) => {
  await mockOps(page, { entries: [entry({ id: "n1", actor: null, text: "ワークスペースの名前を変えた" })] });
  await openAt(page, owner.token, "/audit");
  await expect(rows(page).first()).toContainText("Kaname が ワークスペースの名前を変えた");
});

test("K825-UI-021 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。長い文・長い理由の行・マネージャーの形でも 0", async ({
  page,
}) => {
  const long = entry({
    id: "l1",
    text: `${"とても長い文".repeat(30)}を行った`,
    reason: "長い理由".repeat(40),
    device: "端末".repeat(30),
  });
  const mk = await mockOps(page, { entries: [long, ...MORE] });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, "/audit", w);
    await expect(page.locator(SEC)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
  mk.state.scope = "groups";
  await openAt(page, owner.token, "/audit", 320);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

test("K825-UI-022 二重の口なし：StrictMode でも開いたときの読みは 1 回。札を 1 回押すと読みは 1 回だけ増える（計 2 回）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit");
  await expect(rows(page)).toHaveCount(MORE.length);
  expect(mk.count("audit")).toBe(1);
  await chip(page, "外に出した").click();
  await expect.poll(() => mk.count("audit")).toBe(2);
  await expect(chip(page, "外に出した")).toHaveAttribute("aria-pressed", "true");
  expect(mk.count("audit")).toBe(2);
  expect(mk.last("audit")!.query["kind"]).toBe("out");
});

test("K825-UI-023 権限を外された直後（開いている間に管理者でなくなった・TP-PERM-02）：「続きを読む」の口が 403 になると、本文を「この画面を見る権限がありません」に替える。ほかの口は呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("audit", { status: 200, body: auditBody(ENTRIES, { next_cursor: "C9" }) }, err(403, "FORBIDDEN"));
  await openAt(page, owner.token, "/audit");
  await page.getByRole("button", { name: "続きを読む", exact: true }).click();
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(SEC)).toHaveCount(0);
  expect(mk.calls.map((c) => c.op)).toEqual(["audit", "audit"]);
});

test("K825-UI-024 続きの読みが失敗（503）：すでに出した行は残し、その下に「続きを読めませんでした。もう一度押してください」（仮）。押し直すと続きが出る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("audit", { status: 200, body: auditBody(ENTRIES, { next_cursor: "C2" }) }, err(503, "E-PAGE-003"), {
    status: 200,
    body: auditBody([E1(5)], { next_cursor: null }),
  });
  await openAt(page, owner.token, "/audit");
  await page.getByRole("button", { name: "続きを読む", exact: true }).click();
  await expect(page.getByText("続きを読めませんでした。もう一度押してください", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "続きを読む", exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
});

test("K825-UI-025 記録は追記だけ：画面に消す・直す・書き出すの操作が無い（行に「戻す」以外のボタンが無い・書き出し／ダウンロード／持ち出しの字が無い・書く口を呼ばない）", async ({
  page,
}) => {
  const mk = await mockOps(page, { entries: DELETED });
  await openAt(page, owner.token, "/audit");
  for (const t of ["消す", "直す", "書き出", "持ち出", "ダウンロード", "エクスポート"]) {
    await expect(page.locator(SEC).getByRole("button", { name: new RegExp(t) })).toHaveCount(0);
  }
  expect(mk.calls.every((c) => c.op === "audit")).toBe(true);
});

test("K825-UI-026 取り直し・書く口を使わない：記録の画面は本人確認の小窓を出さない（読むだけ・取り直しは要らない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, "/audit");
  await chip(page, "権限が変わった").click();
  await expect.poll(() => mk.count("audit")).toBe(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(0);
});
