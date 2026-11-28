// ci:errors-used の検査そのものの検査：正本に無いエラーの参照で赤になること・生成物が正本の件数を持つこと
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gen, used } from "./errors_used.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-errors-"));
mkdirSync(join(root, "07_qa/test-specs"), { recursive: true });
mkdirSync(join(root, "packages/x/src"), { recursive: true });
writeFileSync(join(root, "07_qa/test-specs/errors.json"), JSON.stringify({ errors: [{ id: "E-AUTH-001", class: "auth", message: "m", action: "a" }, { id: "E-LIM-002", class: "limit", message: "m2", action: "a2" }] }));
writeFileSync(join(root, "packages/x/src/a.ts"), 'throw kanameError("E-AUTH-001"); throw kanameError("E-NOPE-999");\n');
const n = gen(root);
const cat = readFileSync(join(root, "packages/errors/src/catalog.ts"), "utf8");
const r = used(root);
const ok = n === 2 && cat.includes('"E-LIM-002"') && r.unknown.length === 1 && r.unknown[0] === "E-NOPE-999" && r.unused.length === 1 && r.unused[0] === "E-LIM-002";
console.log(ok ? "[errors-used self-test] OK（生成 2・正本に無い参照 1・出せないエラー 1 を検出）" : `[errors-used self-test] NG ${JSON.stringify({ n, r })}`);
process.exit(ok ? 0 : 1);
