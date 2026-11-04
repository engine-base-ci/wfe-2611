// 関門の迂回検出（G16〜G25）。03_architecture/choke-points.json の forbidden_direct_apis を、gateway_path と例外台帳の外で使っていたら落とす。
// import グラフ（ImportDeclaration／require／dynamic import）と呼び出し式（fetch(…) 等のグローバル）を TypeScript の AST で辿る。grep で済ませない。
//   node scripts/ci/choke.mjs --id C1          関門 1 本
//   node scripts/ci/choke.mjs --all            全関門
//   node scripts/ci/choke.mjs --no-dynamic     G24 eval／new Function／文字列からの import
//   node scripts/ci/choke.mjs --exceptions     G25 例外台帳の整合（形式・期限切れ・関門 ID の実在）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = process.cwd();
const SCAN_DIRS = ["apps", "packages"];
// 見ないもの：依存・生成物（dist／.next／.next-prod／.vercel／release）・試験・道具（apps/<app>/scripts と apps/<app>/*.mjs は開発の道具で製品の実行時には入らない）
const SKIP = /(^|\/)(node_modules|dist|coverage|\.next[^/]*|\.vercel|release|playwright-report|test-results)(\/|$)|\.test\.(ts|tsx|mts|mjs)$|(^|\/)test(s)?\/|^apps\/[^/]+\/scripts\/|^apps\/[^/]+\/[^/]+\.mjs$/;

export function loadChoke(root = ROOT) {
  return JSON.parse(readFileSync(join(root, "03_architecture/choke-points.json"), "utf8"));
}
export function loadExceptions(root = ROOT) {
  const md = existsSync(join(root, "03_architecture/choke-point-exceptions.md")) ? readFileSync(join(root, "03_architecture/choke-point-exceptions.md"), "utf8") : "";
  const rows = [];
  for (const line of md.split("\n")) {
    const m = /^\| (X-\d+) \| \**(C\d+)[^|]*\| `([^`]+)` \|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/.exec(line);
    if (m) rows.push({ id: m[1], choke: m[2], path: m[3].trim(), reason: m[4].trim(), control: m[5].trim(), expires: m[6].trim(), status: m[7].trim() });
  }
  return rows;
}
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(f)) yield p;
  }
}
function sourceFiles(root) {
  const out = [];
  for (const d of SCAN_DIRS) for (const p of walk(join(root, d))) if (!SKIP.test(relative(root, p))) out.push(p);
  return out;
}
const GLOBALS = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "eval", "Function"]);

/** 1 ファイルの import 指定子と、グローバル呼び出しの名前を集める */
export function scan(file) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = []; // {spec, line}
  const calls = []; // {name, line}
  const dynamic = []; // {line, text}
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  function visit(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      if (!(n.importClause && n.importClause.isTypeOnly)) imports.push({ spec: n.moduleSpecifier.text, line: line(n) }); // import type は API を呼ばない
    }
    else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) imports.push({ spec: n.moduleSpecifier.text, line: line(n) });
    else if (ts.isCallExpression(n)) {
      const e = n.expression;
      if (ts.isIdentifier(e) && e.text === "require" && n.arguments[0]) {
        if (ts.isStringLiteral(n.arguments[0])) imports.push({ spec: n.arguments[0].text, line: line(n) });
        else dynamic.push({ line: line(n), text: "require(非リテラル)" });
      } else if (e.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0]) {
        if (ts.isStringLiteral(n.arguments[0])) imports.push({ spec: n.arguments[0].text, line: line(n) });
        else dynamic.push({ line: line(n), text: "import(非リテラル)" });
      } else if (ts.isIdentifier(e) && GLOBALS.has(e.text)) calls.push({ name: e.text, line: line(n) });
      else if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && (e.expression.text === "globalThis" || e.expression.text === "window" || e.expression.text === "self") && GLOBALS.has(e.name.text)) calls.push({ name: e.name.text, line: line(n) });
    } else if (ts.isNewExpression(n)) {
      const e = n.expression;
      if (ts.isIdentifier(e) && GLOBALS.has(e.text)) calls.push({ name: e.text, line: line(n) });
    } else if (ts.isTaggedTemplateExpression(n) && ts.isIdentifier(n.tag)) calls.push({ name: n.tag.text + "`", line: line(n) });
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return { imports, calls, dynamic, src };
}
const matchesSpec = (spec, forbidden) => spec === forbidden || spec.startsWith(forbidden + "/") || (forbidden.startsWith("node:") && spec === forbidden.slice(5));

/** 関門 1 本の迂回を集める */
export function checkChoke(id, root = ROOT) {
  const cp = loadChoke(root).choke_points.find((c) => c.id === id);
  if (!cp) throw new Error(`関門 ${id} が choke-points.json に無い`);
  const gateway = cp.gateway_path.replace(/\/$/, "");
  const exceptions = loadExceptions(root).filter((x) => x.choke === id && x.status.includes("有効")).map((x) => x.path.replace(/\/$/, ""));
  const violations = [];
  for (const file of sourceFiles(root)) {
    const rel = relative(root, file);
    if (rel.startsWith(gateway + "/") || rel === gateway) continue;
    if (exceptions.some((p) => rel.startsWith(p + "/") || rel === p)) continue;
    const { imports, calls, src } = scan(file);
    for (const f of cp.forbidden_direct_apis) {
      if (f.endsWith("`")) {
        for (const c of calls) if (c.name === f) violations.push(`${rel}:${c.line} ${f}（タグ付きテンプレ）`);
      } else if (f.includes(".")) {
        if (!f.startsWith("node:") && !f.startsWith("@") && !f.includes("/")) {
          const re = new RegExp("\\b" + f.replace(".", "\\.") + "\\s*\\(");
          src.split("\n").forEach((l, i) => { if (re.test(l) && !l.trimStart().startsWith("//")) violations.push(`${rel}:${i + 1} ${f}`); });
        } else for (const im of imports) if (matchesSpec(im.spec, f)) violations.push(`${rel}:${im.line} import ${im.spec}`);
      } else {
        for (const im of imports) if (matchesSpec(im.spec, f)) violations.push(`${rel}:${im.line} import ${im.spec}`);
        for (const c of calls) if (c.name === f) violations.push(`${rel}:${c.line} ${f}(…)`);
      }
    }
  }
  return { id, name: cp.name, gateway, exceptions, violations: [...new Set(violations)] };
}
export function checkDynamic(root = ROOT) {
  const v = [];
  for (const file of sourceFiles(root)) {
    const rel = relative(root, file);
    const { calls, dynamic } = scan(file);
    for (const c of calls) if (c.name === "eval" || c.name === "Function") v.push(`${rel}:${c.line} ${c.name}`);
    for (const d of dynamic) v.push(`${rel}:${d.line} ${d.text}`);
  }
  return v;
}
export function checkExceptions(root = ROOT) {
  const ids = new Set(loadChoke(root).choke_points.map((c) => c.id));
  const bad = [];
  const today = new Date().toISOString().slice(0, 10);
  // 「| X-」で始まるのに形に合わない行は、黙って読み飛ばさず赤（迂回箇所はパス 1 つ・KN-117・D-128.123）
  const md = existsSync(join(root, "03_architecture/choke-point-exceptions.md"))
    ? readFileSync(join(root, "03_architecture/choke-point-exceptions.md"), "utf8")
    : "";
  const parsed = new Set(loadExceptions(root).map((x) => x.id));
  for (const line of md.split("\n")) {
    const m = /^\| (X-\d+) \|/.exec(line);
    if (m && !parsed.has(m[1])) bad.push(`${m[1]}: 行の形が違う（| ID | 関門 | \`パス 1 つ\` | 理由 | 代替統制 | 期限 | 状態 |）`);
  }
  for (const x of loadExceptions(root)) {
    if (!ids.has(x.choke)) bad.push(`${x.id}: 関門 ${x.choke} が無い`);
    if (!x.control) bad.push(`${x.id}: 代替統制が無い`);
    if (!x.expires) bad.push(`${x.id}: 期限が無い（恒久なら「恒久」と書く）`);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(x.expires) && x.expires < today && x.status.includes("有効")) bad.push(`${x.id}: 期限切れ ${x.expires}`);
  }
  return bad;
}

const args = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { // 日本語のパスは percent-encode されるので href で比べる
  let code = 0;
  if (args.includes("--exceptions")) {
    const b = checkExceptions();
    console.log(b.length ? `[G25] 例外台帳 NG:\n  ${b.join("\n  ")}` : `[G25] 例外台帳 OK（${loadExceptions().length} 件）`);
    code = b.length ? 1 : 0;
  } else if (args.includes("--no-dynamic")) {
    const v = checkDynamic();
    console.log(v.length ? `[G24] 動的呼び出し:\n  ${v.join("\n  ")}` : "[G24] eval／new Function／文字列からの import なし");
    code = v.length ? 1 : 0;
  } else {
    const ids = args.includes("--all") ? loadChoke().choke_points.map((c) => c.id) : [args[args.indexOf("--id") + 1]];
    for (const id of ids) {
      const r = checkChoke(id);
      console.log(r.violations.length ? `[${id} ${r.name}] 迂回 ${r.violations.length}:\n  ${r.violations.join("\n  ")}` : `[${id} ${r.name}] 迂回なし（関門 ${r.gateway}／例外 ${r.exceptions.length}）`);
      if (r.violations.length) code = 1;
    }
  }
  process.exit(code);
}
