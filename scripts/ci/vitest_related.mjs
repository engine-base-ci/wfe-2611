#!/usr/bin/env node
// vitest_related.mjs — 渡したファイルごとに、import で関わる試験のファイルを出す（K-107・D-128.169）。流さない・DB にもつながない。
//   node scripts/ci/vitest_related.mjs <ファイル…>   → 標準出力に {ファイル: [試験…]}（根からの相対・並べて重なりを除く。無ければ []）
//   中身は `vitest related` と同じ（vitest 3.2.7 の Node の口：globTestSpecifications → specifications.filterTestsBySource）。
//   ファイルごとに related を 1 つにして辿る。vitest が投げたら 1 で終わる（ci_scope.py が ToolError にして止める・K-170）
import { relative, resolve } from "node:path";
import { createVitest } from "vitest/node";

const root = process.cwd();
const files = process.argv.slice(2);
const out = {};
let vitest;
try {
  vitest = await createVitest("test", { watch: false, related: [], run: true }, { logLevel: "silent" });
  const specs = await vitest.globTestSpecifications();
  for (const f of files) {
    vitest.config.related = [resolve(root, f)];
    const got = await vitest.specifications.filterTestsBySource(specs);
    out[f] = [...new Set(got.map((s) => relative(root, s.moduleId).split("\\").join("/")))].sort();
  }
} catch (e) {
  process.stderr.write(`vitest_related: ${e?.stack || e}\n`);
  await vitest?.close().catch(() => {});
  process.exit(1);
}
await vitest.close();
// 書き終わってから終わる（管に出すとき、64KB を超える答えは書き終わる前の process.exit で途中で切れ、JSON でなくなる・K-321）
process.stdout.write(JSON.stringify(out) + "\n", () => process.exit(0));
