// 問い合わせる小窓（K-953）の決まった形（画面の外の純粋な関数・@/ を読まない）：
//   題と内容の確かめ・付けるファイルの確かめ・いま見ている画面の情報・何について の字と口の値・ファイルの大きさの字。
//   字の数は文字（コードポイント）で数える（絵文字は 1 字）。前後の空白は全角・タブ・改行も落とす。口を呼ばない

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const TITLE_MAX = 100;
export const BODY_MAX = 4000;

/** 付けられる種類（画像・PDF・zip・D-156.26） */
export const ACCEPT_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
];

export const FILE_TEXT = {
  big: "大きすぎて付けられません（1 つ 10MB まで・5 つまで）",
  type: "この種類は付けられません（画像・PDF・zip）",
  empty: "中身が空のファイルは付けられません",
  failed: "付けられませんでした。もう一度付けてください",
} as const;

/** 何について の字 → 口の値（topic） */
export const TOPIC_OF: Readonly<Record<string, "usage" | "trouble" | "billing" | "other">> = {
  使い方: "usage",
  うまく動かない: "trouble",
  "お金・プラン": "billing",
  ほか: "other",
};

const chars = (s: string): number => [...s].length;
/** 前後の空白（全角・タブ・改行も）を落とす */
export const tidy = (s: string): string => s.replace(/^[\s\u3000]+|[\s\u3000]+$/gu, "");

export interface AskProblems {
  title?: string;
  body?: string;
}

/** 題と内容の確かめ。問題の無い欄は鍵を持たない */
export function askProblems(v: { title: string; body: string }): AskProblems {
  const out: AskProblems = {};
  const title = tidy(v.title);
  const body = tidy(v.body);
  if (title === "") out.title = "題を書いてください";
  else if (chars(title) > TITLE_MAX) out.title = `題は ${TITLE_MAX} 字までです`;
  if (body === "") out.body = "内容を書いてください";
  else if (chars(body) > BODY_MAX) out.body = `内容は ${BODY_MAX} 字までです`;
  return out;
}

/** 付けるファイルの確かめ。count は今付いている（付けている途中も含む）数。付けられれば null、ほかは行に出す理由の字 */
export function fileProblem(file: { type: string; size: number }, count: number): string | null {
  if (!ACCEPT_TYPES.includes(file.type)) return FILE_TEXT.type;
  if (file.size > MAX_FILE_BYTES || count >= MAX_FILES) return FILE_TEXT.big;
  if (file.size <= 0) return FILE_TEXT.empty;
  return null;
}

/** ファイルの大きさの字（1.2MB・48MB・30KB・10B） */
export function fileSize(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${String(Math.round((bytes / mb) * 10) / 10)}MB`;
  if (bytes >= 1024) return `${String(Math.round(bytes / 1024))}KB`;
  return `${String(bytes)}B`;
}

export interface AskContext {
  path: string;
  at: string;
  browser: string;
  pc?: boolean;
}

/** 同じ場所の道か（/ で始まり、// と /\ で始まらない） */
const samePlace = (p: string | null | undefined): p is string =>
  typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");

/** ブラウザの名前と版（「Chrome 130」）。読めなければ UA の頭 60 字 */
function browserOf(ua: string): string {
  const rules: [RegExp, string][] = [
    [/Edg\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//, "Safari"],
  ];
  for (const [re, name] of rules) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]!}`;
  }
  return ua.slice(0, 60);
}

/** いま見ている画面の情報（チケットの中身や会話は付けない・D-128.71）。PC のつながりが分からなければ欄なし */
export function askContext(v: {
  from: string | null | undefined;
  here: string;
  ua: string;
  pc: boolean | null | undefined;
  at: Date;
}): AskContext {
  const out: AskContext = {
    path: samePlace(v.from) ? v.from : v.here,
    at: v.at.toISOString(),
    browser: browserOf(v.ua),
  };
  if (typeof v.pc === "boolean") out.pc = v.pc;
  return out;
}
