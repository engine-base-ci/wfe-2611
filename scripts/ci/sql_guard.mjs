// 関門 C2 の静的検査（G10・G35）。TypeScript の AST で見る（grep で済ませない）。
//   --no-sql-concat   G10：.query／.execute／.raw の第 1 引数が「埋め込みのあるテンプレ」や「文字列連結」なら落とす（関門 packages/db/src の中は識別子の許可リストで守るので許可）
//   --resource-static G35：new Pool／new Client の生成が関門の外にある／プールに timeout が無い（1 要求 1 接続・上限は待機列・黙って固まらない）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = process.cwd();
const SKIP = /(^|\/)(node_modules|dist|coverage|\.next)(\/|$)|\.test\.(ts|tsx|mts)$|(^|\/)test(s)?\//;
const SQL_ALLOW = ["packages/db/src/"]; // 関門 C2 の中（識別子は許可リストで検査・repository.test.ts が確認）
const POOL_ALLOW = ["packages/db/src/", "packages/auth/src/index.ts", "packages/auth/src/migrate.ts"]; // 関門 C2 と境界 B2（例外台帳 X-003）
const QUERY_METHODS = new Set(["query", "execute", "raw", "unsafe"]);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mts)$/.test(f)) yield p;
  }
}
function files(root) {
  const out = [];
  for (const d of ["apps", "packages"]) for (const p of walk(join(root, d))) if (!SKIP.test(relative(root, p))) out.push(p);
  return out;
}
const inAllow = (rel, list) => list.some((a) => rel === a || rel.startsWith(a));
function hasStringConcat(n) {
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return ts.isStringLiteralLike(n.left) || ts.isStringLiteralLike(n.right) || hasStringConcat(n.left) || hasStringConcat(n.right);
  return false;
}
export function checkSqlConcat(root = ROOT) {
  const v = [];
  for (const file of files(root)) {
    const rel = relative(root, file);
    if (inAllow(rel, SQL_ALLOW)) continue;
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && QUERY_METHODS.has(n.expression.name.text) && n.arguments[0]) {
        const a = n.arguments[0];
        if (ts.isTemplateExpression(a)) v.push(`${rel}:${line(n)} .${n.expression.name.text}(埋め込みのあるテンプレ)`);
        else if (hasStringConcat(a)) v.push(`${rel}:${line(n)} .${n.expression.name.text}(文字列連結)`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return v;
}
export function checkResources(root = ROOT) {
  const v = [];
  for (const file of files(root)) {
    const rel = relative(root, file);
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visit = (n) => {
      if (ts.isNewExpression(n)) {
        const e = n.expression;
        const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "";
        if (name === "Pool" || name === "Client") {
          if (!inAllow(rel, POOL_ALLOW)) v.push(`${rel}:${line(n)} new ${name}(…) が関門の外（接続は packages/db/src/pool.ts の createPool を使う）`);
          else if (name === "Pool" && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
            const keys = new Set(n.arguments[0].properties.map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : "")));
            if (rel === "packages/db/src/pool.ts" && !(keys.has("statement_timeout") && keys.has("connectionTimeoutMillis") && keys.has("max"))) v.push(`${rel}:${line(n)} createPool に max／connectionTimeoutMillis／statement_timeout が無い（黙って固まる・上限が無い）`);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return v;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  const v = mode === "--resource-static" ? checkResources() : checkSqlConcat();
  const tag = mode === "--resource-static" ? "G35 有限資源の静的検査" : "G10 動的クエリの文字列連結";
  console.log(v.length ? `[${tag}] NG ${v.length}:\n  ${v.join("\n  ")}` : `[${tag}] OK`);
  process.exit(v.length ? 1 : 0);
}
