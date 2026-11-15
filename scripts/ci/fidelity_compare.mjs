// キャンバスと画面の見た目の値を比べる部品（K-216）。visual_fidelity.mjs と実ブラウザの突き合わせ（K-238）が使う。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から）・当たった要素全部の字の一覧（texts）
//   比べ方：±PX_TOLERANCE を許すのは箱の幅と高さ・x・y・余白（padding・margin・gap）だけ。ほかの px（角丸・文字の大きさ・行の高さ・線の太さ）は
//           計算の丸めの差 ROUND_TOLERANCE 未満だけ同じ／書体の名前は先頭を大小を問わず／字の一覧は並びも数もちょうど同じ／
//           それ以外（色・太さ・字の並び）はちょうど同じ。要素が無ければ「（無い）」で違う。
//   当たった（見えている）要素の数（__count）も比べる：texts を比べる役は同じ数（1 つ以上）、ほかの役は両側ちょうど 1 つ
//   読み込んだ書体は「キャンバスが読んだ書体を画面も読んでいる」か（名前の後ろの Variable と大小は問わない・D-128.123）

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

/** Playwright の page から組の値を読む。side は "canvas" か "app"（pairs[i][side] がセレクタ）。要素が無ければ null */
export async function readVals(page, pairs, side) {
  return page.evaluate(
    (list) =>
      list.map(({ sel, props }) => {
        // 見えない要素（display:none・visibility:hidden・幅ごとに出し分ける複製）は「無い」
        const els = [...document.querySelectorAll(sel)].filter((e) => e.checkVisibility({ visibilityProperty: true }));
        const el = els[0];
        if (!el) return null;
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
