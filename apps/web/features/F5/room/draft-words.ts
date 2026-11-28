// 作る画面の右の AI との会話（K-767）の字と、欄の中身の組み立て。
//   draftOf：その時の欄の中身（題名・本文を 1 本の字にした物・確認項目の文の並び）を言う口（sendDraftMessage）の draft の形にする
//   editedOf：前に AI に渡した中身から、人が直した欄（AI の案を欄に入れた分は、入れたときに基準を替えるので入らない・K-777）
//   passedText：人の言葉の上に出す「題名・本文（直した）を AI に渡しました」
import { CATALOG } from "@kaname/errors/catalog";

export type DraftKey = "title" | "body" | "checks";
export interface DraftNow {
  title: string;
  body: string;
  checks: string[];
}
export const EMPTY_DRAFT: DraftNow = { title: "", body: "", checks: [] };

/** 話しかける例（下絵 create-talk-empty の字・押すとその字で言う） */
export const STARTERS = [
  "セイコー様に 12 月分の作業報告書を送るチケットを作りたい",
  "来週の定例の議事録をまとめるチケットを作りたい",
  "経費の申請を出し直すチケットを作りたい",
] as const;

const KEY_LABEL: Record<DraftKey, string> = { title: "題名", body: "本文", checks: "確認項目" };
const KEYS: readonly DraftKey[] = ["title", "body", "checks"];

/** 文書（Doc の木）か字の並びから、字だけを 1 本に（段落の間は改行） */
function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join("\n");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["text"] === "string") return o["text"];
    if ("content" in o) return textOf(o["content"]);
    if ("doc" in o) return textOf(o["doc"]);
  }
  return "";
}

/** 確認項目の並び（字の並びか { text } の並び）を文の並びに */
function checksOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => textOf(c).trim()).filter((c) => c !== "");
}

/** 欄の中身（下書きの形）から言う口の draft を作る。本文は body（文書）か、区画の欄（sections）を 1 本の字にする */
export function draftOf(form: {
  title?: string | null;
  body?: unknown;
  sections?: Record<string, string> | null;
  specs?: unknown;
  checks?: unknown;
}): DraftNow {
  const body =
    form.body !== undefined && form.body !== null
      ? textOf(form.body)
      : Object.values(form.sections ?? {})
          .map((s) => s.trim())
          .filter(Boolean)
          .join("\n");
  return {
    title: form.title ?? "",
    body,
    checks: checksOf(form.checks ?? form.specs),
  };
}

/** 前に AI に渡した中身から、人が直した欄。前に渡していなければ空 */
export function editedOf(prev: DraftNow | null, now: DraftNow): DraftKey[] {
  if (!prev) return [];
  return KEYS.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(now[k]));
}

/** 人の言葉の上に出す渡した印。直した欄が無ければ出さない */
export function passedText(passed: readonly string[] | null | undefined): string | undefined {
  const names = (passed ?? []).filter((k): k is DraftKey => k in KEY_LABEL).map((k) => KEY_LABEL[k]);
  return names.length ? `${names.join("・")}（直した）を AI に渡しました` : undefined;
}

/** 正本の文（errors.json）。正本に無い番号は null（画面は決まった字に倒す） */
export function catalogText(code: string): string | null {
  return CATALOG[code]?.message ?? null;
}

/** 答えを返せなかった（503 ほか）の帯の字（下絵 create-talk-error） */
export const SEND_FAILED = {
  title: "答えを返せませんでした",
  body: "もう一度送れます。左の欄に書いた物は消えていません",
} as const;

/** 作った後に会話を移せなかったときの字（詳細の AI のタブの上） */
export const ADOPT_FAILED = "作る時の会話をこのチケットに移せませんでした。作る画面の会話は残っています";
