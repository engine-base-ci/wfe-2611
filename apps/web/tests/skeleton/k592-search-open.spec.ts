// K-592 中間テスト（段 8・M2）：探す（チケット K-468・会話 K-469・決定と空のナレッジ K-470）→ 結果を押して開く（K-471）を、本物のブラウザ・本物の DB・本物の口でつなぐ。
//   中の 1 本 1 本の分岐（そろえ方・上位 5 件・見える範囲・矢印キー・失敗の出し方）は単体（K-468〜K-470 の口の試験・K-471 の画面の試験）が持つ。ここはつないだときだけ出るもの。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。人は newcomer.ts（画面とメール）、2 人目は prep.ts の teammate（ブラウザなし）。
//   道具は K-591 が持ち込む _lib/f7-flow.ts を読むだけ。決定と会話は DB に直に置く（それを書く画面は F5・F9・段 7 の物で、ここでは探す側だけを見る）。
//   固定の待ちは置かない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { SEARCH_RE, answered, openTicket, searchFor, ticketFacts, ticketFor } from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp } from "../_lib/newcomer";
import { teammate } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 92);
});

/** 文言（K-471 の仕様の表・モック f7-search-* から。実装から書かない） */
const MSG = {
  noKnowledge: "ナレッジのページはまだありません",
  noHit: (q: string) => `「${q}」に合うものがありません`,
};
const mark = (): string => `ZQ${randomUUID().slice(0, 6)}`;

/** 登録した人と、探せる材料（チケット 2・決定 1・会話 1）。字は筋ごとに別（ほかの筋・前の回に当たらない） */
async function seeded(page: Page, tag: string) {
  const me = await newcomer(page, box, tag);
  const key = mark();
  const t1 = await ticketFor(page, me, { title: `${key} 請求書を送る` });
  const t2 = await ticketFor(page, me, { title: `${key} 見積を作る` });
  const [d] = await admin<{ id: string }>(
    "insert into ticket_decisions (tenant_id, ticket_id, text, reason, decided_by) select tenant_id, id, $2, $3, $4 from tickets where id = $1 returning id",
    [t1, `${key} 請求は月末にまとめて送る`, "月ごとの手間を減らすため", me.memberId],
  );
  const [c] = await admin<{ id: string }>("select app.agent_new_conversation($1, false) as id", [me.memberId]);
  await admin("update conversations set title = $2 where id = $1", [c!.id, `${key} 請求の相談`]);
  return { me, key, t1, t2, decision: d!.id, conv: c!.id };
}
const pathAndHash = (page: Page): string => {
  const u = new URL(page.url());
  return `${u.pathname}${u.search}${u.hash}`;
};
/** 箱の入力に焦点を戻して全選択し、打ち直す（札を押すと焦点は札のボタンにある）。口の答え（字が変わるたびに 1 回）を待って 200 を確かめる */
async function retype(page: Page, found: ReturnType<Page["getByRole"]>, text: string): Promise<void> {
  await found.getByRole("textbox").click();
  await page.keyboard.press("ControlOrMeta+A");
  const answer = answered(page, "GET", SEARCH_RE);
  await page.keyboard.type(text);
  expect((await answer).status(), "字が変わると探し直す").toBe(200);
}
const hitLink = (box: ReturnType<Page["getByRole"]>, text: string) => box.getByRole("link").filter({ hasText: text });

test("K592-M2-01 題名で探して開く：打つとチケット 2 件が出て、押すとそのチケットの詳細が開く（箱は閉じる）", async ({
  page,
}) => {
  const s = await seeded(page, "題名");
  await page.goto("/tickets");
  const found = await searchFor(page, `${s.key} 請求書`);
  const hit = hitLink(found, `${s.key} 請求書を送る`);
  await expect(hit, "題名に当たったチケットの行").toHaveCount(1);
  await expect(
    found.getByRole("link").filter({ hasText: `${s.key} 見積を作る` }),
    "当たらない題名は出ない",
  ).toHaveCount(0);
  await expect(found.getByRole("heading", { name: "チケット" })).toBeVisible();
  await hit.click();
  await expect.poll(() => new URL(page.url()).pathname, "押した行のチケットの詳細へ").toBe(`/tickets/${s.t1}`);
  await expect(page.getByRole("heading", { level: 1, name: `${s.key} 請求書を送る` })).toBeVisible();
  await expect(page.getByRole("region", { name: "探す", exact: true }), "開いたら箱は閉じる").toHaveCount(0);
});

test("K592-M2-02 番号で探す：番号を全角・小文字・前後の空白つきで打っても、同じチケットに当たって開く（そろえ方は口の側）", async ({
  page,
}) => {
  const s = await seeded(page, "番号");
  const { number } = await ticketFacts(s.t2);
  const odd = `\u3000${number.toLowerCase().replace(/[0-9A-Za-z-]/g, (c) => (c === "-" ? "－" : String.fromCharCode(c.charCodeAt(0) + 0xfee0)))} `;
  await page.goto("/tickets");
  const found = await searchFor(page, odd);
  const hit = hitLink(found, `${s.key} 見積を作る`);
  await expect(hit, "番号に当たったチケットの行（頭に番号）").toHaveCount(1);
  await expect(hit).toContainText(number);
  await hit.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/tickets/${s.t2}`);
});

test("K592-M2-03 決定：決めたことの字で探すと「決定」の組に出て、押すとそのチケットの詳細の決定の位置（#sec-decisions）が開く", async ({
  page,
}) => {
  const s = await seeded(page, "決定");
  await page.goto("/tickets");
  const found = await searchFor(page, `${s.key} 請求は月末`); // 決定の文と続いた形（口は text・reason の部分一致）
  await expect(found.getByRole("heading", { name: "決定" })).toBeVisible();
  const hit = hitLink(found, "月末にまとめて送る");
  await expect(hit).toHaveCount(1);
  await expect(hit, "右端に「番号 ・ チケットの題名」").toContainText(`${s.key} 請求書を送る`);
  await hit.click();
  await expect.poll(() => pathAndHash(page), "決定の位置へ").toBe(`/tickets/${s.t1}#sec-decisions`);
  await expect(page.getByRole("heading", { level: 1, name: `${s.key} 請求書を送る` })).toBeVisible();
});

test("K592-M2-04 自分の会話：会話の名前で探すと「会話」の組に出て、押すとその会話（/ai/chat?c=<id>）が開く。同じ会社の別の人の会話は出ない", async ({
  page,
}) => {
  const s = await seeded(page, "会話");
  const mate = await teammate(s.me, "同僚の会話");
  const [mc] = await admin<{ id: string }>("select app.agent_new_conversation($1, false) as id", [mate.memberId]);
  // 探す字は題と続いた形（口は q 全体の部分一致）。同僚の題も同じ字を含めて、「同じ字に当たるのに出ない」ことで見える範囲を確かめる
  await admin("update conversations set title = $2 where id = $1", [mc!.id, `${s.key} 請求の相談 同僚用`]);
  await page.goto("/tickets");
  const found = await searchFor(page, `${s.key} 請求の相談`);
  await expect(found.getByRole("heading", { name: "会話" })).toBeVisible();
  await expect(hitLink(found, "同僚用"), "同じ字に当たるほかの人の会話は出ない").toHaveCount(0);
  const mine = hitLink(found, `${s.key} 請求の相談`);
  await expect(mine, "自分の会話だけ（同僚の分が混ざれば 2 件になる）").toHaveCount(1);
  await mine.click();
  await expect.poll(() => pathAndHash(page), "会話の画面へ").toBe(`/ai/chat?c=${s.conv}`);
});

test("K592-M2-05 ナレッジは 0 件：札「ナレッジ」を押すと案内が出て「すべて」には出ない。何にも合わない字は案内と説明を出し、打ち足すと探し直す", async ({
  page,
}) => {
  const s = await seeded(page, "ナレッジ");
  await page.goto("/tickets");
  const found = await searchFor(page, s.key);
  await expect(found.getByRole("heading", { name: "ナレッジ" }), "「すべて」にナレッジの組は出ない").toHaveCount(0);
  await found.getByRole("button", { name: "ナレッジ", exact: true }).click();
  await expect(found.getByRole("button", { name: "ナレッジ", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(found).toContainText(MSG.noKnowledge);
  await found.getByRole("button", { name: "すべて", exact: true }).click();
  await expect(found).not.toContainText(MSG.noKnowledge);
  // 合うものが無い字 → 案内。打ち足して探し直すと戻る（口は字が変わるたびに 1 回）
  const none = `${s.key}ありえない`;
  await retype(page, found, none);
  await expect(found).toContainText(MSG.noHit(none));
  await retype(page, found, `${s.key} 請求書`);
  await expect(hitLink(found, `${s.key} 請求書を送る`)).toHaveCount(1);
});

test("K592-M2-06 消したものは出ない：消したチケットは、探しても出ず、探した結果の押して開く道も残らない（消す前は出る）", async ({
  page,
}) => {
  const s = await seeded(page, "消した");
  await page.goto("/tickets");
  let found = await searchFor(page, `${s.key} 見積`);
  await expect(hitLink(found, `${s.key} 見積を作る`), "消す前は出る").toHaveCount(1);
  await page.keyboard.press("Escape");
  await admin("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [s.t2, s.me.memberId]);
  await page.reload();
  found = await searchFor(page, `${s.key} 見積`);
  await expect(found, "消したチケットは出ない").toContainText(MSG.noHit(`${s.key} 見積`));
  await expect(hitLink(found, `${s.key} 見積を作る`)).toHaveCount(0);
  await openTicket(page, s.t1, `${s.key} 請求書を送る`);
});
