// K-216 の試験（比べ方の本体）：キャンバスと画面の見た目の値を比べる関数（scripts/ci/fidelity_compare.mjs・実装の役が作る）。
//   node --test scripts/ci/k216_fidelity_compare.test.mjs      行 ID は K216-VF-NNN（11_tickets/K-216.md の行の表と 1 対 1）
//   ブラウザは使わない（値を読んだ後の比べ方だけ）。値を読む所（readVals）は K-238 の実ブラウザの突き合わせが通す。
//   比べる値：計算後の CSS の値・箱の幅と高さ（width・height）・位置（x・y＝頁の左上から）・当たった要素全部の字の一覧（texts）・当たった（見えている）要素の数
//   ±2px を許すのは箱の幅と高さ・x・y・余白（padding・margin・gap）だけ。ほかの px（角丸・文字の大きさ・行の高さ・線の太さ）は丸めの差 0.5px 未満だけ同じ
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArgError,
  PX_TOLERANCE,
  compareFonts,
  compareRows,
  defaultOutDir,
  exitCode,
  mismatches,
  parseArgs,
  waitRows,
  widthsFor,
} from "./fidelity_compare.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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

// ---- レビューの指摘（2026-11-15・PM の決め）：違うのに緑になる道を塞ぐ ----

test("K216-VF-018 角丸・文字の大きさ・行の高さ・太さ・色はちょうど同じ（丸めの差 0.5px 未満だけ同じ）。±2 は箱の幅と高さ・x・y・余白（padding・margin・gap）だけ", () => {
  const ps = [{ name: "箱", role: "card", canvas: ".c", app: ".a", props: ["border-radius", "font-size", "line-height", "margin-top", "gap", "border-top-left-radius"] }];
  const c = [{ "border-radius": "8px", "font-size": "16px", "line-height": "28.8px", "margin-top": "12px", gap: "8px", "border-top-left-radius": "8px" }];
  const near = [{ "border-radius": "8px", "font-size": "16px", "line-height": "28.79px", "margin-top": "14px", gap: "6px", "border-top-left-radius": "8px" }];
  assert.equal(mismatches(compareRows(ps, c, near)), 0, JSON.stringify(compareRows(ps, c, near)));
  const off = [{ "border-radius": "10px", "font-size": "14px", "line-height": "27px", "margin-top": "15px", gap: "8px", "border-top-left-radius": "9px" }];
  assert.deepEqual(
    compareRows(ps, c, off).filter((r) => !r.ok).map((r) => r.prop),
    ["border-radius", "font-size", "line-height", "margin-top", "border-top-left-radius"],
  );
});

test("K216-VF-019 当たった（見えている）要素の数を両側で比べる：texts 以外の役はちょうど 1 つ・texts の役は同じ数（1 つ以上）。数が違えば「当たった数」の行が違う", () => {
  const one = (n, v) => ({ __count: n, ...v });
  const ps = [pairs[0], pairs[2]];
  const c = [one(1, canvas[0]), one(3, canvas[2])];
  let rows = compareRows(ps, c, structuredClone(c));
  assert.equal(mismatches(rows), 0, JSON.stringify(rows));
  assert.equal(rows.filter((r) => r.prop === "当たった数").length, 2);
  rows = compareRows(ps, c, [one(2, canvas[0]), one(3, canvas[2])]);
  assert.deepEqual(rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}`), ["見出し・当たった数"]);
  rows = compareRows(ps, [one(2, canvas[0]), one(3, canvas[2])], [one(2, canvas[0]), one(3, canvas[2])]);
  assert.deepEqual(rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}`), ["見出し・当たった数"], "両側 2 つでも違う");
  rows = compareRows(ps, c, [one(1, canvas[0]), one(2, { texts: ["チケット", "承認待ち"] })]);
  assert.ok(rows.some((r) => !r.ok && r.part === "左のメニューの項目" && r.prop === "当たった数"));
  rows = compareRows(ps, c, [one(1, canvas[0]), null]);
  assert.ok(rows.some((r) => !r.ok && r.part === "左のメニューの項目" && r.prop === "当たった数" && r.app === 0));
});

test("K216-VF-020 描かれるまでの待ちが時間切れなら、出なかったセレクタを行に出して違う（黙って比べ始めない）。出揃えば行は無い", () => {
  assert.deepEqual(waitRows("app", []), []);
  const rows = waitRows("app", [".k-page-head", "input[name=title]"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ok, false);
  assert.match(JSON.stringify(rows[0]), /\.k-page-head/);
  assert.match(JSON.stringify(rows[0]), /input\[name=title\]/);
  assert.equal(exitCode(rows, true), 1);
});

test("K216-VF-021 道具の引数：既定は違いがあれば 1（--report-only を付けたときだけ 0）・--width を省くと組の全部の幅・幅の値が不正なら止める", () => {
  assert.equal(parseArgs(["--group", "g"]).reportOnly, false);
  assert.equal(parseArgs(["--group", "g", "--report-only"]).reportOnly, true);
  const g = { id: "g", widths: [1440, 375] };
  assert.deepEqual(widthsFor(g, parseArgs(["--group", "g"]).width), [1440, 375]);
  assert.deepEqual(widthsFor(g, parseArgs(["--group", "g", "--width", "375"]).width), [375]);
  for (const bad of [["--width"], ["--width", "abc"], ["--width", "0"], ["--nai"]]) {
    assert.throws(() => parseArgs(["--group", "g", ...bad]), ArgError, JSON.stringify(bad));
  }
  assert.throws(() => widthsFor(g, 768), ArgError);
});

test("K216-VF-022 既定の出力の置き場は版に入らない（git が無視する所）", () => {
  const dir = defaultOutDir("tickets-new", 1440);
  const r = spawnSync("git", ["check-ignore", "-q", `${dir}/app.png`], { cwd: ROOT });
  assert.equal(r.status, 0, `${dir} が .gitignore に入っていない`);
});
