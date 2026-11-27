// 形全体の決まり（契約の入力の形の oneOf・anyOf・allOf・not・K-355 の INPUT_RULES）を入口で確かめる（D-129.42・PM の決め 2026-11-28）。
//   中身は schemas.ts の INPUT_RULES（contract.mjs gen が契約から写す）。zod が欄ごとの形を確かめた後の体に当てる。
//   読む言葉：properties・required・not・allOf・anyOf・oneOf・enum・const・type・pattern・minLength・maxLength・minimum・maximum・
//   minItems・maxItems・contains・items。ほかの言葉は確かめない（契約の作り手 build_api.py は oneOf／anyOf／allOf／not だけを書く）
type Schema = Record<string, unknown>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const typeOk = (t: unknown, v: unknown): boolean => {
  if (t === "string") return typeof v === "string";
  if (t === "integer") return Number.isInteger(v);
  if (t === "number") return typeof v === "number";
  if (t === "boolean") return typeof v === "boolean";
  if (t === "array") return Array.isArray(v);
  if (t === "object") return isObj(v);
  if (t === "null") return v === null;
  return true;
};
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const len = (s: string): number => [...s].length;

/** 1 つの形に値が合うか（JSON Schema の決まりの一部） */
export function matches(s: unknown, v: unknown): boolean {
  if (!isObj(s)) return true;
  if (s["type"] !== undefined && !typeOk(s["type"], v)) return false;
  if (Array.isArray(s["enum"]) && !s["enum"].some((x) => deepEq(x, v))) return false;
  if ("const" in s && !deepEq(s["const"], v)) return false;
  if (typeof v === "string") {
    if (typeof s["minLength"] === "number" && len(v) < s["minLength"]) return false;
    if (typeof s["maxLength"] === "number" && len(v) > s["maxLength"]) return false;
    if (typeof s["pattern"] === "string" && !new RegExp(s["pattern"], "u").test(v)) return false;
  }
  if (typeof v === "number") {
    if (typeof s["minimum"] === "number" && v < s["minimum"]) return false;
    if (typeof s["maximum"] === "number" && v > s["maximum"]) return false;
  }
  if (Array.isArray(v)) {
    if (typeof s["minItems"] === "number" && v.length < s["minItems"]) return false;
    if (typeof s["maxItems"] === "number" && v.length > s["maxItems"]) return false;
    if (s["contains"] !== undefined && !v.some((x) => matches(s["contains"], x))) return false;
    if (isObj(s["items"]) && !v.every((x) => matches(s["items"], x))) return false;
  }
  if (isObj(v)) {
    if (Array.isArray(s["required"]) && !s["required"].every((k) => String(k) in v && v[String(k)] !== undefined))
      return false;
    if (isObj(s["properties"]))
      for (const [k, sub] of Object.entries(s["properties"]))
        if (k in v && v[k] !== undefined && !matches(sub, v[k])) return false;
  }
  if (Array.isArray(s["allOf"]) && !s["allOf"].every((x) => matches(x, v))) return false;
  if (Array.isArray(s["anyOf"]) && !s["anyOf"].some((x) => matches(x, v))) return false;
  if (Array.isArray(s["oneOf"]) && s["oneOf"].filter((x) => matches(x, v)).length !== 1) return false;
  if (s["not"] !== undefined && matches(s["not"], v)) return false;
  return true;
}

/** 形全体の決まり（INPUT_RULES の 1 つ）に体が合うか */
export const inputRulesOk = (rule: Schema | undefined, body: unknown): boolean =>
  rule === undefined || matches(rule, body);

/** 問い合わせの値（字）を形の型に寄せる。数の形でない字はそのまま（形が断る） */
const coerce = (s: unknown, v: string): unknown => {
  const t = isObj(s) ? s["type"] : undefined;
  if ((t === "integer" || t === "number") && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (t === "boolean" && (v === "true" || v === "false")) return v === "true";
  return v;
};

/** 問い合わせを契約の形で確かめる。知らない名前・形に合わない値の欄を返す（空の値は「指定なし」なので見ない） */
export function queryIssues(
  rules: Record<string, unknown> | undefined,
  query: Record<string, string>,
): { field: string; message: string }[] {
  if (rules === undefined) return [];
  const out: { field: string; message: string }[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (!(k in rules)) {
      out.push({ field: k, message: "契約に無い問い合わせ" });
      continue;
    }
    if (v === "") continue;
    if (!matches(rules[k], coerce(rules[k], v))) out.push({ field: k, message: "契約の値の形に合わない" });
  }
  return out;
}
