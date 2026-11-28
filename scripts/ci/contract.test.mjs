// 契約の検査そのものの検査：破壊的変更と契約に無い登録を仕込んだ一時フォルダで赤になること
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { gen, check, endpoints } from "./contract.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-contract-"));
for (const d of ["08_api", "09_features", "07_tasks", "apps/api/src/routes", "scripts/ci"]) mkdirSync(join(root, d), { recursive: true });
// 行の決まり（K-15）は置き場の scripts/ci/row_rules.mjs から読む（契約の hash の元にも入る）。本物を写す
cpSync(join(dirname(fileURLToPath(import.meta.url)), "row_rules.mjs"), join(root, "scripts/ci/row_rules.mjs"));
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
// gen が routes を作り直すので、契約に無い登録（DELETE /nope）と未登録（POST）を仕込み直してから測る
writeFileSync(join(root, "apps/api/src/routes/things.ts"), 'r.get("/api/v1/things", h);\nr.delete("/api/v1/nope", h);\n');
const e = endpoints(root);
// 意図して消す：GET /things を消す。根拠の決定が決定ログにあれば通り、無ければ赤
mkdirSync(join(root, "01_hearing"), { recursive: true });
writeFileSync(join(root, "01_hearing/決定ログ_進行中.md"), "| D-900.1 | things をやめる | 理由 |\n");
writeFileSync(join(root, "08_api/openapi.yaml"), yamlV1.replace(/  \/api\/v1\/things:\n    get:[\s\S]*?(?=    post:)/, "  /api/v1/things:\n"));
gen(root);
const c3 = check(root, "main");
writeFileSync(join(root, "08_api/retired-endpoints.json"), JSON.stringify({ retired: [{ path: "/api/v1/things", method: "GET", decision: "D-900.1", reason: "things をやめた" }] }));
const c4 = check(root, "main");
writeFileSync(join(root, "08_api/retired-endpoints.json"), JSON.stringify({ retired: [{ path: "/api/v1/things", method: "GET", decision: "D-999.9", reason: "根拠が無い" }] }));
const c5 = check(root, "main");
const ok =
  g.endpoints === 2 && c0.bad.length === 0 &&
  c1.bad.some((b) => b.includes("合っていない")) && c1.bad.some((b) => b.includes("必須の入力 email")) && c1.bad.some((b) => b.includes("応答から name")) &&
  c2.bad.every((b) => !b.includes("合っていない")) &&
  e.extra.length === 1 && e.extra[0] === "DELETE /api/v1/nope" && e.missingDone.length === 1 && e.missingDone[0].startsWith("POST /api/v1/things") &&
  c3.bad.some((b) => b.includes("GET /api/v1/things が消えた")) && c4.bad.length === 0 && c4.allowed === 1 &&
  c5.bad.some((b) => b.includes("決定ログに無い")) && c5.bad.some((b) => b.includes("GET /api/v1/things が消えた"));
console.log(ok ? "[contract self-test] OK（生成 2・破壊的変更 2 種と生成物の古さを検出・契約に無い登録 1・done なのに未登録 1・決定にもとづく削除だけ通す）" : `[contract self-test] NG ${JSON.stringify({ g, c0, c1, c2, c3, c4, c5, e })}`);
process.exit(ok ? 0 : 1);
