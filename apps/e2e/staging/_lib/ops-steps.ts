// 統合テスト（staging）の段 13 の運営の 1 歩（K-1102）：仮の認証器に staging の試験だけの運営の人のパスキー（K-1101 の人の準備）を入れて
//   パスキーで入る・受信箱で取って返す・1 社にお知らせを送る・中を見る・止める日を決める・再開する・値段の案を作って影響を見る。
//   操作と選び方は画面の葉（K-946・K-976・K-972・K-991）の試験と同じ。画面の名前はモック（features/F12/ops・ops2）と葉の md の字から（実装から書かない）。
//   環境の値は読まない（鍵と住所は site.ts だけが読む）。鍵は Chrome の開発者の道具の口（CDP の WebAuthn）にだけ渡し、画面・記録・投げる文に出さない。
//   ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。staging の最初の回で名前が違えば、ここを直す
import { expect, type Locator, type Page } from "@playwright/test";
import { WEB, opsPasskey } from "./site";
import { h1, readAs } from "./steps";

export const OPS_LOGIN = "/ops/login";
export const OPS_SUPPORT = "/ops/support";
export const OPS_PLANS = "/ops/skills/plans";
export const OPS_TENANT = (id: string): string => `/ops/tenants/${id}`;
export const REPLY_RE = /^\/api\/v1\/ops\/inquiries\/[^/]+\/replies$/;
export const TAKE_RE = /^\/api\/v1\/ops\/inquiries\/[^/]+$/;
export const PEEK_RE = /^\/api\/v1\/ops\/workspaces\/[^/]+\/peeks$/;
export const STOP_RE = /^\/api\/v1\/ops\/workspaces\/[^/]+\/stop$/;
export const RESUME_RE = /^\/api\/v1\/ops\/workspaces\/[^/]+\/resume$/;
export const WS_NOTICE_RE = /^\/api\/v1\/ops\/workspaces\/[^/]+\/notices$/;
export const PROPOSALS_RE = /^\/api\/v1\/ops\/plan_proposals(\/[^/]+)?$/;

/** base64url と PEM を CDP が受ける base64 に直す（中身は返すだけで、どこにも書かない） */
const pemToB64 = (pem: string): string => pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
const urlToB64 = (s: string): string => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return b + "=".repeat((4 - (b.length % 4)) % 4);
};

/** 仮の認証器を足し、試験だけの運営の人のパスキーを入れる。署名の回数は回ごとに今の時刻の秒（前の回より必ず大きい） */
export async function addOpsPasskey(page: Page): Promise<void> {
  const k = opsPasskey();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: urlToB64(k.id),
      isResidentCredential: true,
      rpId: new URL(WEB).hostname,
      privateKey: pemToB64(k.key),
      userHandle: urlToB64(k.user),
      signCount: Math.floor(Date.now() / 1000),
    },
  });
}

/** 運営のログイン（K-946）でパスキーで入る。入った後の見出しを待つ */
export async function enterOps(page: Page): Promise<void> {
  await addOpsPasskey(page);
  await page.goto(OPS_LOGIN);
  await expect(h1(page, "運営のログイン")).toBeVisible();
  await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "問い合わせ", exact: false }).first(),
  ).toBeVisible();
}

/** 運営の全社の一覧の口で、名前の会社の id を引く（会社の名前は試験が登録で付けた字） */
export async function workspaceIdOf(page: Page, name: string): Promise<string | null> {
  const r = await readAs(page, `/ops/workspaces?q=${encodeURIComponent(name)}`);
  const row = ((r.data ?? []) as Record<string, unknown>[]).find((x) => x["name"] === name);
  return row ? String(row["id"]) : null;
}

/** 受信箱で 1 件を開き、［自分が持つ］→ 返事を書いて［返す］。返す口の答えの番号を返す */
export async function takeAndReply(page: Page, inquiryId: string, body: string): Promise<number> {
  await page.goto(`${OPS_SUPPORT}?id=${inquiryId}`);
  expect(await clickFor(page, page.getByRole("button", { name: "自分が持つ", exact: true }), TAKE_RE, "PATCH")).toBe(
    200,
  );
  await page.getByRole("textbox", { name: "返事", exact: false }).first().fill(body);
  return clickFor(page, page.getByRole("button", { name: "返す", exact: true }), REPLY_RE, "POST");
}

/** 1 社の画面で［お知らせを送る］→ 題・本文 →［送る］。送る口の答えの番号を返す */
export async function sendWorkspaceNotice(page: Page, wsId: string, title: string, body: string): Promise<number> {
  await page.goto(OPS_TENANT(wsId));
  await page.getByRole("button", { name: "お知らせを送る", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "お知らせを送る", exact: true });
  await dlg.getByLabel("題", { exact: true }).fill(title);
  await dlg.getByLabel("本文", { exact: true }).fill(body);
  return clickFor(page, dlg.getByRole("button", { name: "送る", exact: true }), WS_NOTICE_RE, "POST");
}

/** ［中を見る］→ 理由と見る時間 →［見るだけで開く］。本人確認の取り直しが要る（403）ときは［パスキーで確かめる］の後の答えを待つ。開く口の最後の答えの番号を返す */
export async function openPeek(page: Page, wsId: string): Promise<number> {
  await page.goto(OPS_TENANT(wsId));
  await page.getByRole("button", { name: "中を見る", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "中を見る", exact: true });
  await dlg.getByLabel("理由", { exact: true }).selectOption({ index: 0 });
  await dlg.getByLabel("見る時間", { exact: true }).selectOption({ index: 0 });
  const first = await clickFor(page, dlg.getByRole("button", { name: "見るだけで開く", exact: true }), PEEK_RE, "POST");
  if (first !== 403) return first;
  return clickFor(page, page.getByRole("button", { name: "パスキーで確かめる", exact: true }), PEEK_RE, "POST");
}

/** ［そのほかの操作 › 止める］→ 止める小窓を既定のまま［止める］（理由 請求が払われない・日を決める・止める日は小窓の既定＝日本の暦で 7 日後〔K-972 の stopDefault が日本時間で作る。
 *  UTC で作ると日付をまたぐ時刻に 6 日後になり得るので、道具の側で日を作らない〕）。止める口の答えの番号を返す */
export async function scheduleStop(page: Page, wsId: string): Promise<number> {
  await page.goto(OPS_TENANT(wsId));
  await page.getByRole("button", { name: "そのほかの操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "止める", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "止める", exact: true });
  return clickFor(page, dlg.getByRole("button", { name: "止める", exact: true }), STOP_RE, "POST");
}

/** 止めている帯の［再開する］。再開の口の答えの番号を返す */
export async function resume(page: Page, wsId: string): Promise<number> {
  await page.goto(OPS_TENANT(wsId));
  return clickFor(page, page.getByRole("button", { name: "再開する", exact: true }), RESUME_RE, "POST");
}

/** プランの画面（K-991）の試験の案（理由が「統合テスト」で始まる下書き）の id を返す。無ければ［変える案を作る］で作る。
 *  1 つのプランに開いた案は 1 つ（K-988）なので、前の回の下書きが残っていればそれを使う（決めない・差し戻さない＝値段は変わらない） */
export async function ensureProposal(page: Page, reason: string): Promise<string | null> {
  const mine = async () =>
    (((await readAs(page, "/ops/plan_proposals")).data as Record<string, unknown>[] | null) ?? []).find(
      (x) => x["state"] === "draft" && String(x["reason"] ?? "").startsWith("統合テスト"),
    );
  const before = await mine();
  if (before) return String(before["id"]);
  await page.goto(OPS_PLANS);
  await page.getByRole("button", { name: "変える案を作る", exact: true }).first().click();
  const dlg = page.getByRole("dialog").first();
  await dlg.getByLabel("理由", { exact: true }).fill(reason);
  expect(await clickFor(page, dlg.getByRole("button", { name: "保存する", exact: true }), PROPOSALS_RE, "POST")).toBe(
    201,
  );
  const after = await mine();
  return after ? String(after["id"]) : null;
}

/** ボタンを押し、その口の答えを待って番号を返す（道は pathname だけで比べる・住所を出さない） */
async function clickFor(page: Page, button: Locator, re: RegExp, method: string): Promise<number> {
  const answered = page.waitForResponse((r) => re.test(new URL(r.url()).pathname) && r.request().method() === method);
  await button.click();
  return (await answered).status();
}
