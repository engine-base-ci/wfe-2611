/* global process, console */
// 実ブラウザの結果を正本に書く。テストの名前に含まれる行 ID（SCR-…-NNN・USH-…-NNN・E-…-A/B/C）ごとに、
// 直近の Playwright JSON 報告から PASS／未通過 を 07_qa/test-specs/**/*.md の結果列に書く（説明文は書かない。op_gate.py が同じ報告で検査する）。
//   node apps/web/write_results.mjs apps/web/test-results/report.json [--spec 07_qa/test-specs]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [, , ...argv] = process.argv;
const reportPaths = argv.filter((a) => a.endsWith(".json"));
const rest = argv.filter((a) => !a.endsWith(".json"));
const spec = rest.includes("--spec") ? rest[rest.indexOf("--spec") + 1] : "07_qa/test-specs";
const label = rest.includes("--label") ? rest[rest.indexOf("--label") + 1] : "実 Chrome";

const ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}(?:-[ABC])?\b/g;
const rank = { passed: 0, skipped: 1, failed: 2, timedOut: 2, interrupted: 2 };
const byId = new Map();
const whyById = new Map(); // 飛ばした理由（BLOCKED の理由として正本に書く）
const files = new Map();
const walk = (s, path) => {
  for (const sp of s.specs ?? []) {
    let st = "skipped";
    let why = "";
    for (const t of sp.tests ?? []) {
      for (const r of t.results ?? []) st = r.status ?? st;
      for (const a of t.annotations ?? []) if (a.type === "skip" || a.type === "fixme") why = a.description ?? why;
    }
    for (const id of `${path.join(" ")} ${sp.title}`.match(ID) ?? []) {
      const cur = byId.get(id);
      if (cur === undefined || (rank[st] ?? 2) > (rank[cur] ?? 0)) byId.set(id, st);
      if (why) whyById.set(id, why);
      files.set(id, sp.file ?? s.file ?? "");
    }
  }
  for (const c of s.suites ?? []) walk(c, [...path, s.title ?? ""]);
};
// vitest の JSON 報告（--reporter=json）も読む：testResults[].assertionResults[]（名前に行 ID を持つもの）
const walkVitest = (j) => {
  for (const f of j.testResults ?? []) {
    for (const a of f.assertionResults ?? []) {
      const st = a.status === "passed" ? "passed" : a.status === "failed" ? "failed" : "skipped";
      for (const id of `${(a.ancestorTitles ?? []).join(" ")} ${a.title ?? ""}`.match(ID) ?? []) {
        const cur = byId.get(id);
        if (cur === undefined || (rank[st] ?? 2) > (rank[cur] ?? 0)) byId.set(id, st);
        files.set(id, f.name ?? "");
      }
    }
  }
};
for (const p of reportPaths) {
  const j = JSON.parse(readFileSync(p, "utf8"));
  if (Array.isArray(j.testResults)) walkVitest(j);
  for (const s of j.suites ?? []) walk(s, []);
}
const today = new Date().toISOString().slice(0, 10);
const mds = [];
const dig = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) dig(p);
    else if (e.endsWith(".md")) mds.push(p);
  }
};
dig(spec);
let n = 0;
const touched = new Map();
for (const p of mds) {
  const lines = readFileSync(p, "utf8").split("\n");
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.startsWith("| ") || ln.startsWith("| ID ")) continue;
    const c = ln.split("|");
    if (c.length < 12) continue;
    const id = c[1].trim();
    if (!byId.has(id)) continue;
    const st = byId.get(id);
    const f = (files.get(id) ?? "").replace(/^.*?(apps\/)/, "$1");
    const cell =
      st === "passed"
        ? ` PASS（${f || "playwright"}・${label}・${today}） `
        : st === "skipped"
          ? // 飛ばしたなら、そう書く。前の結果を残すと「通ったまま」に見える
            whyById.has(id)
            ? ` BLOCKED（${whyById.get(id)}・${today}） `
            : c[8]
          : ` 未通過（${today}・${f}・報告を見る） `;
    if (c[8] !== cell) {
      c[8] = cell;
      lines[i] = c.join("|");
      changed = true;
      n++;
      touched.set(st, (touched.get(st) ?? 0) + 1);
    }
  }
  if (changed) writeFileSync(p, lines.join("\n"));
}
console.log(
  `[results] 行 ID ${byId.size} 件を報告から読み、${n} 行を書いた（${[...touched].map(([k, v]) => `${k} ${v}`).join(" / ") || "変化なし"}）`,
);
