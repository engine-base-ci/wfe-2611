// 提供元の規約 5 条件を機械で確かめる（D-092）。
//   ① 資格情報を集めない・保存しない・仲介しない   ② バイナリを改変せず承認の仕組みを弱めない
//   ③ 代わりに支払わない（段階 1 は本人のサブスクだけ） ④ 商用規約に同意（人の手続き・ここでは記録の有無だけ見る）
//   ⑤ 名前とロゴを製品名・機能名・会社名・ロゴに使わない（本文で「公式の CLI を実行します」と述べるのは可）
// 使い方: node scripts/ci/claude-terms.mjs [--json]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".git", ".next", ".next-prod", "dist", "release", "playwright-report", "test-results", "__pycache__", "pw-reports"]);
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (SKIP.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = walk(ROOT).filter((f) => [".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".yml", ".yaml"].includes(extname(f)));
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => f.slice(ROOT.length + 1);

// ② 承認の仕組みを弱める引数を渡していないか（テストと検査自身の記述は除く）
const WEAKENING = ["--dangerously-skip-permissions", "--allow-dangerously-skip-permissions", "bypassPermissions"];
// 「使っている」だけを見る。禁止の一覧を書いてある設計書・記録（.json/.md）は対象にしない
// 例外：全部許可（bypassPermissions）は本人がその会話で選んだときだけ使える（D-104.14・2026-09-27 本人の決定で §92.2 を改めた）。
//   値を書いてよいのは「選べる値の一覧」と「CLI の引数にする唯一の場所」だけ。既定にはできない（DB の agent_set_default_mode が拒む）。
//   CLI の外し方（--dangerously-skip-permissions 系）はどこにも書かない
const SANCTIONED = {
  bypassPermissions: [
    "apps/bridge/src/modes.ts",      // 本人が選んだモードを CLI の引数にする唯一の場所。知らない値・空は manual
    "apps/api/src/auth/agent.ts",    // 仕事に乗せてよい値の一覧（画面から来たものを絞る）
    "apps/web/lib/agent-modes.ts",   // 画面の選択肢（その会話だけ・警告つき）
  ],
};
const weakening = files
  .filter((f) => [".ts", ".tsx", ".js", ".mjs"].includes(extname(f)))
  .filter((f) => !rel(f).startsWith("scripts/ci/") && !rel(f).includes("/tests/") && !rel(f).endsWith(".test.ts"))
  .flatMap((f) => WEAKENING.filter((w) => read(f).includes(w) && !(SANCTIONED[w] ?? []).includes(rel(f))).map((w) => `${rel(f)}: ${w}`));
// 例外の場所が守りを外していないか：CLI の引数にする場所は、知らない値を manual に倒す
const modesTs = join(ROOT, "apps/bridge/src/modes.ts");
if (existsSync(modesTs) && !/:\s*"manual"/.test(read(modesTs))) weakening.push("apps/bridge/src/modes.ts: 知らない値を manual（毎回聞く）に倒していない");

// ① 本人の資格情報を保存していないか（Bridge が書き出すものに code／token／credential が混ざっていないか）
const bridge = files.filter((f) => rel(f).startsWith("apps/bridge/src/"));
const KEEP = /writeFileSync\s*\(([^)]*)\)/g;
const creds = bridge.flatMap((f) => {
  const t = read(f);
  const bad = [];
  for (const m of t.matchAll(KEEP)) {
    const arg = m[1] ?? "";
    if (/code|token|credential|secret|password|apiKey/i.test(arg)) bad.push(`${rel(f)}: ${m[0].slice(0, 60)}`);
  }
  return bad;
});

// ③ 段階 1 の経路。サーバー側がサブスクの資格で呼んでいないか（関門 C3 の中だけを見る）
const llm = files.filter((f) => rel(f).startsWith("packages/llm/"));
const subsOnServer = llm.flatMap((f) =>
  /claude\.ai|oauth|setup-token|subscription/i.test(read(f)) ? [`${rel(f)}: サーバー側でサブスクの資格を使おうとしている疑い`] : [],
);

// ⑤ 名前とロゴ。製品の身元を名乗る場所に提供元の名前が入っていないか（本文の説明は対象外）
const IDENTITY = [
  ["apps/web/app/layout.tsx", /title:\s*["'`]([^"'`]+)/g],
  ["apps/bridge/package.json", /"(productName|name)":\s*"([^"]+)"/g],
  ["apps/web/package.json", /"name":\s*"([^"]+)"/g],
];
const PROVIDER = /(anthropic|claude)/i;
const identity = [];
for (const [f, re] of IDENTITY) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const m of read(p).matchAll(re)) {
    const v = m[2] ?? m[1] ?? "";
    if (PROVIDER.test(v)) identity.push(`${f}: ${v}`);
  }
}
// 画面の見出し（h1）も製品の身元。本文は対象にしない
for (const f of files.filter((x) => rel(x).startsWith("06_mockup/v1/") || rel(x).startsWith("apps/web/app/"))) {
  for (const m of read(f).matchAll(/<h1[^>]*>([^<]{1,80})</g)) {
    if (PROVIDER.test(m[1] ?? "")) identity.push(`${rel(f)}: <h1> ${m[1].trim()}`);
  }
}

// ④ 商用規約に同意した記録があるか（人の手続き。ここでは記録の有無だけ）
const stack = join(ROOT, "02_tech_stack/selected-stack.json");
const terms = existsSync(stack) && /commercial_terms|商用規約/.test(read(stack));

const res = {
  "①資格情報を保存している疑い": creds,
  "②承認を弱める引数": weakening,
  "③サーバー側でサブスクの資格": subsOnServer,
  "④商用規約の記録": terms ? [] : ["02_tech_stack/selected-stack.json に商用規約の記録が無い"],
  "⑤製品の身元に提供元の名前": identity,
};
const fails = Object.values(res).reduce((a, b) => a + b.length, 0);
if (process.argv.includes("--json")) console.log(JSON.stringify({ fails, ...res }, null, 2));
else {
  console.log(`規約の検査（D-092）／ 見たファイル ${files.length}`);
  for (const [k, v] of Object.entries(res)) console.log(`  ${k}: ${v.length ? `NG ${v.length} 件  ${v.slice(0, 3).join(" ／ ")}` : "OK"}`);
  console.log(fails === 0 ? "PASS" : `不合格 ${fails} 件`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(fails === 0 ? 0 : 1);
