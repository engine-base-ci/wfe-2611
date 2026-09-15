// G13 の検査そのものの検査：名前の食い違いと関門の外の process.env で赤になること
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit } from "./env_audit.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-env-"));
mkdirSync(join(root, "packages/config/src"), { recursive: true });
mkdirSync(join(root, "packages/bad/src"), { recursive: true });
writeFileSync(join(root, "packages/config/src/index.ts"), 'const a = env["A_KEY"]; const b = env["B_KEY"];\n');
writeFileSync(join(root, ".env.example"), "A_KEY=1\nC_KEY=2\n");
writeFileSync(join(root, "packages/bad/src/x.ts"), 'export const p = process.env["A_KEY"];\n// process.env in comment is fine\n');
const r = audit(root);
const ok = r.bad.length === 3 && r.bad.some((b) => b.includes("B_KEY")) && r.bad.some((b) => b.includes("C_KEY")) && r.bad.some((b) => b.includes("packages/bad/src/x.ts:1"));
console.log(ok ? "[env-audit self-test] OK（.env.example に無い 1・読まない 1・関門の外 1 を検出）" : `[env-audit self-test] NG ${JSON.stringify(r)}`);
process.exit(ok ? 0 : 1);
