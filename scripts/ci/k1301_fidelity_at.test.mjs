// K-1301 の試験（幅ごとの絵を解く関数）：組と幅から、その幅で比べる絵とセレクタを返す groupAt（scripts/ci/fidelity_compare.mjs・実装の役が作る）。
//   node --test scripts/ci/k1301_fidelity_at.test.mjs      行 ID は K1301-FA-NNN（11_tickets/K-1301.md の行の表と 1 対 1）
//   groupAt(group, width) → { canvas, pairs }：組に at[<幅>] が無ければ組の canvas と pairs のまま。在れば絵は at の canvas、
//   対は name・role・props（と y_from などのほかの欄）を組のまま、canvas と app のセレクタだけを at の pairs[name] に替える。組を書き替えない。
//   組の幅に無い幅・at の pairs に組の対が欠ける・知らない対は ArgError で止める（設定の検査 fidelity_config.py が先に止めるが、道具も黙って比べない）
//   ブラウザは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { test } from "node:test";
import assert from "node:assert/strict";
import { ArgError, groupAt } from "./fidelity_compare.mjs";

const pairs = [
  { name: "見出し", role: "h1", canvas: "main header h1", app: ".k-page-head h1", props: ["font-size", "x", "y"] },
  { name: "見出しの帯", role: "head", canvas: "main header", app: ".k-list-head", props: ["height", "width"] },
  { name: "本文の箱", role: "body", canvas: "main > header + div", app: ".k-list-body", props: ["padding-top"] },
];
const at375 = {
  canvas: "MobileList",
  pairs: {
    見出し: { canvas: "header.kn-mlist-head h1", app: ".k-page-head h1" },
    見出しの帯: { canvas: "header.kn-mlist-head", app: ".k-list-head" },
    本文の箱: { canvas: ".kn-mlist-body", app: ".k-list-body" },
  },
  ticket: "K-478",
  decision: "D-151.20",
  why: "幅 375 の正はスマホの一覧の絵（本文の箱が別の形）",
};
const base = () => ({ id: "g", canvas: "Main", app: "/tickets", widths: [1440, 375], pairs: structuredClone(pairs) });

test("K1301-FA-014 at の無い組は、どの幅でも組の canvas と pairs をそのまま返す", () => {
  const g = base();
  for (const w of g.widths) assert.deepEqual(groupAt(g, w), { canvas: "Main", pairs });
});

test("K1301-FA-015 at[375] の在る組：幅 375 は絵とセレクタだけを替え、name・role・props はそのまま。幅 1440 は組のまま。組を書き替えない", () => {
  const g = { ...base(), at: { 375: structuredClone(at375) } };
  const before = structuredClone(g);
  const r = groupAt(g, 375);
  assert.equal(r.canvas, "MobileList");
  assert.deepEqual(
    r.pairs,
    pairs.map((p) => ({ ...p, canvas: at375.pairs[p.name].canvas, app: at375.pairs[p.name].app })),
  );
  assert.deepEqual(groupAt(g, 1440), { canvas: "Main", pairs });
  assert.deepEqual(g, before, "組を書き替えた");
  // y_from などほかの欄は対のまま残す
  const withExtra = { ...base(), pairs: pairs.map((p, i) => (i === 0 ? { ...p, busyText: "読み込み中" } : p)), at: { 375: at375 } };
  assert.equal(groupAt(withExtra, 375).pairs[0].busyText, "読み込み中");
});

test("K1301-FA-016 組の幅に無い幅・at の pairs に組の対が欠ける・知らない対があれば ArgError（黙って組の絵で比べない）", () => {
  const g = { ...base(), at: { 375: at375 } };
  assert.throws(() => groupAt(g, 768), ArgError);
  const { 本文の箱: _drop, ...short } = at375.pairs;
  assert.throws(() => groupAt({ ...base(), at: { 375: { ...at375, pairs: short } } }, 375), ArgError);
  assert.throws(
    () => groupAt({ ...base(), at: { 375: { ...at375, pairs: { ...at375.pairs, 無い対: { canvas: "x", app: "y" } } } } }, 375),
    ArgError,
  );
});
