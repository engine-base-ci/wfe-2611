/* global process, console */
// 流れ（L2）の結果を正本（07_qa/test-specs/journeys/plan.json）に書き戻す。
//   rows[].status = PASS｜BLOCKED｜TODO（qa-ladder.py gate が読む列）・rows[].note = 理由・rows[].result = 人が読む 1 行
//   node apps/e2e/write_results.mjs <playwright の JSON 報告> [--task T-I-09]
// 行 ID は test の名前の先頭（J01-01 …）。PASS／BLOCKED（理由）／未実施 を書く。判定語（FAIL 等）は書かない
import { readFileSync, writeFileSync } from "node:fs";
const [, , reportPath, ...rest] = process.argv;
const task = rest.includes("--task") ? rest[rest.indexOf("--task") + 1] : "";
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const results = new Map();
const walk = (s) => {
  for (const sp of s.specs ?? []) {
    const id = /^(J\d{2}-\d{2})/.exec(sp.title)?.[1];
    if (!id) continue;
    const t = sp.tests?.[0]?.results?.[0];
    const status = t?.status ?? "skipped";
    const today = new Date().toISOString().slice(0, 10);
    results.set(
      id,
      status === "passed"
        ? `PASS（apps/e2e/journeys・実 Chrome・${today}）`
        : status === "skipped"
          ? `BLOCKED（${t?.annotations?.[0]?.description ?? "前提が無い"}・${today}）`
          : `未通過（${today}・apps/e2e の報告を見る）`,
    );
  }
  for (const c of s.suites ?? []) walk(c);
};
for (const s of report.suites ?? []) walk(s);
const plan = JSON.parse(readFileSync("07_qa/test-specs/journeys/plan.json", "utf8"));
let n = 0;
for (const r of plan.rows) {
  if (results.has(r.id)) {
    r.result = results.get(r.id);
    r.status = r.result.startsWith("PASS") ? "PASS" : r.result.startsWith("BLOCKED") ? "BLOCKED" : "TODO";
    r.note = r.result.replace(/^[^（]*（/, "").replace(/）$/, "");
    if (task) r.task = task;
    n++;
  }
}
writeFileSync("07_qa/test-specs/journeys/plan.json", JSON.stringify(plan, null, 1) + "\n");
console.log(
  `[journeys] ${n} 行を書き戻した: ${[...results.entries()].map(([k, v]) => `${k}=${v.split("（")[0]}`).join(" ")}`,
);
