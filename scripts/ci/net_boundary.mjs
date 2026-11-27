// 関門 C1 の例外（apps/bridge・apps/web）の代替統制：外へ出る口（fetch）の宛先が Kaname（設定の API の基点）か Bridge の口（ループバック）だけであることを AST で確かめる。
//   例外台帳 X-009（apps/bridge/src）・X-010（apps/web/lib）が「宛先は Kaname だけ」と書いている以上、それを人の注意ではなく機械で守る（choke-points.md §4・L-008）。
//   node scripts/ci/net_boundary.mjs            検査
//   node scripts/ci/net_boundary.test.mjs       検査の検査（仕込んだ迂回で赤になる）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = process.cwd();
/** 見る場所と、許す宛先の基点（テンプレート文字列 `${基点}/...` か `基点 + "..."` の形だけ） */
export const SCOPES = [
  {
    dir: "apps/bridge/src",
    bases: ["d.apiBase", "API_BASE", "apiBase", "API", "this.apiBase"],
    // 基点以外の URL を使ってよい 2 か所（どちらも Kaname が返した URL：署名つきの資料・目録に書かれた配布物）
    allow: { "apps/bridge/src/loop.ts": ["s.url"], "apps/bridge/src/update.ts": ["u.url"] },
  },
  {
    dir: "apps/web/lib",
    bases: ["apiBase()", "apiBase", "LOCAL"], // LOCAL＝この PC の Bridge の口（127.0.0.1:38617・local.ts）
    // 基点以外の URL を使ってよい 1 か所（Kaname の口が返した URL：C4 が署名した置き場の上げ先と、Kaname の上げ終わりの受け口・X-010・K-953）
    allow: { "apps/web/lib/upload-net.ts": ["t.upload_url", "t.done_url"] },
  },
];
const SKIP = /\.test\.(ts|tsx|mts)$|(^|\/)tests?\//;

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mts)$/.test(f)) yield p;
  }
}
/** fetch(...) の第 1 引数が「許した基点から始まる」か */
function headOf(arg, sf) {
  if (!arg) return { kind: "none", text: "" };
  if (ts.isTemplateExpression(arg)) {
    if (arg.head.text !== "") return { kind: "literal-head", text: arg.head.text };
    const first = arg.templateSpans[0]?.expression;
    return { kind: "template", text: first ? first.getText(sf) : "" };
  }
  if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.PlusToken) return { kind: "concat", text: arg.left.getText(sf) };
  if (ts.isNoSubstitutionTemplateLiteral(arg) || ts.isStringLiteral(arg)) return { kind: "literal", text: arg.text };
  return { kind: "expr", text: arg.getText(sf) };
}
export function checkNetBoundary(root = ROOT, scopes = SCOPES) {
  const violations = [];
  let seen = 0;
  for (const sc of scopes) {
    for (const file of walk(join(root, sc.dir))) {
      const rel = relative(root, file).split("\\").join("/");
      if (SKIP.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n) => {
        if (ts.isCallExpression(n)) {
          const e = n.expression;
          const isFetch = (ts.isIdentifier(e) && e.text === "fetch") || (ts.isPropertyAccessExpression(e) && e.name.text === "fetch" && ts.isIdentifier(e.expression) && ["globalThis", "window", "self"].includes(e.expression.text));
          if (isFetch) {
            seen++;
            const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
            const h = headOf(n.arguments[0], sf);
            const okBase = (h.kind === "template" || h.kind === "concat") && sc.bases.includes(h.text);
            const okAllow = h.kind === "expr" && (sc.allow[rel] ?? []).includes(h.text);
            if (!okBase && !okAllow) violations.push(`${rel}:${line} fetch(${h.text || "…"}) — 宛先が許した基点（${sc.bases.join("／")}）から始まっていない`);
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }
  return { seen, violations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = checkNetBoundary();
  console.log(
    r.violations.length
      ? `[G16b 外へ出る口の宛先] NG ${r.violations.length} 件（見た fetch ${r.seen}）:\n  ${r.violations.join("\n  ")}`
      : `[G16b 外へ出る口の宛先] OK（fetch ${r.seen} か所すべて Kaname か Bridge の口が宛先）`,
  );
  process.exit(r.violations.length ? 1 : 0);
}
