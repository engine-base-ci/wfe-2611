// キャンバスとの見た目の突き合わせで、画面をその組の状態に整える道具（K-216）。
//   鍵は 04_design/fidelity.json の組の state。値は (page, path) => Promise<void>：path（組の app）を開き、組の状態（人・データ・開いた小窓）にする。
//   最初は空（入れた組が 0）。組を入れる（enrolled: true）画面のチケットが、ここに鍵を足す。
//   enrolled の組の鍵がここに無いと scripts/ci/fidelity_config.py が赤にする（"<鍵>": の字で探す）。
//   キャンバスの書体の差し替え（routeCanvasFonts・K-238）：キャンバスが外から読む書体を、画面と同じ手元の書体に差し替え、外へは出さない（G-11）。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Route } from "@playwright/test";

export const FIDELITY_STATES: Record<string, (page: Page, path: string) => Promise<void>> = {};

// 画面（apps/web/app/layout.tsx）と同じ書体の部品
const FONT_PKG = join(dirname(fileURLToPath(import.meta.url)), "../../node_modules/@fontsource-variable/noto-sans-jp");
const FONT_CSS_HOST = "fonts.googleapis.com";
const FONT_FILE_HOST = "fonts.gstatic.com";
// 差し替えた書体の本体の道（fonts.gstatic.com の下に置き、下の差し替えで手元のファイルを返す）
const LOCAL_FONT_PREFIX = `https://${FONT_FILE_HOST}/kaname-local/`;
const WOFF2_NAME = /^[\w.-]+\.woff2$/;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** キャンバスの頭が読む書体の CSS の代わり：手元の部品の @font-face を、キャンバスの名前（Noto Sans JP）で返す */
function localFontCss(): string {
  return readFileSync(join(FONT_PKG, "index.css"), "utf8")
    .replaceAll("font-family: 'Noto Sans JP Variable';", "font-family: 'Noto Sans JP';")
    .replace(/url\(\.\/files\/([\w.-]+\.woff2)\)/g, (_m, name: string) => `url(${LOCAL_FONT_PREFIX}${name})`);
}

async function fulfillFontFile(route: Route, url: URL): Promise<void> {
  const name = url.pathname.split("/").pop() ?? "";
  const file = join(FONT_PKG, "files", name);
  if (!url.href.startsWith(LOCAL_FONT_PREFIX) || !WOFF2_NAME.test(name) || !existsSync(file)) {
    return route.fulfill({ status: 404, body: "" });
  }
  // 書体は CORS で読むので、file: の頁からも読めるように許可の見出しを付ける
  return route.fulfill({
    status: 200,
    contentType: "font/woff2",
    headers: { "access-control-allow-origin": "*" },
    body: readFileSync(file),
  });
}

/**
 * キャンバスの頁の書体を手元に差し替える：fonts.googleapis.com は手元の @font-face を、fonts.gstatic.com は手元の woff2 を返す。
 * ほかの手元でない道は止める（abort）。file:・data: はそのまま読み、手元（127.0.0.1・localhost）は先に登録された差し替えへ渡す
 */
export async function routeCanvasFonts(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    // キャンバスの絵そのもの（file:）と data: は外ではないので、そのまま読む
    if (url.protocol !== "http:" && url.protocol !== "https:") return route.continue();
    if (url.hostname === FONT_CSS_HOST) {
      return route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        headers: { "access-control-allow-origin": "*" },
        body: localFontCss(),
      });
    }
    if (url.hostname === FONT_FILE_HOST) return fulfillFontFile(route, url);
    if (LOCAL_HOSTS.has(url.hostname)) return route.fallback();
    return route.abort();
  });
}
