// 秘密の混入の検査（ゼロトラストの決まり ZT7・D-128.113）。git に入っているファイルを全部見て、鍵・トークン・秘密鍵の形をしたものがあれば赤。
// 見つけた値は出さない（先頭 4 文字と長さだけ）。わざと置いた偽物（試験の見本など）は secret_scan_allow.json に「どのファイルの・どの種類か・理由」を書いたものだけ通す。
// 使い方: node scripts/ci/secret_scan.mjs   （自己テスト: node scripts/ci/secret_scan.mjs --selftest）
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const RULES = [
  { id: "aws-access-key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: "github-token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: "openai-key", re: /\bsk-(proj-)?[A-Za-z0-9]{32,}\b/g },
  { id: "stripe-live-key", re: /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/g },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "private-key", re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/g },
  { id: "vercel-token", re: /\b(vercel_|vc_)[A-Za-z0-9]{24,}\b/g },
  { id: "db-url-with-password", re: /\bpostgres(?:ql)?:\/\/[^:\s"'`/]+:(?!postgres@|kaname_app@|password@|pass@|\$\{)[^@\s"'`]{8,}@[^\s"'`]+/g },
];
const SKIP = /(^|\/)(node_modules|\.git|dist|\.next|coverage)\/|\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|mp4|lock)$|pnpm-lock\.yaml$/;
const mask = (v) => `${v.slice(0, 4)}…（${v.length} 文字）`;

export function scanText(path, text, allow = []) {
  const hits = [];
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      if (allow.some((a) => a.path === path && a.rule === r.id)) continue;
      if (r.id === "db-url-with-password" && /@(127\.0\.0\.1|localhost)[:/]/.test(m[0])) continue; // 自分の PC の開発用の既定値（本物の秘密ではない）
      const line = text.slice(0, m.index).split("\n").length;
      hits.push({ path, line, rule: r.id, sample: mask(m[0]) });
    }
  }
  return hits;
}

export function scan(root = process.cwd()) {
  const allowPath = join(root, "scripts/ci/secret_scan_allow.json");
  const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")).allow : [];
  const bad = allow.filter((a) => !a.path || !a.rule || !String(a.reason ?? "").trim());
  // -z：日本語の名前を "\343..." と化けさせない（化けると開けずに黙って飛ばしていた。68 本を見ていなかった・2026-11-04）
  const files = execSync("git ls-files -z", { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  const hits = [];
  const envFiles = files.filter((f) => /(^|\/)\.env(\.[^/]*)?$/.test(f) && !/\.env\.(example|sample|template)$/.test(f));
  for (const f of files) {
    if (SKIP.test(f)) continue;
    const p = join(root, f);
    if (!existsSync(p) || statSync(p).size > 2 * 1024 * 1024) continue;
    hits.push(...scanText(f, readFileSync(p, "utf8"), allow));
  }
  return { files: files.length, hits, envFiles, badAllow: bad };
}

function selftest() {
  const fake = ["AKIA" + "ABCDEFGHIJKLMNOP", "sk-ant-" + "x".repeat(30), "-----BEGIN " + "PRIVATE KEY-----", "postgres://u:" + "s3cretpassw0rd" + "@db:5432/x"];
  const ok = fake.every((v) => scanText("t.ts", `const a = "${v}";`).length === 1);
  const quiet = scanText("t.ts", 'const url = "postgres://postgres:postgres@127.0.0.1:5432/kaname_test"; const d = "postgres://kaname_app:kaname_app_dev@127.0.0.1:55433/kaname_dev"; const k = process.env.ANTHROPIC_API_KEY;').length === 0;
  const allowed = scanText("t.ts", `"${fake[0]}"`, [{ path: "t.ts", rule: "aws-access-key", reason: "見本" }]).length === 0;
  // 日本語の名前のファイルも開いて見る（git ls-files が名前を化けさせて、黙って飛ばしていた・2026-11-04）
  const d = mkdtempSync(join(tmpdir(), "secret-scan-selftest-"));
  let jp = false;
  try {
    execSync("git init -q", { cwd: d });
    writeFileSync(join(d, "日本語の名前.ts"), `const a = "${fake[0]}";\n`);
    execSync("git add -A", { cwd: d });
    jp = scan(d).hits.length === 1;
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
  console.log(ok && quiet && allowed && jp ? "[secret scan selftest] OK" : `[secret scan selftest] NG（日本語の名前 ${jp}）`);
  process.exit(ok && quiet && allowed && jp ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--selftest")) selftest();
  const r = scan();
  const problems = [
    ...r.hits.map((h) => `${h.path}:${h.line} ${h.rule} ${h.sample}`),
    ...r.envFiles.map((f) => `${f} は .env のファイル（git に入れない。見本は .env.example に）`),
    ...r.badAllow.map((a) => `secret_scan_allow.json：${a.path ?? "?"} ${a.rule ?? "?"} に理由が無い`),
  ];
  if (problems.length) {
    console.log(`[secret scan] NG（${r.files} ファイル）`);
    for (const p of problems) console.log("  " + p);
    process.exit(1);
  }
  console.log(`[secret scan] OK（${r.files} ファイル・秘密の形は見つからない）`);
}
