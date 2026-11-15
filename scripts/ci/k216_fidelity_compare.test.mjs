// K-216 の試験（比べ方の本体）：キャンバスと画面の見た目の値を比べる関数（scripts/ci/fidelity_compare.mjs・実装の役が作る）。
//   node --test scripts/ci/k216_fidelity_compare.test.mjs      行 ID は K216-VF-NNN（11_tickets/K-216.md の行の表と 1 対 1）
//   ブラウザは使わない（値を読んだ後の比べ方だけ）。値を読む所（readVals）は K-238 の実ブラウザの突き合わせが通す。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から）・当たった要素全部の字の一覧（texts）
import { test } from "node:test";
import assert from "node:assert/strict";
import { PX_TOLERANCE, compareFonts, compareRows, exitCode, mismatches } from "./fidelity_compare.mjs";

const pairs = [
  { name: "見出し", role: "h1", canvas: "h1", app: "h1", props: ["font-size", "font-weight", "color", "font-family", "x", "y"] },
  { name: "帯", role: "head", canvas: "header", app: ".k-page-head", props: ["height", "padding-left"] },
  { name: "左のメニューの項目", role: "nav-items", canvas: ".kn-item", app: ".k-nav-item", props: ["texts"] },
];
const canvas = [
  { "font-size": "18px", "font-weight": "700", color: "rgb(19, 27, 39)", "font-family": '"Noto Sans JP", sans-serif', x: "240px", y: "60px" },
  { height: "55px", "padding-left": "24px" },
  { texts: ["チケット", "承認待ち", "高本のAI"] },
];

test("K216-VF-005 同じ値なら全部の行が ok で、違う数は 0", () => {
  const rows = compareRows(pairs, canvas, structuredClone(canvas));
  assert.equal(rows.length, 9);
  assert.ok(rows.every((r) => r.ok));
  assert.equal(mismatches(rows), 0);
});

test("K216-VF-006 px は ±2 まで同じ（3 違えば違う）・色と太さはちょうど同じ・書体の名前は先頭を大小を問わず比べる", () => {
  assert.equal(PX_TOLERANCE, 2);
  const app = structuredClone(canvas);
  app[1].height = "57px";
  app[0]["font-family"] = "noto sans jp, system-ui";
  let rows = compareRows(pairs, canvas, app);
  assert.equal(mismatches(rows), 0, JSON.stringify(rows));
  app[1].height = "58px";
  app[0].color = "rgb(19, 27, 40)";
  app[0]["font-weight"] = "400";
  rows = compareRows(pairs, canvas, app);
  assert.deepEqual(
    rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}`),
    ["見出し・font-weight", "見出し・color", "帯・height"],
  );
});

test("K216-VF-007 位置（x・y）も ±2 で比べる：見出しが左から 248px（キャンバスは 240px）なら違う", () => {
  const app = structuredClone(canvas);
  app[0].x = "242px";
  assert.equal(mismatches(compareRows(pairs, canvas, app)), 0);
  app[0].x = "248px";
  app[0].y = "25px";
  const bad = compareRows(pairs, canvas, app).filter((r) => !r.ok).map((r) => r.prop);
  assert.deepEqual(bad, ["x", "y"]);
});

test("K216-VF-008 字の一覧（texts）は並びも数もちょうど同じ：項目が違う・足りない・順が違えば違う", () => {
  for (const texts of [
    ["今日", "自分のAI", "仕事"],
    ["チケット", "承認待ち"],
    ["承認待ち", "チケット", "高本のAI"],
  ]) {
    const app = structuredClone(canvas);
    app[2].texts = texts;
    const bad = compareRows(pairs, canvas, app).filter((r) => !r.ok);
    assert.deepEqual(
      bad.map((r) => `${r.part}・${r.prop}`),
      ["左のメニューの項目・texts"],
      JSON.stringify(texts),
    );
  }
});

test("K216-VF-009 画面の側に要素が無ければ、その組の値は全部「（無い）」で違う", () => {
  const rows = compareRows(pairs, canvas, [canvas[0], null, canvas[2]]);
  const bad = rows.filter((r) => !r.ok);
  assert.equal(bad.length, 2);
  assert.ok(bad.every((r) => r.app === "（無い）" && r.part === "帯"));
});

test("K216-VF-010 実際に読み込んだ書体：キャンバスが読んだ書体を画面も読んでいれば ok（名前の後ろの Variable と大小は問わない）。読んでいない・どちらも空なら違う", () => {
  assert.equal(compareFonts(["Noto Sans JP"], ["Noto Sans JP Variable"]).ok, true);
  assert.equal(compareFonts(["Noto Sans JP"], ["Inter"]).ok, false);
  assert.equal(compareFonts([], []).ok, false);
});

test("K216-VF-011 違う値が 1 つでもあれば、強い形（strict）では終わりの番号が 1、弱い形では 0", () => {
  const app = structuredClone(canvas);
  app[0]["font-size"] = "13px";
  const rows = compareRows(pairs, canvas, app);
  assert.equal(mismatches(rows), 1);
  assert.equal(exitCode(rows, true), 1);
  assert.equal(exitCode(rows, false), 0);
  assert.equal(exitCode(compareRows(pairs, canvas, canvas), true), 0);
});
