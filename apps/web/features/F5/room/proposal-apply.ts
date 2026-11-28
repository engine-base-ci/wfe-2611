// AI の案（K-775 の proposal）を、作る画面の左の欄に入れる（K-777・D-153.17）。値を受け取って新しい値を返すだけ（口は呼ばない）。
//   - itemsOf：カードの行（出した欄だけ・名前と先頭の字）
//   - applyProposal：選んだ欄を入れた新しい欄の値。題名・本文は案の字に替え、確認項目は今の物を残して案の物を後ろに足す（同じ字は 2 つにしない）。
//     人が先に書いていた欄でも小窓を出さず替える（answer=85c6211ac1b5・食い違いは AI が会話で聞く）
//   - resultOf：開き直したとき、欄の今の中身と案を欄ごとに比べた使った後の形（どの欄も違えば元のカード）

/** 案の形（K-775・出した欄だけ） */
export interface ProposalInput {
  title?: string;
  body?: string;
  checks?: readonly string[];
}

/** 左の欄の今の中身（題名・本文を 1 本の字にした物・確認項目の文の並び） */
export interface ProposalForm {
  title: string;
  body: string;
  checks: readonly string[];
}

export type ProposalKey = "title" | "body" | "checks";

export interface ProposalRow {
  key: ProposalKey;
  label: string;
  preview: string;
}

export type ProposalResult = "in" | "skipped";

export interface ProposalOutcome {
  /** open＝どの欄も入っていない／all＝出した欄が全部入っている／some＝一部だけ */
  mode: "open" | "all" | "some";
  results: Readonly<Partial<Record<ProposalKey, ProposalResult>>>;
}

const BODY_MAX = 80;
const BODY_LINES = 2;

const has = (v: string | undefined): v is string => typeof v === "string";

/** 出した欄の鍵（題名・本文・確認項目の順） */
export function keysOf(p: ProposalInput): ProposalKey[] {
  const keys: ProposalKey[] = [];
  if (has(p.title)) keys.push("title");
  if (has(p.body)) keys.push("body");
  if (p.checks && p.checks.length > 0) keys.push("checks");
  return keys;
}

/** 本文の先頭の 1〜2 行（80 字で切って「…」） */
export function bodyPreview(body: string): string {
  const lines = body.split("\n");
  const head = lines.slice(0, BODY_LINES).join("\n");
  const cut = head.length > BODY_MAX ? head.slice(0, BODY_MAX) : head;
  return cut.length < body.length ? `${cut}…` : cut;
}

/** 確認項目の先頭の字（1 件ならそのまま・2 件以上は「<1 件目> ほか <N-1> 件」） */
export function checksPreview(checks: readonly string[]): string {
  const [first = ""] = checks;
  return checks.length > 1 ? `${first} ほか ${checks.length - 1} 件` : first;
}

/** カードの行（出した欄だけ） */
export function itemsOf(p: ProposalInput): ProposalRow[] {
  return keysOf(p).map((key): ProposalRow => {
    if (key === "title") return { key, label: "題名", preview: p.title ?? "" };
    if (key === "body") return { key, label: "本文", preview: bodyPreview(p.body ?? "") };
    const checks = p.checks ?? [];
    return { key, label: `確認項目（${checks.length} 件）`, preview: checksPreview(checks) };
  });
}

/** 確認項目を足す（今の物を残し、同じ字は 2 つにしない） */
function mergeChecks(now: readonly string[], add: readonly string[]): string[] {
  const seen = new Set(now);
  const out = [...now];
  for (const c of add) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** 選んだ欄を入れた新しい欄の値（form は変えない） */
export function applyProposal(form: ProposalForm, p: ProposalInput, keys: readonly ProposalKey[]): ProposalForm {
  const pick = new Set(keys.filter((k) => keysOf(p).includes(k)));
  return {
    title: pick.has("title") && has(p.title) ? p.title : form.title,
    body: pick.has("body") && has(p.body) ? p.body : form.body,
    checks: pick.has("checks") && p.checks ? mergeChecks(form.checks, p.checks) : [...form.checks],
  };
}

/** 欄の今の中身が案の欄と同じか（確認項目は案の物が全部入っているか） */
function sameAs(form: ProposalForm, p: ProposalInput, key: ProposalKey): boolean {
  if (key === "title") return form.title === p.title;
  if (key === "body") return form.body === p.body;
  const now = new Set(form.checks);
  return (p.checks ?? []).every((c) => now.has(c));
}

/** 欄の今の中身と案を比べた使った後の形（開き直し・案が 2 つ以上で前のカードを替えるとき） */
export function resultOf(form: ProposalForm, p: ProposalInput): ProposalOutcome {
  const keys = keysOf(p);
  const results: Partial<Record<ProposalKey, ProposalResult>> = {};
  for (const k of keys) results[k] = sameAs(form, p, k) ? "in" : "skipped";
  const ins = keys.filter((k) => results[k] === "in").length;
  const mode = ins === 0 ? "open" : ins === keys.length ? "all" : "some";
  return { mode, results };
}
