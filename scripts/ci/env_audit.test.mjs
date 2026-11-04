// G13 の検査そのものの検査：名前の食い違いと関門の外の process.env で赤になること
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit, judge } from "./env_audit.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-env-"));
mkdirSync(join(root, "packages/config/src"), { recursive: true });
mkdirSync(join(root, "packages/bad/src"), { recursive: true });
writeFileSync(join(root, "packages/config/src/index.ts"), 'const a = env["A_KEY"]; const b = env["B_KEY"];\n');
writeFileSync(join(root, ".env.example"), "A_KEY=1\nC_KEY=2\n");
writeFileSync(join(root, "packages/bad/src/x.ts"), 'export const p = process.env["A_KEY"];\n// process.env in comment is fine\n');
// 子のプログラムの中身（例外 X-014）：定数の文字列の範囲だけ見ない。範囲の外は赤（KN-117）
mkdirSync(join(root, "apps/bridge/src"), { recursive: true });
writeFileSync(
  join(root, "apps/bridge/src/guard.ts"),
  "export const HOOK_SOURCE = `\nconst a = process.env.IN_CHILD;\n`;\nconst b = process.env.OUTSIDE;\n",
);
const r = audit(root);
// 記録の扱い（KN-114）：記録に無いファイルは赤・記録どおりは緑・増えたら赤・減ったら下げるよう言う
const j0 = judge({ bad: ["packages/bad/src/x.ts:1 process.env を関門の外で読んでいる（packages/config を通す）"] }, { files: {} });
const j1 = judge({ bad: ["packages/bad/src/x.ts:1 process.env を関門の外で読んでいる（packages/config を通す）"] }, { files: { "packages/bad/src/x.ts": 1 } });
const j2 = judge({ bad: ["a.ts:1 process.env を関門の外で読んでいる（x）", "a.ts:2 process.env を関門の外で読んでいる（x）"] }, { files: { "a.ts": 1 } });
const j3 = judge({ bad: [] }, { files: { "a.ts": 1 } });
const ratchet = j0.fails.length === 1 && j1.fails.length === 0 && j1.notes.length === 0 && j2.fails.length === 1 && j3.notes.length === 1;
const childOk = r.bad.some((b) => b.includes("apps/bridge/src/guard.ts:4")) && !r.bad.some((b) => b.includes("apps/bridge/src/guard.ts:2"));
const ok = ratchet && childOk && r.bad.length === 4 && r.bad.some((b) => b.includes("B_KEY")) && r.bad.some((b) => b.includes("C_KEY")) && r.bad.some((b) => b.includes("packages/bad/src/x.ts:1"));
console.log(ok ? "[env-audit self-test] OK（.env.example に無い 1・読まない 1・関門の外 1 を検出・記録の増減を判定・子のプログラムの範囲の外は赤）" : `[env-audit self-test] NG ${JSON.stringify(r)}`);
process.exit(ok ? 0 : 1);
