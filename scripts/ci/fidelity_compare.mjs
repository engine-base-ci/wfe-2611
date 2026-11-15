// キャンバスと画面の見た目の値を比べる部品（K-216）。visual_fidelity.mjs と実ブラウザの突き合わせ（K-238）が使う。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から）・当たった要素全部の字の一覧（texts）
//   比べ方：±PX_TOLERANCE を許すのは箱の幅と高さ・x・y・余白（padding・margin・gap）だけ。ほかの px（角丸・文字の大きさ・行の高さ・線の太さ）は
//           計算の丸めの差 ROUND_TOLERANCE 未満だけ同じ／書体の名前は先頭を大小を問わず／字の一覧は並びも数もちょうど同じ／
//           それ以外（色・太さ・字の並び）はちょうど同じ。要素が無ければ「（無い）」で違う。
//   当たった（見えている）要素の数（__count）も比べる：texts を比べる役は同じ数（1 つ以上）、ほかの役は両側ちょうど 1 つ
//   読み込んだ書体は「キャンバスが読んだ書体を画面も読んでいる」か（名前の後ろの Variable と大小は問わない・D-128.123）
//   値の読み方（capture・K-238）：動きを止め → aria-busy が消えるまで待ち → 2 回続けて同じになるまで読み直し → 書体を読み → 写しは最後。
//   待ちの上限を越えたら投げる（読み込み中・動いている途中の値で比べない）。実ブラウザの突き合わせと visual_fidelity.mjs が同じこれを使う

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

/** 既定の出力の置き場（版に入らない・.gitignore の .qa/visual-fidelity/out/） */
export const defaultOutDir = (id, width) => `.qa/visual-fidelity/out/${id}${width ? `-${width}` : ""}`;

/** 終わりの番号：強い形（strict）では違う値が 1 つでもあれば 1。弱い形はいつも 0 */
export const exitCode = (rows, strict) => (strict && mismatches(rows) > 0 ? 1 : 0);

/** 道具の終わりの値：既定は違いがあれば 1、--report-only のときだけ 0（引数の誤りの 2 は道具が出す） */
export const exitFor = (rows, opts) => exitCode(rows, !opts.reportOnly);

/** Playwright の page から組の値を読む。side は "canvas" か "app"（pairs[i][side] がセレクタ）。当たる要素が無ければ {__count: 0} */
export async function readVals(page, pairs, side) {
  return page.evaluate(
    (list) =>
      list.map(({ sel, props }) => {
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
          if (k === "y") return px(r.top + window.scrollY);
          if (k === "texts") return els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim());
          return cs.getPropertyValue(k);
        };
        return { __count: els.length, ...Object.fromEntries(props.map((k) => [k, one(k)])) };
      }),
    pairs.map((p) => ({ sel: p[side], props: p.props })),
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
 * 上限（opts.timeout・既定 CAPTURE_TIMEOUT）までに aria-busy が消えない・値が揃わないときは投げる
 */
export async function capture(page, pairs, side, opts = {}) {
  const timeout = opts.timeout ?? CAPTURE_TIMEOUT;
  const end = Date.now() + timeout;
  await page.addStyleTag({ content: STILL_CSS });
  const idle = await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout })
    .then(
      () => true,
      () => false,
    );
  if (!idle) throw new Error(`aria-busy が消えない（${timeout}ms 待った・${side}）`);
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
