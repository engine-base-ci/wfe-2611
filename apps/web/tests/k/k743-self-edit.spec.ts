// K-743「画面：自分で直す（承認の帯の［自分で直す］→ 成果物を直す面 → 保存／やめる・保存した後の 1 行・先に変わっていたとき）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/selfedit-*（代表が OK を出した段 6 の下絵）。字・並び・ボタンは下絵が正。
//   土台は approve-complete.harness.ts の mockApi。直す口 editApproval（K-742）は段 6 の道具 f5-more-kit.ts の layer で重ねる。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  A_OPEN,
  ARTIFACT,
  bandOf,
  detailOf,
  mockApi,
  openTicket,
  pending,
  type Mock,
} from "../features/F5/approve-complete.harness";
import {
  BAND_PAIRS,
  DOWN,
  TICKET,
  WIDTHS,
  layer,
  msg,
  noOverflow,
  noticeOf,
  refuse,
  trailOf,
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const EDIT = /^\/api\/v1\/approvals\/[^/]+\/edit$/;
const MSG = {
  heading: (v: number) => `成果物を直す（版 ${v} をもとに）`,
  note: "直した物は新しい版になり、承認待ちのままです。AI のチェックは残ります",
  saving: "保存しています",
  edited: (v: number) => `成果物は 高本 が直しました（版 ${v}）`,
  trail: (v: number) => `高本が成果物を直しました（版 ${v}）。AI のチェックは残っています`,
  stale: (v: number) => `先にほかの人が成果物を直していました（版 ${v}）。開き直して、続きから直してください`,
} as const;

interface E {
  m: Mock;
  w: Writes;
  artifact: { version: number; text: string } | null;
}
async function mockEdit(page: Page, artifact: E["artifact"] = { version: 1, text: ARTIFACT }): Promise<E> {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  const e: E = { m, w: undefined as unknown as Writes, artifact };
  m.on.detail = () => ({ status: 200, body: { data: detailOf(A_OPEN, { artifact_version: e.artifact }) } });
  e.w = await layer(page, (req, path) => {
    if (req.method() === "POST" && EDIT.test(path)) {
      const b = req.postDataJSON() as { text: string; version: number };
      e.artifact = { version: b.version + 1, text: b.text };
      return {
        status: 201,
        body: { data: { id: A_OPEN, ticket_id: TICKET, version: b.version + 1, edited_at: new Date().toISOString() } },
      };
    }
    return null;
  });
  return e;
}
const selfBtn = (page: Page) => bandOf(page).getByRole("button", { name: "自分で直す", exact: true });
const surface = (page: Page) => page.getByRole("region", { name: "成果物を直す", exact: true });
const box = (page: Page) => surface(page).getByRole("textbox", { name: "成果物の字", exact: true });
const save = (page: Page) => surface(page).getByRole("button", { name: "直して保存する", exact: true });
const quit = (page: Page) => surface(page).getByRole("button", { name: "やめる", exact: true });
const card = (page: Page) => page.getByRole("region", { name: "成果物", exact: true });
const openEdit = async (page: Page) => {
  await selfBtn(page).click();
  await expect(surface(page)).toBeVisible();
};

test("K743-UI-001 入口：承認の帯の「自分で直す」は押せる形で、押すと成果物のカードが消え同じ場所に「成果物を直す」の面（見出し「成果物を直す（版 1 をもとに）」・字の欄に今の字・「直して保存する」「やめる」・注記）。口は増えない", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await expect(selfBtn(page)).toBeEnabled();
  const cardBox = await card(page).boundingBox();
  await openEdit(page);
  await expect(card(page)).toHaveCount(0);
  await expect(surface(page).getByRole("heading", { name: MSG.heading(1), exact: true })).toBeVisible();
  await expect(box(page)).toHaveValue(ARTIFACT);
  await expect(surface(page).getByRole("button")).toHaveText(["直して保存する", "やめる"]);
  await expect(surface(page).getByText(MSG.note, { exact: true })).toBeVisible();
  const s = await surface(page).boundingBox();
  expect(cardBox && s && Math.abs(s.y - cardBox.y) <= 2).toBe(true);
  expect(e.w.all).toEqual([]);
});

test("K743-UI-002 入力：字の欄を空・空白だけ（半角・全角・タブ・改行）にすると「直して保存する」は押せず、1 字書くと押せる", async ({
  page,
}) => {
  await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  for (const blank of ["", " ", "　", "\t", "\n", " 　\t\n "]) {
    await box(page).fill(blank);
    await expect(save(page)).toBeDisabled();
  }
  await box(page).fill("直");
  await expect(save(page)).toBeEnabled();
});

test("K743-UI-003 入力：字を直して「直して保存する」で直す口に 1 回（体は { text: 書いたとおりの字, version: 1 }・前後の空白と改行も削らない）。面が閉じ、カードに「成果物の版 2」と新しい字、カードの下に「成果物は 高本 が直しました（版 2）」", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  const text = `  ${ARTIFACT}\n（10/19 の追加対応は外しました）\n`;
  await box(page).fill(text);
  await save(page).click();
  await expect.poll(() => e.w.of(EDIT).length).toBe(1);
  // 書いた口の控え（f5-more-kit の layer・K-730）は method も持つ（K734・K735 の行と同じ形で見る）
  expect(e.w.of(EDIT)[0]).toEqual({
    method: "POST",
    path: `/api/v1/approvals/${A_OPEN}/edit`,
    body: { text, version: 1 },
  });
  await expect(surface(page)).toHaveCount(0);
  await expect(card(page)).toContainText("成果物の版 2");
  await expect(card(page)).toContainText("（10/19 の追加対応は外しました）");
  await expect(page.getByText(MSG.edited(2), { exact: true })).toBeVisible();
});

test("K743-UI-004 入力：保存した後、承認の帯の箱の下に 1 行「MM/DD HH:MM 高本が成果物を直しました（版 2）。AI のチェックは残っています」。承認の 1 件とやり取りを読み直し、帯は承認待ちのまま", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  const ap0 = e.w.reads(`/api/v1/approvals/${A_OPEN}`);
  const tl0 = e.w.reads(`/api/v1/tickets/${TICKET}/timeline`);
  await openEdit(page);
  await box(page).fill(`${ARTIFACT}。`);
  await save(page).click();
  await expect(trailOf(page)).toHaveCount(1);
  await expect(trailOf(page).locator("time")).toHaveText(/^\d\d\/\d\d \d\d:\d\d$/);
  await expect(trailOf(page)).toContainText(MSG.trail(2));
  await expect.poll(() => e.w.reads(`/api/v1/approvals/${A_OPEN}`)).toBeGreaterThan(ap0);
  await expect.poll(() => e.w.reads(`/api/v1/tickets/${TICKET}/timeline`)).toBeGreaterThan(tl0);
  await expect(bandOf(page).getByRole("button", { name: "承認して送る", exact: true })).toBeVisible();
  const band = await bandOf(page).locator(".k-band").first().boundingBox();
  const t = await trailOf(page).boundingBox();
  expect(band && t && t.y >= band.y + band.height - 1).toBe(true);
});

test("K743-UI-005 操作の揺れ：答えを止めた間に「直して保存する」を 2 回押しても直す口は 1 回。待つ間は「直して保存する」が処理中・注記「保存しています」・「やめる」は押せない", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  await box(page).fill(`${ARTIFACT}。`);
  const release = e.w.hold();
  await save(page).click();
  await expect.poll(() => e.w.of(EDIT).length).toBe(1);
  await save(page).click({ force: true });
  await expect(save(page)).toHaveAttribute("aria-busy", "true");
  await expect(surface(page).getByText(MSG.saving, { exact: true })).toBeVisible();
  await expect(quit(page)).toBeDisabled();
  release();
  await expect(surface(page)).toHaveCount(0);
  expect(e.w.of(EDIT)).toHaveLength(1);
});

test("K743-UI-006 操作：字を書き換えて「やめる」は口を呼ばずに閉じてカード（版 1）に戻り、もう一度「自分で直す」で開くと字の欄は今の成果物の字", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  await box(page).fill("書きかけ");
  await quit(page).click();
  await expect(surface(page)).toHaveCount(0);
  await expect(card(page)).toContainText("成果物の版 1");
  await openEdit(page);
  await expect(box(page)).toHaveValue(ARTIFACT);
  expect(e.w.all).toEqual([]);
});

test("K743-UI-007 失敗：手順 S1 の失敗（409・E-APR-020・current_version 2）は帯の上の知らせ「先にほかの人が成果物を直していました（版 2）。開き直して、続きから直してください」。面は開いたまま見出し「（版 2 をもとに）」・字は残り・「直して保存する」は押せない。承認の 1 件を読み直す", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  await box(page).fill("わたしの直し");
  const ap0 = e.w.reads(`/api/v1/approvals/${A_OPEN}`);
  e.w.next.push({ status: 409, body: { error: "conflict", code: "E-APR-020", current_version: 2 } });
  e.artifact = { version: 2, text: "ほかの人の直し" };
  await save(page).click();
  await expect(noticeOf(page)).toHaveText(MSG.stale(2));
  await expect(surface(page).getByRole("heading", { name: MSG.heading(2), exact: true })).toBeVisible();
  await expect(box(page)).toHaveValue("わたしの直し");
  await expect(save(page)).toBeDisabled();
  await expect.poll(() => e.w.reads(`/api/v1/approvals/${A_OPEN}`)).toBeGreaterThan(ap0);
});

test("K743-UI-008 時間の流れ：E-APR-020 の後に「やめる」→「自分で直す」で、面は新しい版の字と見出し「成果物を直す（版 2 をもとに）」で開き、保存すると体の version は 2", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  await box(page).fill("わたしの直し");
  e.w.next.push({ status: 409, body: { error: "conflict", code: "E-APR-020", current_version: 2 } });
  e.artifact = { version: 2, text: "ほかの人の直し" };
  await save(page).click();
  await expect(noticeOf(page)).toBeVisible();
  await quit(page).click();
  await openEdit(page);
  await expect(surface(page).getByRole("heading", { name: MSG.heading(2), exact: true })).toBeVisible();
  await expect(box(page)).toHaveValue("ほかの人の直し");
  await box(page).fill("ほかの人の直し。続き");
  await save(page).click();
  await expect.poll(() => e.w.of(EDIT).length).toBe(2);
  expect((e.w.of(EDIT)[1]!.body as { version: number }).version).toBe(2);
});

test("K743-UI-009 失敗：手順 S1 の失敗（409・E-APR-021 何も変えていない）は知らせに正本の文「成果物は変わっていません。直してから保存してください」で、面は開いたまま", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  e.w.next.push(refuse(409, "E-APR-021"));
  await save(page).click();
  await expect(noticeOf(page)).toHaveText(msg("E-APR-021"));
  await expect(noticeOf(page)).toHaveText("成果物は変わっていません。直してから保存してください");
  await expect(surface(page)).toBeVisible();
});

test("K743-UI-010 失敗：手順 S1 の失敗（409・E-CONF-003 もう決まっていた）は知らせに正本の文で面が閉じチケットを読み直す。403・503 は知らせに正本の文で面は開いたまま書いた字が残る", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page);
  for (const r of [refuse(403, "FORBIDDEN", "forbidden"), DOWN]) {
    await openEdit(page);
    await box(page).fill("残る字");
    e.w.next.push(r);
    await save(page).click();
    await expect(noticeOf(page)).toHaveText(r.status === 403 ? msg("E-PAGE-002") : msg("E-PAGE-003"));
    await expect(box(page)).toHaveValue("残る字");
    await quit(page).click();
  }
  const t0 = e.w.reads(`/api/v1/tickets/${TICKET}`);
  await openEdit(page);
  await box(page).fill("決まった後");
  e.w.next.push(refuse(409, "E-CONF-003"));
  await save(page).click();
  await expect(noticeOf(page)).toHaveText(msg("E-CONF-003"));
  await expect(surface(page)).toHaveCount(0);
  await expect.poll(() => e.w.reads(`/api/v1/tickets/${TICKET}`)).toBeGreaterThan(t0);
});

test("K743-UI-011 対象の状態：承認の 1 件に成果物が無い（artifact_version が null）なら、「自分で直す」を押しても直す面は開かず、口も呼ばない", async ({
  page,
}) => {
  const e = await mockEdit(page, null);
  await openTicket(page);
  await selfBtn(page).click();
  await expect(surface(page)).toHaveCount(0);
  await expect(card(page)).toHaveCount(0);
  expect(e.w.all).toEqual([]);
});

test("K743-UI-012 守り：成果物の字に <img src=x onerror=alert(1)> があっても字の欄に字のまま入り、保存した字も同じ。img の要素ができず、ダイアログは開かない", async ({
  page,
}) => {
  let alerted = false;
  page.on("dialog", (d) => {
    alerted = true;
    void d.dismiss();
  });
  const bad = "<img src=x onerror=alert(1)>";
  const e = await mockEdit(page, { version: 1, text: bad });
  await openTicket(page);
  await openEdit(page);
  await expect(box(page)).toHaveValue(bad);
  await box(page).fill(`${bad}。`);
  await save(page).click();
  await expect.poll(() => e.w.of(EDIT).length).toBe(1);
  expect((e.w.of(EDIT)[0]!.body as { text: string }).text).toBe(`${bad}。`);
  await expect(page.locator("#k-main img[src='x']")).toHaveCount(0);
  expect(alerted).toBe(false);
});

test("K743-UI-013 入力：とても長い字（空白の無い 20,000 字）も欄に入り、保存すると体の text は 20,000 字（切らない）。幅 375 で横溢れ 0", async ({
  page,
}) => {
  const e = await mockEdit(page);
  await openTicket(page, 375);
  await openEdit(page);
  const long = "あ".repeat(20_000);
  await box(page).fill(long);
  await noOverflow(page, 375);
  await save(page).click();
  await expect.poll(() => e.w.of(EDIT).length).toBe(1);
  expect((e.w.of(EDIT)[0]!.body as { text: string }).text).toHaveLength(20_000);
});

test("K743-UI-014 画面：キーボードだけで、Tab で「自分で直す」に届き Enter で面が開いて焦点は字の欄。Tab で「直して保存する」→「やめる」。Enter で「やめる」を押すと閉じ、焦点は「自分で直す」へ戻る", async ({
  page,
}) => {
  await mockEdit(page);
  await openTicket(page);
  await selfBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(box(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(save(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(quit(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(surface(page)).toHaveCount(0);
  await expect(selfBtn(page)).toBeFocused();
});

test("K743-UI-015 画面：幅 375・768・1440 で直す面は横溢れ 0・字の欄と 2 つのボタンが画面の中", async ({ page }) => {
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockEdit(page);
    await openTicket(page, w);
    await openEdit(page);
    await noOverflow(page, w);
    for (const b of [box(page), save(page), quit(page)]) {
      await b.scrollIntoViewIfNeeded();
      await expect(b).toBeInViewport();
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
const E_PAIRS: FidelityPair[] = [
  ...BAND_PAIRS,
  pair("edit", ".k-more-edit", [
    "width",
    "background-color",
    "border-top-color",
    "border-top-left-radius",
    "padding-top",
  ]),
  pair("edit-title", ".k-more-edit h3", TXT),
  pair("edit-box", ".k-more-edit textarea", ["width", "font-size", "border-top-color"]),
  pair("edit-acts", ".k-more-edit-acts .k-btn", ["height", "font-size", "color", "background-color"]),
  pair("edit-note", ".k-more-edit-note", TXT),
  pair("edited", ".k-more-edited", TXT),
  pair("notice", ".k-band-notice", ["background-color", "border-top-color", "color"]),
];
test("K743-UI-016 画面：下絵との突き合わせ（selfedit-band・selfedit-editing・selfedit-saving・selfedit-saved・selfedit-conflict）。幅 375・768・1440 で承認の帯・直す面・カードの下の 1 行・帯の下の 1 行・帯の上の知らせの形が下絵と同じ", async ({
  browser,
}) => {
  // 本番もモックと同じ幅で開く（前は 1440 で開いて、狭い幅のモックと 1440 の本番を比べていた・K734-UI-018 と同じ直し）
  const drives: [string, (p: Page, w: number) => Promise<void>][] = [
    [
      "selfedit-band",
      async (p, w) => {
        await mockEdit(p);
        await openTicket(p, w);
      },
    ],
    [
      "selfedit-editing",
      async (p, w) => {
        await mockEdit(p);
        await openTicket(p, w);
        await openEdit(p);
      },
    ],
    [
      "selfedit-saving",
      async (p, w) => {
        const e = await mockEdit(p);
        await openTicket(p, w);
        await openEdit(p);
        await box(p).fill(`${ARTIFACT}。`);
        e.w.hold();
        await save(p).click();
        await expect(save(p)).toHaveAttribute("aria-busy", "true");
      },
    ],
    [
      "selfedit-saved",
      async (p, w) => {
        await mockEdit(p);
        await openTicket(p, w);
        await openEdit(p);
        await box(p).fill(`${ARTIFACT}。`);
        await save(p).click();
        await expect(trailOf(p)).toHaveCount(1);
      },
    ],
    [
      "selfedit-conflict",
      async (p, w) => {
        const e = await mockEdit(p);
        await openTicket(p, w);
        await openEdit(p);
        e.w.next.push({ status: 409, body: { error: "conflict", code: "E-APR-020", current_version: 2 } });
        await box(p).fill("わたしの直し");
        await save(p).click();
        await expect(noticeOf(p)).toBeVisible();
      },
    ],
  ];
  for (const [id, drive] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p, w);
        },
        { base: "/dev/mock/f5", pairs: E_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K743-UI-017 守り：面を開く・やめるだけでは書く口 0。書く口は直す口だけで、本人の Bridge に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const e = await mockEdit(page);
  await openTicket(page);
  await openEdit(page);
  await quit(page).click();
  expect(e.w.all).toEqual([]);
  await openEdit(page);
  await box(page).fill(`${ARTIFACT}。`);
  await save(page).click();
  await expect.poll(() => e.w.all.length).toBe(1);
  expect(EDIT.test(e.w.all[0]!.path)).toBe(true);
  expect(bridge).toEqual([]);
});

test("K743-UI-018 入口（ファイルを読む）：先 features/F5/more/fills/self-edit.tsx が SelfEditActFill・ArtifactAreaFill を export し、editApproval は features/F5/self-edit/ からだけ呼ばれる", () => {
  const fill = join(WEB, "features/F5/more/fills/self-edit.tsx");
  expect(existsSync(fill)).toBe(true);
  const src = readFileSync(fill, "utf8");
  for (const n of ["SelfEditActFill", "ArtifactAreaFill"]) expect(src).toMatch(new RegExp(`export function ${n}\\b`));
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const callers = files(join(WEB, "features")).filter((f) => /"editApproval"/.test(readFileSync(f, "utf8")));
  expect(callers.length).toBeGreaterThan(0);
  for (const f of callers) expect(f).toContain(join("features", "F5", "self-edit"));
});
