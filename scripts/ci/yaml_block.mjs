// 契約（08_api/openapi.yaml）の字下げの形だけを読む小さな YAML の読み手（contract.mjs が形全体の決まり oneOf・anyOf・allOf・not を取り出すのに使う）。
//   読める形：字下げの対応表・「- 」の並び（同じ字下げの並びも）・&別名／*別名・{}・[]・[a, b]・折り返した字（深い字下げの続き）・'…'／"…"。
//   ほかの形（|・> の塊・{a: b} の流れの対応表）は投げる（黙って違う値にしない）
const indentOf = (l) => l.length - l.trimStart().length;
const blank = (l) => l.trim() === "" || l.trim().startsWith("#");

function scalar(raw, anchors) {
  const t = raw.trim();
  if (t.startsWith("*")) {
    const k = t.slice(1);
    if (!(k in anchors)) throw new Error(`YAML の別名 ${k} が無い`);
    return structuredClone(anchors[k]);
  }
  if (t === "{}") return {};
  if (t === "[]") return [];
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1).split(",").map((x) => scalar(x, anchors));
  if (t.startsWith("{") || t === "|" || t === ">" || t.startsWith("|") || t.startsWith(">")) throw new Error(`読めない YAML の形：${t.slice(0, 40)}`);
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  if (t.startsWith('"') && t.endsWith('"')) return JSON.parse(t);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

/** lines[i] から字下げ indent の塊を読む。[値, 次の行] */
export function parseBlock(lines, i, indent, anchors = {}) {
  while (i < lines.length && blank(lines[i])) i++;
  if (i >= lines.length) return [null, i];
  const isList = lines[i].trimStart().startsWith("- ") || lines[i].trim() === "-";
  return isList ? parseList(lines, i, indentOf(lines[i]), anchors) : parseMap(lines, i, indent, anchors);
}

/** 値の字の続き（より深い字下げの行）を足す */
function withContinuation(lines, i, first, minIndent) {
  const parts = [first];
  while (i + 1 < lines.length && !blank(lines[i + 1]) && indentOf(lines[i + 1]) > minIndent && !/^\s*- /.test(lines[i + 1]) && !/^\s*[\w'"-]+:( |$)/.test(lines[i + 1].trimStart() ? lines[i + 1].trimStart() : "")) parts.push(lines[++i].trim());
  return [parts.join(" "), i];
}

function value(lines, i, rest, keyIndent, anchors) {
  let r = rest.trim();
  let anchor = null;
  const m = /^&(\S+)(?:\s+(.*))?$/.exec(r);
  if (m) {
    anchor = m[1];
    r = (m[2] ?? "").trim();
  }
  let v;
  if (r === "") {
    // 中身は次の行から（より深い字下げか、同じ字下げの「- 」の並び）
    let j = i + 1;
    while (j < lines.length && blank(lines[j])) j++;
    if (j < lines.length && (indentOf(lines[j]) > keyIndent || (indentOf(lines[j]) === keyIndent && /^\s*- /.test(lines[j])))) {
      [v, i] = parseBlock(lines, j, indentOf(lines[j]), anchors);
      i -= 1;
    } else v = null;
  } else {
    [r, i] = withContinuation(lines, i, r, keyIndent);
    v = scalar(r, anchors);
  }
  if (anchor) anchors[anchor] = structuredClone(v);
  return [v, i + 1];
}

function parseMap(lines, i, indent, anchors) {
  const out = {};
  while (i < lines.length) {
    if (blank(lines[i])) { i++; continue; }
    const ind = indentOf(lines[i]);
    if (ind < indent) break;
    if (ind > indent) throw new Error(`YAML の字下げが合わない（${i + 1} 行目）`);
    const t = lines[i].trimStart();
    if (t.startsWith("- ")) break;
    const m = /^('[^']*'|"[^"]*"|[^:]+?):(?:\s+(.*))?$/.exec(t);
    if (!m) throw new Error(`YAML の対応表の行でない（${i + 1} 行目）：${t.slice(0, 40)}`);
    const key = String(scalar(m[1], anchors));
    [out[key], i] = value(lines, i, m[2] ?? "", indent, anchors);
  }
  return [out, i];
}

function parseList(lines, i, indent, anchors) {
  const out = [];
  while (i < lines.length) {
    if (blank(lines[i])) { i++; continue; }
    const ind = indentOf(lines[i]);
    if (ind < indent || !/^\s*- /.test(lines[i]) || ind !== indent) break;
    const rest = lines[i].slice(ind + 2);
    if (/^('[^']*'|"[^"]*"|[\w-]+):(\s|$)/.test(rest.trimStart())) {
      // 並びの 1 つが対応表（「- key: v」の続きは字下げ indent+2）
      const copy = [...lines];
      copy[i] = " ".repeat(ind + 2) + rest.trimStart();
      const [v, j] = parseMap(copy, i, ind + 2, anchors);
      out.push(v);
      i = j;
    } else {
      const [v, j] = value(lines, i, rest, ind, anchors);
      out.push(v);
      i = j;
    }
  }
  return [out, i];
}

/** components.schemas の対応表全体（名前 → 形）。&別名は文書の中で前から順に解く */
export function parseSchemas(yaml) {
  const lines = yaml.split("\n");
  const anchors = {};
  // paths の中の &別名を先に拾う（components は後ろにあるが、別名は文書の頭から順に決まる）
  const c = lines.findIndex((l) => l === "components:");
  const s = lines.findIndex((l, k) => k > c && l === "  schemas:");
  if (c < 0 || s < 0) return {};
  // 頭から schemas の前までの別名：components の中の別名だけを使う形にする（paths の別名は形の決まりに出ない）
  const [v] = parseBlock(lines, s + 1, 4, anchors);
  return v ?? {};
}

/** 口ごとの問い合わせの形（operationId → { 名前: 形 }）。in: query の parameters だけ */
export function parseQueries(yaml) {
  const [doc] = parseBlock(yaml.split("\n"), 0, 0, {});
  const out = {};
  for (const methods of Object.values(doc?.paths ?? {}))
    for (const o of Object.values(methods ?? {})) {
      if (!o || typeof o !== "object" || !o.operationId) continue;
      out[o.operationId] = Object.fromEntries(
        (o.parameters ?? []).filter((x) => x && x.in === "query").map((x) => [x.name, x.schema ?? {}]),
      );
    }
  return out;
}
