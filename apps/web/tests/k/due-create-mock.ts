// K-444「作る面の期限を決める小窓」の画面の試験の道具（K-444 の試験だけが読む・2026-11-21）。
//   口は前からの土台 create-mock.ts の mockCreate をそのまま使う（作る口 createTicket の due_on は今ある口）ので、ここに置くのは
//   正本の文（errors.json）の引き方・作る口の断りの答えの形・モックとの突き合わせの役だけ。
//   詳細で期限を変える小窓の道具（updateTicket の期限の組）は段 8 の K-484 の `due-mock.ts` の持ち物で、この葉は持たない（名前も分ける）。
//   名前と日付は下絵 /dev/mock/f4 の見本（f4-due-dialog・f4-due-past）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { ROOT } from "./kit";

// ---------------------------------------------------------------- 正本の文
const ERRORS = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string }[];
};
/** 正本の文（全部）。正本に無い番号は番号のまま返す（試験が赤になる） */
export const msgOf = (id: string): string => ERRORS.errors.find((e) => e.id === id)?.message ?? id;
/** 口の断り（正本の番号つき）。field があれば欄の理由も付ける */
export const errReply = (status: number, code: string, field?: string) => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : "validation_failed",
    code,
    message: msgOf(code),
    ...(field ? { field, details: [{ field, message: msgOf(code) }] } : {}),
  },
});

// ---------------------------------------------------------------- モックとの突き合わせの役（小窓。モック /dev/mock/f4 と本番で同じセレクタ・同じ部品）
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
export const DUE_PAIRS: FidelityPair[] = [
  ["dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["head", ".k-dialog-head", ["x", "y", "width", "height", "texts"]],
  ["quick", ".k-f4-due-q", CTRL],
  ["quick-on", ".k-f4-due-q[aria-pressed='true']", CTRL],
  ["month", ".k-f4-due-month", ["height", "font-size", "texts"]],
  ["day", ".k-f4-due-day", ["width", "height", "x", "opacity", "background-color", "color", "font-size"]],
  ["day-on", ".k-f4-due-day[aria-pressed='true']", ["width", "height", "x", "background-color", "color", "font-size"]],
  ["time", ".k-f4-due-time", ["x", "width", "height", "opacity", "texts"]],
  ["err", ".k-dialog .k-err", ["x", ...TEXT]],
  ["note", ".k-f4-due-note", ["x", "width", ...TEXT]],
  ["label", ".k-dialog .k-label", ["font-size", "font-weight", "texts"]],
  ["reason", ".k-dialog textarea", ["width", "height", "x", "y", "border-top-color", "font-size"]],
  ["btn", ".k-dialog-actions button", CTRL],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
