// G34：EARS → test の対応（対応表の test_file と test_function が実在する）。生成物が古ければ赤（pnpm ci:ears:gen）
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export function check(root = process.cwd(), mappingPath = "07_qa/test-plan/ears-test-mapping.json") {
  const m = JSON.parse(readFileSync(join(root, mappingPath), "utf8")).mappings;
  const bad = [];
  const cache = new Map();
  for (const x of m) {
    const p = join(root, x.test_file);
    if (!existsSync(p)) { bad.push(`${x.test_id}: ${x.test_file} が無い`); continue; }
    if (!cache.has(p)) cache.set(p, readFileSync(p, "utf8"));
    if (!cache.get(p).includes(`"${x.test_function}"`)) bad.push(`${x.test_id}: ${x.test_file} に ${x.test_function} が無い`);
  }
  return { total: m.length, bad };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--mapping");
  const r = check(undefined, i > 0 ? process.argv[i + 1] : undefined);
  console.log(r.bad.length ? `[G34 ears-mapping] NG ${r.bad.length}/${r.total}:\n  ${r.bad.slice(0, 20).join("\n  ")}` : `[G34 ears-mapping] OK（${r.total} 文 → test が全部存在）`);
  process.exit(r.bad.length ? 1 : 0);
}
