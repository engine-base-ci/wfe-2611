// K-745「画面：差し戻す小窓で『次は誰が直すか』（AI／自分）を選ぶ・自分を選んで差し戻した後の帯と 1 行」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/return-*（代表が OK を出した段 6 の下絵）。字・並びは下絵が正。
//   土台は approve-complete.harness.ts の mockApi（差し戻しの口 m.returns・m.on.ret）。自分で直すの答え（run_id null・K-744）は m.on.ret を差し替える。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import {
  A_OPEN,
  bandOf,
  k62Band,
  mockApi,
  openQueue,
  openTicket,
  pending,
  rowOf,
  ticketOf,
  type Mock,
} from "../features/F5/approve-complete.harness";
import {
  BAND_PAIRS,
  DIALOG_PAIRS,
  DOWN,
  SHEET_GAP,
  TICKET,
  WIDTHS,
  dialogOf,
  layer,
  msg,
  noOverflow,
  refuse,
  trailOf,
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const AI = "AI に直させる（作り直しを任せます）";
const SELF = "自分で直す（チケットは作業中に戻ります）";
const REASON = "10/19 の追加対応は無償なので外してください";

interface R {
  m: Mock;
  w: Writes;
}
/** 承認待ち（承認する人）。差し戻すと体が next_actor self なら run_id null で作業中、無ければ土台の答え（作り直しの実行） */
async function mockReturn(page: Page): Promise<R> {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  m.on.ret = (req) => {
    const b = req.postDataJSON() as { next_actor?: string };
    const self = b.next_actor === "self";
    m.on.ticket = () => ({
      status: 200,
      body: {
        data: ticketOf(
          self
            ? { stage: "doing", can_delegate: true }
            : { stage: "running", run: { phase: "make", status: "queued", pc: "live" } },
        ),
      },
    });
    return {
      status: 201,
      body: {
        data: {
          id: A_OPEN,
          decision: "return",
          decided_at: new Date().toISOString(),
          status_id: "returned",
          ticket_id: TICKET,
          run_id: self ? null : "0193c5a0-0000-7000-8000-0000000e0002",
          pc: "live",
        },
      },
    };
  };
  const w = await layer(page, () => null);
  return { m, w };
}
const openRet = async (page: Page) => {
  await bandOf(page).getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(dialogOf(page)).toBeVisible();
};
const who = (page: Page) => dialogOf(page).getByRole("group", { name: "次は誰が直すか", exact: true });
const reason = (page: Page) => dialogOf(page).getByRole("textbox", { name: "差し戻す理由", exact: true });
const send = (page: Page) =>
  dialogOf(page).locator(".k-dialog-actions").getByRole("button", { name: "差し戻す", exact: true });

test("K745-UI-001 入口：詳細の承認の帯の「差し戻す」の小窓に、対象の行・理由（必須）・group「次は誰が直すか」の丸 2 つ（AI に印・自分は印なし・どちらも押せる）。選ぶ欄と四角は無い", async ({
  page,
}) => {
  await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  const d = dialogOf(page);
  await expect(d.locator(".k-dialog-target")).toHaveText("EG-133 11 月分の請求書を送る");
  await expect(reason(page)).toBeVisible();
  await expect(who(page).getByRole("radio")).toHaveCount(2);
  await expect(who(page).getByRole("radio", { name: AI, exact: true })).toBeChecked();
  await expect(who(page).getByRole("radio", { name: SELF, exact: true })).not.toBeChecked();
  for (const n of [AI, SELF]) await expect(who(page).getByRole("radio", { name: n, exact: true })).toBeEnabled();
  await expect(d.getByRole("combobox")).toHaveCount(0);
  await expect(d.getByRole("checkbox")).toHaveCount(0);
});

test("K745-UI-002 入力：理由を書いて AI のまま「差し戻す」と、差し戻しの口に 1 回・体は { note } だけ。小窓が閉じ、帯の下の 1 行も作業中の箱も出ない", async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  await reason(page).fill(REASON);
  await send(page).click();
  await expect.poll(() => r.m.returns.length).toBe(1);
  expect(r.m.returns[0]).toEqual({ id: A_OPEN, body: { note: REASON } });
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(trailOf(page)).toHaveCount(0);
  await expect(k62Band(page).getByRole("heading", { name: /差し戻しました/ })).toHaveCount(0);
});

test('K745-UI-003 入力：「自分で直す」を選んで「差し戻す」と、差し戻しの口に 1 回・体は { note, next_actor: "self" }', async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  await reason(page).fill(REASON);
  await who(page).getByRole("radio", { name: SELF, exact: true }).check();
  await send(page).click();
  await expect.poll(() => r.m.returns.length).toBe(1);
  expect(r.m.returns[0]).toEqual({ id: A_OPEN, body: { note: REASON, next_actor: "self" } });
});

test("K745-UI-004 対象の状態：自分で直すの答え（run_id null）の後、作業中の帯に白い箱「差し戻しました。次は 高本 が直します」・要約「理由：…」、その下に 1 行「MM/DD HH:MM 高本が差し戻しました（直すのは自分）」。やり取りを読み直す", async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  const tl0 = r.w.reads(`/api/v1/tickets/${TICKET}/timeline`);
  await openRet(page);
  await reason(page).fill(REASON);
  await who(page).getByRole("radio", { name: SELF, exact: true }).check();
  await send(page).click();
  const band = k62Band(page);
  await expect(band.getByRole("heading", { name: "差し戻しました。次は 高本 が直します", exact: true })).toBeVisible();
  await expect(band.getByText(`理由：${REASON}`, { exact: true })).toBeVisible();
  await expect(trailOf(page)).toHaveCount(1);
  await expect(trailOf(page).locator("time")).toHaveText(/^\d\d\/\d\d \d\d:\d\d$/);
  await expect(trailOf(page)).toContainText("高本が差し戻しました（直すのは自分）");
  await expect.poll(() => r.w.reads(`/api/v1/tickets/${TICKET}/timeline`)).toBeGreaterThan(tl0);
});

test("K745-UI-005 入力：理由が空・空白だけで「差し戻す」は口を呼ばず、欄の下に「差し戻す理由を書いてください」・小窓は開いたまま", async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  for (const v of ["", " 　\n"]) {
    await reason(page).fill(v);
    await send(page).click();
    await expect(dialogOf(page).getByText(msg("E-VAL-020"), { exact: true })).toBeVisible();
    await expect(dialogOf(page).getByText("差し戻す理由を書いてください", { exact: true })).toBeVisible();
  }
  await expect(dialogOf(page)).toBeVisible();
  expect(r.m.returns).toHaveLength(0);
});

test("K745-UI-006 操作：「自分で直す」を選んで「やめる」→ もう一度「差し戻す」で開くと、印は AI に戻る（持ち越さない）・口 0", async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  await who(page).getByRole("radio", { name: SELF, exact: true }).check();
  await dialogOf(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await openRet(page);
  await expect(who(page).getByRole("radio", { name: AI, exact: true })).toBeChecked();
  expect(r.m.returns).toHaveLength(0);
});

test('K745-UI-007 入口：承認待ちの一覧の行の「差し戻す」でも同じ丸 2 つの小窓。「自分で直す」で送ると体は { note, next_actor: "self" } で一覧を読み直し、帯の箱・1 行は出さない', async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openQueue(page);
  const reads = r.m.queueReads;
  await rowOf(page, "応募文を出す").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(who(page).getByRole("radio")).toHaveCount(2);
  await reason(page).fill(REASON);
  await who(page).getByRole("radio", { name: SELF, exact: true }).check();
  await send(page).click();
  await expect.poll(() => r.m.returns.length).toBe(1);
  expect(r.m.returns[0]!.body).toEqual({ note: REASON, next_actor: "self" });
  await expect.poll(() => r.m.queueReads).toBeGreaterThan(reads);
  await expect(trailOf(page)).toHaveCount(0);
});

test("K745-UI-008 失敗：手順 S1 の失敗（409・E-CONF-003／503）は今のまま小窓が閉じ、帯の知らせに正本の文。作業中の箱・1 行は出ない", async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  for (const [rep, text] of [
    [refuse(409, "E-CONF-003"), msg("E-CONF-003")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    r.m.on.ret = () => rep;
    await openRet(page);
    await reason(page).fill(REASON);
    await who(page).getByRole("radio", { name: SELF, exact: true }).check();
    await send(page).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(bandOf(page).getByRole("alert")).toContainText(text);
    await expect(trailOf(page)).toHaveCount(0);
  }
});

test('K745-UI-009 画面：キーボードだけで、理由の欄から Tab で丸の組に届き ↓ で「自分で直す」に印が移り、Tab で「やめる」「差し戻す」へ。Enter で送ると体に next_actor: "self"', async ({
  page,
}) => {
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  await reason(page).fill(REASON);
  await reason(page).focus();
  await page.keyboard.press("Tab");
  await expect(who(page).getByRole("radio", { name: AI, exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(who(page).getByRole("radio", { name: SELF, exact: true })).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(dialogOf(page).getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(send(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => r.m.returns.length).toBe(1);
  expect((r.m.returns[0]!.body as { next_actor?: string }).next_actor).toBe("self");
});

test("K745-UI-010 画面：幅 375・768・1440 で小窓は横溢れ 0・丸 2 つと足の 2 つが画面の中。375 では小窓の下の端が画面の下の端から 16px（±1・下絵の下から出す形の余白）", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockReturn(page);
    await openTicket(page, w);
    await openRet(page);
    await noOverflow(page, w);
    for (const b of [
      ...(await who(page).getByRole("radio").all()),
      ...(await dialogOf(page).locator(".k-dialog-actions").getByRole("button").all()),
    ])
      await expect(b).toBeInViewport();
    if (w === 375) {
      const r = await dialogOf(page).boundingBox();
      // 画面の高さは openTicket が決めた値で見る（812 と決め打ちしない・K734-UI-017 と同じ）
      const vh = page.viewportSize()!.height;
      expect(r && Math.abs(vh - (r.y + r.height) - SHEET_GAP) <= 1).toBe(true);
    }
  }
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const R_PAIRS: FidelityPair[] = [
  ...DIALOG_PAIRS,
  pair("field", ".k-dialog textarea", ["width", "font-size", "border-top-color"]),
  pair("legend", ".k-dialog-group legend", TXT),
  pair("choice", ".k-dialog-group .k-dialog-check", [...TXT, "texts"]),
  pair("err", ".k-dialog .k-err", TXT),
];
test("K745-UI-011 画面：下絵との突き合わせ（return-modal・return-modal-self・return-error・return-self-band）。幅 375・768・1440 で小窓（題・欄・丸の組・足・誤りの字）と作業中の箱と帯の下の 1 行の形が下絵と同じ", async ({
  browser,
}) => {
  // 本番もモックと同じ幅で開く（前は 1440 で開いて、狭い幅のモックと 1440 の本番を比べていた・K734-UI-018 と同じ直し）
  const drives: [string, (p: Page, w: number) => Promise<void>, FidelityPair[]][] = [
    [
      "return-modal",
      async (p, w) => {
        await mockReturn(p);
        await openTicket(p, w);
        await openRet(p);
        await reason(p).fill(REASON);
      },
      R_PAIRS,
    ],
    [
      "return-modal-self",
      async (p, w) => {
        await mockReturn(p);
        await openTicket(p, w);
        await openRet(p);
        await reason(p).fill(REASON);
        await who(p).getByRole("radio", { name: SELF, exact: true }).check();
      },
      R_PAIRS,
    ],
    [
      "return-error",
      async (p, w) => {
        await mockReturn(p);
        await openTicket(p, w);
        await openRet(p);
        await send(p).click();
      },
      R_PAIRS,
    ],
    [
      "return-self-band",
      async (p, w) => {
        await mockReturn(p);
        await openTicket(p, w);
        await openRet(p);
        await reason(p).fill(REASON);
        await who(p).getByRole("radio", { name: SELF, exact: true }).check();
        await send(p).click();
        await expect(trailOf(p)).toHaveCount(1);
      },
      BAND_PAIRS,
    ],
  ];
  for (const [id, drive, pairs] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p, w);
        },
        { base: "/dev/mock/f5", pairs, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K745-UI-012 守り：理由に <img src=x onerror=alert(1)> を書いても体の note は書いたとおりで、作業中の箱の要約に字のまま出て img ができず、ダイアログは開かない", async ({
  page,
}) => {
  let alerted = false;
  page.on("dialog", (d) => {
    alerted = true;
    void d.dismiss();
  });
  const bad = "<img src=x onerror=alert(1)>";
  const r = await mockReturn(page);
  await openTicket(page);
  await openRet(page);
  await reason(page).fill(bad);
  await who(page).getByRole("radio", { name: SELF, exact: true }).check();
  await send(page).click();
  await expect.poll(() => r.m.returns.length).toBe(1);
  expect((r.m.returns[0]!.body as { note: string }).note).toBe(bad);
  await expect(k62Band(page).getByText(`理由：${bad}`, { exact: true })).toBeVisible();
  await expect(page.locator("#k-main img[src='x']")).toHaveCount(0);
  expect(alerted).toBe(false);
});
