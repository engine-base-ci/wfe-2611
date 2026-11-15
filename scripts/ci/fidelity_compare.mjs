// キャンバスと画面の見た目の値を比べる部品（K-216）。visual_fidelity.mjs と実ブラウザの突き合わせ（K-238）が使う。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から）・当たった要素全部の字の一覧（texts）
//   比べ方：px の値（大きさ・余白・x・y）は ±PX_TOLERANCE まで（線の太さ border-*-width はちょうど同じ）／書体の名前は先頭を大小を問わず／字の一覧は並びも数もちょうど同じ／
//           それ以外（色・太さ・角丸の書き方・字の並び）はちょうど同じ。要素が無ければ「（無い）」で違う
//   読み込んだ書体は「キャンバスが読んだ書体を画面も読んでいる」か（名前の後ろの Variable と大小は問わない・D-128.123）

export const PX_TOLERANCE = 2;
export const MISSING = "（無い）";
const PX = /^-?\d+(\.\d+)?px$/;
// 線の太さは ±2 にしない（1px の線が無い＝0px を同じにしてしまう）。px でもちょうど同じで比べる
const EXACT_PX = /^border(-[a-z]+)*-width$/;

const firstFont = (v) => v.split(",")[0].trim().replace(/["']/g, "").toLowerCase();
const famOf = (f) => String(f ?? "").replace(/["']/g, "").trim().replace(/ Variable$/i, "").toLowerCase();

/** 1 つの値を比べる。c・a は文字（texts だけ配列） */
function same(prop, c, a) {
  if (c === MISSING || a === MISSING) return false;
  if (prop === "texts") return Array.isArray(c) && Array.isArray(a) && c.length === a.length && c.every((t, i) => t === a[i]);
  if (typeof c !== "string" || typeof a !== "string") return false;
  if (PX.test(c) && PX.test(a) && !EXACT_PX.test(prop)) return Math.abs(parseFloat(c) - parseFloat(a)) <= PX_TOLERANCE;
  if (prop === "font-family") return firstFont(c) === firstFont(a);
  return c === a;
}

/** 組の値（pairs）ごとに、キャンバスと画面の値を比べた行の一覧 [{part, prop, canvas, app, ok}] */
export function compareRows(pairs, canvasVals, appVals) {
  const rows = [];
  pairs.forEach((p, i) => {
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

/** 終わりの番号：強い形（strict）では違う値が 1 つでもあれば 1。弱い形はいつも 0 */
export const exitCode = (rows, strict) => (strict && mismatches(rows) > 0 ? 1 : 0);

/** Playwright の page から組の値を読む。side は "canvas" か "app"（pairs[i][side] がセレクタ）。要素が無ければ null */
export async function readVals(page, pairs, side) {
  return page.evaluate(
    (list) =>
      list.map(({ sel, props }) => {
        const els = [...document.querySelectorAll(sel)];
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
        return Object.fromEntries(props.map((k) => [k, one(k)]));
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
