// キャンバスと画面の見た目の値を比べる部品（K-216）。visual_fidelity.mjs と実ブラウザの突き合わせ（K-238）が使う。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から。組の値の y_from があれば狭い幅の y はその箱の上端から）・当たった要素全部の字の一覧（texts）
//   比べ方：±PX_TOLERANCE を許すのは箱の幅と高さ・x・y・余白（padding・margin・gap）だけ。ほかの px（角丸・文字の大きさ・行の高さ・線の太さ）は
//           計算の丸めの差 ROUND_TOLERANCE 未満だけ同じ／書体の名前は先頭を大小を問わず／字の一覧は並びも数もちょうど同じ／
//           それ以外（色・太さ・字の並び）はちょうど同じ。要素が無ければ「（無い）」で違う。
//   当たった（見えている）要素の数（__count）も比べる：texts を比べる役は同じ数（1 つ以上）、ほかの役は両側ちょうど 1 つ
//   読み込んだ書体は「キャンバスが読んだ書体を画面も読んでいる」か（名前の後ろの Variable と大小は問わない・D-128.123）
//   値の読み方（capture・K-238）：動きを止め → aria-busy が消えるまで待ち → 2 回続けて同じになるまで読み直し → 書体を読み → 写しは最後。
//   待ちの上限を越えたら投げる（読み込み中・動いている途中の値で比べない）。実ブラウザの突き合わせと visual_fidelity.mjs が同じこれを使う

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PX_TOLERANCE = 2;
export const MISSING = "（無い）";
export const ROUND_TOLERANCE = 0.5;
const PX = /^-?\d+(\.\d+)?px$/;
// ±2 を許す値（箱の幅と高さ・位置・余白）。ほかの px は丸めの差だけ（角丸・文字の型の段を 1 つずれても緑にしない・design-system D3・D4）
const LOOSE_PX = /^(width|height|x|y|padding(-[a-z]+)?|margin(-[a-z]+)?|gap|row-gap|column-gap)$/;
const COUNT = "当たった数";

const firstFont = (v) => v.split(",")[0].trim().replace(/["']/g, "").toLowerCase();
const famOf = (f) => String(f ?? "").replace(/["']/g, "").trim().replace(/ Variable$/i, "").toLowerCase();

/** 1 つの値を比べる。c・a は文字（texts だけ配列） */
function same(prop, c, a) {
  if (c === MISSING || a === MISSING) return false;
  if (prop === "texts") return Array.isArray(c) && Array.isArray(a) && c.length === a.length && c.every((t, i) => t === a[i]);
  if (typeof c !== "string" || typeof a !== "string") return false;
  if (PX.test(c) && PX.test(a)) {
    const d = Math.abs(parseFloat(c) - parseFloat(a));
    return LOOSE_PX.test(prop) ? d <= PX_TOLERANCE : d < ROUND_TOLERANCE;
  }
  if (prop === "font-family") return firstFont(c) === firstFont(a);
  return c === a;
}

/** 組の値（pairs）ごとに、キャンバスと画面の値を比べた行の一覧 [{part, prop, canvas, app, ok}] */
export function compareRows(pairs, canvasVals, appVals) {
  const rows = [];
  pairs.forEach((p, i) => {
    const cv = canvasVals[i];
    const av = appVals[i];
    if (typeof cv?.__count === "number" || typeof av?.__count === "number") {
      const n = cv?.__count ?? 0;
      const m = av?.__count ?? 0;
      const ok = p.props.includes("texts") ? n === m && n > 0 : n === 1 && m === 1;
      rows.push({ part: p.name, prop: COUNT, canvas: n, app: m, ok });
    }
    for (const prop of p.props) {
      const c = canvasVals[i]?.[prop] ?? MISSING;
      const a = appVals[i]?.[prop] ?? MISSING;
      rows.push({ part: p.name, prop, canvas: c, app: a, ok: same(prop, c, a) });
    }
  });
  return rows;
}

/** 読み込んだ書体の行。キャンバスが読んだ書体が 1 つも無い・画面が読んでいない書体があれば違う */
export function compareFonts(canvasLoaded, appLoaded) {
  const cf = canvasLoaded.map(famOf);
  const af = appLoaded.map(famOf);
  return {
    part: "読み込んだ書体",
    prop: "document.fonts",
    canvas: canvasLoaded.join(", ") || MISSING,
    app: appLoaded.join(", ") || MISSING,
    ok: cf.length > 0 && cf.every((f) => af.includes(f)),
  };
}

export const mismatches = (rows) => rows.filter((r) => !r.ok).length;

/** 描かれるまでの待ちが時間切れのとき、出なかったセレクタの行（黙って比べ始めない）。出揃えば行は無い */
export function waitRows(side, missing) {
  if (!missing.length) return [];
  const list = missing.join(" ／ ");
  return [{ part: "描かれなかった要素", prop: side, canvas: side === "canvas" ? list : "", app: side === "app" ? list : "", ok: false }];
}

/** 引数の誤り（終わりの値 2） */
export class ArgError extends Error {}

/** 道具の引数。既定は違いがあれば 1（--report-only のときだけ数えるだけ）。--strict は前の形との互換で受ける（既定と同じ） */
export function parseArgs(argv) {
  const o = { reportOnly: false, rest: [] };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new ArgError(`${flag} の値が無い`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") continue;
    else if (a === "--report-only") o.reportOnly = true;
    else if (a === "--group") o.group = value(i++, a);
    else if (a === "--out") o.out = value(i++, a);
    else if (a === "--storage") o.storage = value(i++, a);
    else if (a === "--width") {
      const v = value(i++, a);
      if (!/^[1-9]\d*$/.test(v)) throw new ArgError(`--width の値 ${v} が幅（正の整数）でない`);
      o.width = Number(v);
    } else if (a.startsWith("--")) throw new ArgError(`知らない旗 ${a}`);
    else o.rest.push(a);
  }
  return o;
}

/** 組で比べる幅：--width を省けば組の全部の幅。組に無い幅は止める */
export function widthsFor(group, width) {
  if (width === undefined) return [...group.widths];
  if (!group.widths.includes(width)) throw new ArgError(`組 ${group.id} の幅に ${width} が無い（${group.widths.join("・")}）`);
  return [width];
}

/** 幅ごとの絵（組の at・K-1301）：その幅で比べる絵とセレクタ。at[幅] が無ければ組の canvas と pairs のまま。
 *  在れば絵は at の canvas、対は name・role・props などを組のまま、canvas と app のセレクタだけを at の pairs[name] に替えた写し（組は書き替えない）。
 *  組の幅に無い幅・at の pairs に組の対が欠ける・知らない対は止める（設定の検査 fidelity_config.py が先に止めるが、道具も黙って比べない） */
export function groupAt(group, width) {
  if (!group.widths.includes(width)) throw new ArgError(`組 ${group.id} の幅に ${width} が無い（${group.widths.join("・")}）`);
  const at = group.at?.[String(width)];
  if (!at) return { canvas: group.canvas, pairs: group.pairs };
  const names = group.pairs.map((p) => p.name);
  const missing = names.filter((n) => !Object.hasOwn(at.pairs, n));
  const unknown = Object.keys(at.pairs).filter((n) => !names.includes(n));
  if (missing.length) throw new ArgError(`組 ${group.id} の幅 ${width} の at に対 ${missing.join("・")} が無い`);
  if (unknown.length) throw new ArgError(`組 ${group.id} の幅 ${width} の at に知らない対 ${unknown.join("・")} が在る`);
  return {
    canvas: at.canvas,
    pairs: group.pairs.map((p) => ({ ...p, canvas: at.pairs[p.name].canvas, app: at.pairs[p.name].app })),
  };
}

/** 既定の出力の置き場（版に入らない・.gitignore の .qa/visual-fidelity/out/） */
export const defaultOutDir = (id, width) => `.qa/visual-fidelity/out/${id}${width ? `-${width}` : ""}`;

/** 終わりの番号：強い形（strict）では違う値が 1 つでもあれば 1。弱い形はいつも 0 */
export const exitCode = (rows, strict) => (strict && mismatches(rows) > 0 ? 1 : 0);

/** 道具の終わりの値：既定は違いがあれば 1、--report-only のときだけ 0（引数の誤りの 2 は道具が出す） */
export const exitFor = (rows, opts) => exitCode(rows, !opts.reportOnly);

/** Playwright の page から組の値を読む。side は "canvas" か "app"（pairs[i][side] がセレクタ）。当たる要素が無ければ {__count: 0}
 *  組の値が y_from（{max_width, canvas, app, why}）を持てば、幅が max_width 以下のとき y を頁の上端でなくその箱（side のセレクタ）の上端から読む
 *  （外枠の決まりで狭い幅の帯の高さがキャンバスと違う・口に無い字の行の高さだけを外す、など。訳 why は必ず書く・K-230）。箱が見えなければ y は「無い」 */
export async function readVals(page, pairs, side) {
  for (const p of pairs) {
    if (p.y_from && !(typeof p.y_from.why === "string" && p.y_from.why.trim()))
      throw new Error(`組の値 ${p.name} の y_from に訳（why）が無い`);
  }
  return page.evaluate(
    (list) =>
      list.map(({ sel, props, yFrom }) => {
        // 見えない要素（display:none・visibility:hidden・大きさ 0・幅ごとに出し分ける複製）は「無い」
        const seen = (e) => {
          if (!e.checkVisibility({ visibilityProperty: true })) return false;
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        };
        const els = [...document.querySelectorAll(sel)].filter(seen);
        const el = els[0];
        if (!el) return { __count: 0 };
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const px = (n) => `${Math.round(n)}px`;
        const one = (k) => {
          if (k === "width") return px(r.width);
          if (k === "height") return px(r.height);
          if (k === "x") return px(r.left + window.scrollX);
          if (k === "y") {
            if (yFrom && window.innerWidth <= yFrom.max) {
              const box = [...document.querySelectorAll(yFrom.sel)].find(seen);
              return box ? px(r.top - box.getBoundingClientRect().top) : null;
            }
            return px(r.top + window.scrollY);
          }
          // innerText：見えている要素の中の隠れた子（display:none・visibility:hidden）の字を数えない
          if (k === "texts") return els.map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim());
          return cs.getPropertyValue(k);
        };
        return {
          __count: els.length,
          ...Object.fromEntries(props.map((k) => [k, one(k)]).filter(([, v]) => v !== null)),
        };
      }),
    pairs.map((p) => ({
      sel: p[side],
      props: p.props,
      yFrom: p.y_from ? { sel: p.y_from[side], max: p.y_from.max_width } : null,
    })),
  );
}

/** 実際に読み込んだ書体の名前（document.fonts の loaded）。同じ名前は 1 つにまとめる */
export async function loadedFonts(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))];
  });
}

/** 待ちの上限の既定（ミリ秒） */
export const CAPTURE_TIMEOUT = 15_000;
// 動きを止める（小窓が出てくるときの transform が x・y・幅に乗らないように）。キャンバスと画面の両方に入れる
export const STILL_CSS =
  "*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}";

/** 描画のコマを 2 つ進める（決めた秒数で待たない） */
const nextFrames = (page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)))));

/**
 * 組の値を落ち着いてから読む：動きを止め → aria-busy="true" が消えるまで待ち → 書体の読み込みを待ち →
 * 値を 2 回続けて読んで同じになるまで読み直し → 読み込んだ書体を読む → opts.shot があれば最後に写しを撮る（値は写しの前に読む）。
 * 上限（opts.timeout・既定 CAPTURE_TIMEOUT）までに aria-busy が消えない・値が揃わないときは投げる。
 * opts.busy（読み込み中の画面の組・K-255）は aria-busy を待たず、状態の文（role=status）が出るのを待つ（出なければ「状態の文が出ない」で投げる）
 */
export async function capture(page, pairs, side, opts = {}) {
  const timeout = opts.timeout ?? CAPTURE_TIMEOUT;
  const end = Date.now() + timeout;
  await page.addStyleTag({ content: STILL_CSS });
  if (opts.busy) {
    // 読み込み中の画面の組（設定の組の busy: true・K-255）：aria-busy は消えない画面なので、状態の文（role=status）が出るのを待つ
    const shown = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[role="status"]')].some(
            (e) => (e.innerText ?? "").trim() !== "" && e.getClientRects().length > 0,
          ),
        null,
        { timeout },
      )
      .then(
        () => true,
        () => false,
      );
    if (!shown) throw new Error(`状態の文が出ない（${timeout}ms 待った・${side}）`);
  } else {
    const idle = await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout })
      .then(
        () => true,
        () => false,
      );
    if (!idle) throw new Error(`aria-busy が消えない（${timeout}ms 待った・${side}）`);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let prev = JSON.stringify(await readVals(page, pairs, side));
  for (;;) {
    await nextFrames(page);
    const now = JSON.stringify(await readVals(page, pairs, side));
    if (now === prev) break;
    if (Date.now() > end) throw new Error(`値が揃わない（${timeout}ms のあいだ 2 回続けて同じにならなかった・${side}）`);
    prev = now;
  }
  const vals = JSON.parse(prev);
  const fonts = await loadedFonts(page);
  if (opts.shot) await page.screenshot({ path: opts.shot, fullPage: true });
  return { vals, fonts };
}

// ── キャンバスの書体の差し替え（K-238）：キャンバスが外から読む書体を、画面と同じ手元の書体に差し替え、外へは出さない（G-11）。
//    実ブラウザの突き合わせ（fidelity-states.ts が出し直す）と人が使う道具（visual_fidelity.mjs）が同じこれを使う
// 書体の部品は apps/web の node_modules にしか無い（pnpm）：apps/web/package.json を起点に createRequire で探す
const WEB_PKG = join(dirname(fileURLToPath(import.meta.url)), "../../apps/web/package.json");
const fontPkg = () => dirname(createRequire(WEB_PKG).resolve("@fontsource-variable/noto-sans-jp/index.css"));
const FONT_CSS_HOST = "fonts.googleapis.com";
const FONT_FILE_HOST = "fonts.gstatic.com";
// 差し替えた書体の本体の道（fonts.gstatic.com の下に置き、下の差し替えで手元のファイルを返す）
const LOCAL_FONT_PREFIX = `https://${FONT_FILE_HOST}/kaname-local/`;
const WOFF2_NAME = /^[\w.-]+\.woff2$/;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** キャンバスの頭が読む書体の CSS の代わり：手元の部品の @font-face を、キャンバスの名前（Noto Sans JP）で返す */
function localFontCss() {
  return readFileSync(join(fontPkg(), "index.css"), "utf8")
    .replaceAll("font-family: 'Noto Sans JP Variable';", "font-family: 'Noto Sans JP';")
    .replace(/url\(\.\/files\/([\w.-]+\.woff2)\)/g, (_m, name) => `url(${LOCAL_FONT_PREFIX}${name})`);
}

function fulfillFontFile(route, url) {
  const name = url.pathname.split("/").pop() ?? "";
  const file = join(fontPkg(), "files", name);
  if (!url.href.startsWith(LOCAL_FONT_PREFIX) || !WOFF2_NAME.test(name) || !existsSync(file)) {
    return route.fulfill({ status: 404, body: "" });
  }
  // 書体は CORS で読むので、file: の頁からも読めるように許可の見出しを付ける
  return route.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: readFileSync(file) });
}

/**
 * キャンバスの頁の書体を手元に差し替える：fonts.googleapis.com は手元の @font-face を、fonts.gstatic.com は手元の woff2 を返す（@fontsource-variable/noto-sans-jp）。
 * ほかの手元でない道は止める（abort）。file:・data: はそのまま読み、手元（127.0.0.1・localhost）は先に登録された差し替えへ渡す
 */
export async function routeCanvasFonts(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
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
