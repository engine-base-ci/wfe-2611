// 関門の検出器そのものの検査：迂回を仕込んだ一時フォルダで赤になること（検出器が黙って緑にならない）
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkChoke, checkDynamic, checkExceptions } from "./choke.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-choke-"));
mkdirSync(join(root, "03_architecture"), { recursive: true });
cpSync("03_architecture/choke-points.json", join(root, "03_architecture/choke-points.json"));
cpSync("03_architecture/choke-point-exceptions.md", join(root, "03_architecture/choke-point-exceptions.md"));
mkdirSync(join(root, "packages/bad/src"), { recursive: true });
mkdirSync(join(root, "packages/actions/src"), { recursive: true });
writeFileSync(join(root, "packages/bad/src/a.ts"), 'import axios from "axios";\nexport const f = () => fetch("http://x");\nexport const e = () => eval("1");\n');
writeFileSync(join(root, "packages/actions/src/ok.ts"), 'export const g = () => fetch("http://x");\n');
const c1 = checkChoke("C1", root);
const dyn = checkDynamic(root);
const ex = checkExceptions(root);
const ok = c1.violations.length === 2 && c1.violations.every((v) => v.startsWith("packages/bad/")) && dyn.length === 1 && ex.length === 0;
console.log(ok ? "[choke self-test] OK（迂回 2・動的 1 を検出、関門の中は許可）" : `[choke self-test] NG ${JSON.stringify({ c1: c1.violations, dyn, ex })}`);
process.exit(ok ? 0 : 1);
