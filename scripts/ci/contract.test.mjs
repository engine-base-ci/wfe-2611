// 契約の検査そのものの検査：破壊的変更と契約に無い登録を仕込んだ一時フォルダで赤になること
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { gen, check, endpoints } from "./contract.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-contract-"));
for (const d of ["08_api", "09_features", "07_tasks", "apps/api/src/routes"]) mkdirSync(join(root, d), { recursive: true });
const yamlV1 = `openapi: 3.1.0\npaths:\n  /api/v1/things:\n    get:\n      operationId: listThings\n      responses:\n        "200":\n          content:\n            application/json:\n              schema:\n                properties:\n                  id:\n                  name:\n    post:\n      operationId: createThing\n      requestBody:\n        content:\n          application/json:\n            schema:\n              required: [name]\n`;
writeFileSync(join(root, "08_api/openapi.yaml"), yamlV1);
writeFileSync(join(root, "08_api/types.ts"), "// gen\nexport interface Thing { id: string }\n");
writeFileSync(join(root, "08_api/endpoints.json"), JSON.stringify({ endpoints: [{ id: "EP-1", method: "GET", path: "/api/v1/things" }, { id: "EP-2", method: "POST", path: "/api/v1/things" }] }));
writeFileSync(join(root, "09_features/features.json"), JSON.stringify({ items: [{ id: "F-1", api_endpoints: ["EP-1", "EP-2"] }] }));
writeFileSync(join(root, "07_tasks/tickets.json"), JSON.stringify({ tasks: [{ id: "T-A-1", status: "done", deliverable_layer: "backend", feature_ids: ["F-1"] }, { id: "T-F-1", status: "done", deliverable_layer: "foundation", feature_ids: ["F-1"] }] }));
writeFileSync(join(root, "apps/api/src/routes/things.ts"), 'r.get("/api/v1/things", h);\nr.delete("/api/v1/nope", h);\n');
execSync("git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm base && git branch -M main", { cwd: root });

const g = gen(root);
const c0 = check(root, "main");
// 破壊的変更：POST に必須 email を足し、GET の応答から name を消す
writeFileSync(join(root, "08_api/openapi.yaml"), yamlV1.replace("required: [name]", "required: [name, email]").replace("                  name:\n", ""));
const c1 = check(root, "main");
gen(root);
const c2 = check(root, "main");
const e = endpoints(root);
const ok =
  g.endpoints === 2 && c0.bad.length === 0 &&
  c1.bad.some((b) => b.includes("合っていない")) && c1.bad.some((b) => b.includes("必須の入力 email")) && c1.bad.some((b) => b.includes("応答から name")) &&
  c2.bad.every((b) => !b.includes("合っていない")) &&
  e.extra.length === 1 && e.extra[0] === "DELETE /api/v1/nope" && e.missingDone.length === 1 && e.missingDone[0].startsWith("POST /api/v1/things");
console.log(ok ? "[contract self-test] OK（生成 2・破壊的変更 2 種と生成物の古さを検出・契約に無い登録 1・done なのに未登録 1）" : `[contract self-test] NG ${JSON.stringify({ g, c0, c1, c2, e })}`);
process.exit(ok ? 0 : 1);
