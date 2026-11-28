// K-260「作った後に詳細へ移り切る前に開き直すと goto が取り消される揺れ」の画面の試験（実 Chrome・口は網の手前で差し替える）。
//   CI の VM が遅いときの形（詳細の画面の JS が遅れて届き、開き直しの文書の答えも遅い）を網の手前で作り、
//   作る画面の試験が使う待ち方（create-mock.ts の settledDetail）で待ってから鍵を消して開き直すと、開き直しが 200 で終わることを見る。
//   settledDetail が URL の移りだけを待つ形（直す前の K224-UI-028 の待ち方）なら、詳細の画面がログインへ移して goto が ERR_ABORTED になり赤になる。
//   遅らせるのは網の手前の答え（遅いサーバーの代わり）で、試験の手順は決めた時間を待たない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test } from "@playwright/test";
import { fillRequired, loaded, mockCreate, openCreate, settledDetail } from "./create-mock";

/** 詳細の画面の JS が届くまでの遅れ（CI の VM で、URL が移ってから画面が動き出すまでに間がある形） */
const DETAIL_JS_DELAY_MS = 1500;
/** 開き直しの文書の答えの遅れ（その間に、遅れて届いた詳細の画面の JS が動き出す形） */
const REOPEN_DOC_DELAY_MS = 3000;
const later = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("K260-UI-001 作った後、詳細の画面の JS と開き直しの文書が遅くても、移り切るのを待ってから鍵を消して開き直すと 200 で作る面が開く（ログインへ移らない）", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  let slowedDetailJs = 0;
  await page.route(/_next\/static\/chunks\/app\/.*tickets\/(%5Bid%5D|\[id\])\//, async (route) => {
    slowedDetailJs += 1;
    await later(DETAIL_JS_DELAY_MS);
    await route.fallback();
  });
  await page.route(/\/tickets\?new=1$/, async (route) => {
    if (route.request().resourceType() === "document") await later(REOPEN_DOC_DELAY_MS);
    await route.fallback();
  });
  await fillRequired(page, "遅い詳細");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => m.creates.length).toBe(1);
  await settledDetail(page);
  expect(slowedDetailJs, "詳細の画面の JS を遅らせた（遅い形を作れている）").toBeGreaterThan(0);
  // 移った先を全部記録する（ログインへ移っていないことを見る）
  const moved: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) moved.push(new URL(f.url()).pathname);
  });
  // この PC の写しと鍵を消してから開き直す（K224-UI-028 の (d) と同じ順）。鍵は開き直した文書で差し替えが置き直す
  await mockCreate(page);
  await page.evaluate(() => window.localStorage.clear());
  await openCreate(page); // goto の答えが 200（取り消されたら ERR_ABORTED で赤）
  await loaded(page);
  await expect(page).toHaveURL(/\/tickets\?new=1$/);
  expect(moved.filter((p) => p.startsWith("/login"))).toEqual([]);
});
