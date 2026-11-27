/* global document, getComputedStyle, NodeFilter -- measureChoiceAlign はブラウザの中で動く（page.evaluate に渡す） */
// 丸い選択・四角い選択（radio・checkbox・switch）の印と、つながる字の 1 行目の、縦の真ん中のずれを測る（K-642）。
//   測る関数はここ 1 か所だけ。画面の試験（apps/web/tests/k/k642-choice.spec.ts）も、切る段の下絵の頁の作り手（各段の mock-shots など）も、
//   ここから import して同じ数を出す（作り手は Node の ESM からそのまま読める・依存なし）。
//   使い方：
//     import { choiceAlignOf, choiceAlignLines, CHOICE_ALIGN_LIMIT_PX } from ".../apps/web/tests/_lib/choice-align.mjs";
//     const r = await choiceAlignOf(page);          // Playwright の page。字体が読み終わってから測る
//     r.bad.length === 0 なら、どの印も字の 1 行目の真ん中から 1px 以内
//     choiceAlignLines(r) で人が読む行（頁の注・報告に載せる）
//   測り方（ブラウザの中で動く・外の変数を使わない）：
//     ・印：見えている input[type=checkbox|radio] と [role=checkbox|radio|switch]。見えない物（幅か高さが 1px 以下・display:none・visibility:hidden・
//       自分か先祖の不透明度が 0）は数えない（視覚から隠した印の上に札を描く形など）
//     ・字：印を包む label（無ければ input.labels・aria-labelledby の先）の中の、印の外の最初の見えている字。
//       その字の範囲（Range）の最初の行の箱の縦の真ん中を「1 行目の真ん中」とする（字が 2 行以上でも 1 行目だけ）
//     ・ずれ＝印の箱の縦の真ん中 − 1 行目の真ん中（下が正）。|ずれ| が上限（既定 1px）を超えたら bad
//     ・字の無い印（表の行の頭の印など・aria-label だけ）は bare に数え、縦のずれは測らない
//   同じ並びの左端（2026-11-22 PM の実寸の確かめから足した）：
//     ・並び＝同じ親の要素を持つ兄弟の行（label・印を 1 つだけ包む物）で、行の左端が 1px 以内の組（縦に積んだ行の列）。
//       離れた先祖まで辿らない。横に並べた行（左端が違う）は別の並び。字の無い印・印を 2 つ以上包む行は並びで比べない
//     ・並びの中で、印の左端の幅（最も右 − 最も左）が上限を超えたら bad（kind: "left"）。字の大きさが違っても印の左端は 1 つ
//     ・並びの中の同じ字の大きさの行どうしで、印と字の間（字の 1 行目の左 − 印の右）の幅が上限を超えたら bad（kind: "gap"）。
//       字が印の右に隣り合う行だけ数える（部品は大きさで間が違う：本文 8・小窓 6）
//     ・縦の真ん中のずれは kind: "mid"。どれも同じ bad に入る（試験は bad が空かだけを見る）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）

/** 印と字の 1 行目の縦の真ん中のずれの上限（px）。超えたら赤 */
export const CHOICE_ALIGN_LIMIT_PX = 1;

/**
 * ブラウザの中で測る（page.evaluate に渡す・自分の中で全部を完結させる）。
 * @param {number} limit 上限（px）
 */
export function measureChoiceAlign(limit) {
  const SEL = 'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="switch"]';
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  const hostOf = (el) => {
    const byWrap = el.closest("label");
    if (byWrap) return byWrap;
    if (el.labels && el.labels.length) return el.labels[0];
    const ids = (el.getAttribute("aria-labelledby") || "").trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const t = document.getElementById(id);
      if (t) return t;
    }
    return null;
  };
  const firstLine = (host, el) => {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || !n.textContent.trim()) continue;
      if (el.contains(n)) continue;
      const parent = n.parentElement;
      if (!parent || !shown(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
      if (!rects.length) continue;
      // lines：この字の行の数（同じ高さの箱は 1 行）。blockMid：この字の全部の行の縦の真ん中（2 行以上の確かめに使う）
      const tops = rects.map((x) => x.top);
      const bottoms = rects.map((x) => x.bottom);
      return {
        rect: rects[0],
        text: n.textContent.trim().slice(0, 40),
        lines: new Set(tops.map((t) => Math.round(t))).size,
        blockMid: (Math.min(...tops) + Math.max(...bottoms)) / 2,
      };
    }
    return null;
  };
  const label = (el, text) => {
    const kind = el.getAttribute("type") || el.getAttribute("role") || el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    const value = el.getAttribute("value");
    return `${kind}${name ? `[name=${name}]` : ""}${value ? `[value=${value}]` : ""}「${text}」`;
  };
  const rows = [];
  const marks = [];
  let hidden = 0;
  const bare = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(SEL)) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (!shown(el)) {
      hidden += 1;
      continue;
    }
    const host = hostOf(el);
    const line = host ? firstLine(host, el) : null;
    const box = el.getBoundingClientRect();
    // 並びに入れるのは、字のある行（label）が印を 1 つだけ包む物。字の無い印・印を 2 つ以上包む行は並びで比べない
    if (line && host && host.querySelectorAll(SEL).length === 1) {
      marks.push({
        el,
        row: host,
        left: box.left,
        // 印と字の間は、字が印の右に隣り合うときだけ数える（字が左・両端に振り分ける形は数えない）
        gap: line.rect.left >= box.right - 1 ? line.rect.left - box.right : null,
        size: getComputedStyle(host).fontSize,
        name: label(el, line.text),
      });
    }
    if (!line) {
      bare.push(label(el, el.getAttribute("aria-label") || ""));
      continue;
    }
    const boxMid = box.top + box.height / 2;
    const textMid = line.rect.top + line.rect.height / 2;
    const diff = Math.round((boxMid - textMid) * 100) / 100;
    rows.push({
      kind: "mid",
      where: label(el, line.text),
      diff,
      boxMid,
      textMid,
      lines: line.lines,
      blockMid: line.blockMid,
    });
  }
  const bad = rows.filter((r) => Math.abs(r.diff) > limit);
  // 並び：同じ親の要素を持つ兄弟の行で、行の左端が 1px 以内の組（離れた先祖まで辿らない）
  const columns = [];
  for (const m of marks) {
    const scope = m.row.parentElement;
    const rowLeft = m.row.getBoundingClientRect().left;
    let col = columns.find((c) => c.scope === scope && Math.abs(c.rowLeft - rowLeft) <= limit);
    if (!col) {
      col = { scope, rowLeft, marks: [] };
      columns.push(col);
    }
    col.marks.push(m);
  }
  const round = (n) => Math.round(n * 100) / 100;
  const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
  const edges = [];
  for (const [i, c] of columns.entries()) {
    if (c.marks.length < 2) continue;
    const lefts = c.marks.map((m) => m.left);
    // 間は同じ字の大きさの印どうしでだけ比べる（部品は大きさで間が違う：本文 8・小窓 6）
    const bySize = new Map();
    for (const m of c.marks) if (m.gap !== null) bySize.set(m.size, [...(bySize.get(m.size) || []), m.gap]);
    const left = round(spread(lefts));
    const gap = round(Math.max(0, ...[...bySize.values()].map(spread)));
    const names = c.marks.map((m) => m.name);
    edges.push({ marks: c.marks.length, left, gap, names });
    const lo = Math.min(...lefts);
    if (left > limit) {
      const far = c.marks.reduce((a, b) => (Math.abs(b.left - lo) > Math.abs(a.left - lo) ? b : a));
      bad.push({ kind: "left", where: far.name, diff: round(far.left - lo), names });
    }
    if (gap > limit) bad.push({ kind: "gap", where: `並び ${i + 1}（${c.marks.length} 個）`, diff: gap, names });
  }
  const leftMax = edges.reduce((a, e) => Math.max(a, e.left), 0);
  const gapMax = edges.reduce((a, e) => Math.max(a, e.gap), 0);
  return { limit, measured: rows.length, hidden, bare, rows, bad, columns: edges, leftMax, gapMax };
}

/**
 * Playwright の page で測る（字体が読み終わってから）。
 * @param {import("@playwright/test").Page} page
 * @param {number} [limit]
 */
export async function choiceAlignOf(page, limit = CHOICE_ALIGN_LIMIT_PX) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(measureChoiceAlign, limit);
}

/**
 * 人が読む行（頁の注・試験の失敗の文に載せる）。
 * @param {{limit:number, measured:number, hidden:number, bare:string[], bad:{where:string, diff:number}[]}} r
 * @param {string} [where] 測った所（道や状態の名前）
 */
export function choiceAlignLines(r, where = "") {
  const cols = (r.columns || []).length;
  const head = `${where ? `${where}：` : ""}選択の印 ${r.measured} 個を測った（字の無い印 ${r.bare.length}・見えない印 ${r.hidden}・並び ${cols}）・ずれ ${r.limit}px 超え ${r.bad.length} 個`;
  const line = (b) => {
    if (b.kind === "left")
      return `  ${b.where}：同じ並びの印の左端から ${b.diff > 0 ? "右へ" : "左へ"} ${Math.abs(b.diff)}px（並び：${b.names.join("・")}）`;
    if (b.kind === "gap") return `  ${b.where}：印と字の間が行ごとに ${b.diff}px 違う（並び：${b.names.join("・")}）`;
    return `  ${b.where}：印が字の 1 行目の真ん中から ${b.diff > 0 ? "下へ" : "上へ"} ${Math.abs(b.diff)}px`;
  };
  return [head, ...r.bad.map(line)];
}
