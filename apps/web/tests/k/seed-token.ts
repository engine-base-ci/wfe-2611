// 試験の差し替えが画面の印（localStorage の kaname.token）を置く関数（K-338・K-319 と K-338 の試験が使う）。
//   開くたびに置き直すと、画面が印を消してログインへ移した（401 の toLogin・ログアウト）後のログインの画面にも印が戻り、
//   その画面の口の 403・MFA_REQUIRED で lib/mfa-gate.ts が /mfa-setup へ移り始め、試験の次の page.goto と先を取り合う（揺れ）。
//   本物ではログインの画面の人は印を持たない。だから置くのは「ログインの画面を除く最初の画面で 1 回だけ」にする。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page } from "@playwright/test";

export const TOKEN_KEY = "kaname.token";
/** 呼んだ回数（呼ぶごとに目印を分ける。sessionStorage は origin ごと・タブごとなので page をまたいで混ざらない） */
let seedRuns = 0;

/** 呼んだ後の、ログインの画面を除く最初の画面で 1 回だけ、印が無ければ token を置く。呼び直すと新しい目印でもう 1 回置く */
export async function seedTokenOnce(page: Page, token: string): Promise<void> {
  seedRuns += 1;
  await page.addInitScript(
    ([t, key, tokenKey]) => {
      if (window.location.pathname === "/login" || window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
      if (!window.localStorage.getItem(tokenKey)) window.localStorage.setItem(tokenKey, t);
    },
    [token, `k338.seeded.${seedRuns}`, TOKEN_KEY] as const,
  );
}

/** 入り直す：次に開く path の画面の最初に 1 回だけ token を置く（ログインの画面には置かない） */
export async function reloginOn(page: Page, path: string, token: string): Promise<void> {
  await page.addInitScript(
    ([t, p, tokenKey]) => {
      if (window.location.pathname !== p || window.sessionStorage.getItem("k338.relogin")) return;
      window.sessionStorage.setItem("k338.relogin", "1");
      window.localStorage.setItem(tokenKey, t);
    },
    [token, path, TOKEN_KEY] as const,
  );
}
