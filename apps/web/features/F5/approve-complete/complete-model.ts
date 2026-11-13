// 完了にする（K-183）の画面が読む形と、口と同じ数え方（口は K165 の app.ticket_complete）。
//   実施事項の項目＝本文の「- 」で始まる行（字下げした行も 1 項目）。上から 0 で数える。済みは「- [x]」（大文字の X も）
import type { Ops } from "@kaname/contracts";

type TicketCompleteInput = Ops["completeTicket"]["body"];

export interface TodoItem {
  /** 項目の文（頭の「- 」と印を除く） */
  text: string;
  /** 本文でもう済み（- [x]）。小窓では入ったままで外せない */
  done: boolean;
}
const ITEM = /^\s*- /;
const DONE = /^\s*- \[[xX]\](\s|$)/;

/** 実施事項の本文 → 項目の並び（並びの番号が口に送る番号） */
export function todoItems(text: string): TodoItem[] {
  return text
    .split("\n")
    .filter((line) => ITEM.test(line))
    .map((line) => {
      const done = DONE.test(line);
      const rest = done ? line.replace(/^\s*- \[[xX]\]\s*/, "") : line.replace(/^\s*- (\[ ?\]\s*)?/, "");
      return { text: rest.trimEnd(), done };
    });
}

/** 口に送る番号（入っている項目の番号・済みの項目も入る）。
 *  生成の型（TicketCompleteInput.todo_checked）は並びの中身を string にしているが、口は 0 からの整数だけを受ける（文字だと 422）。
 *  型を偽るのはこの 1 か所だけ。契約の生成が number[] を出すようになったら、この言い換えを外す（K-183 の申し送り） */
export function checkedNumbers(checked: boolean[]): TicketCompleteInput["todo_checked"] {
  const numbers: number[] = checked.flatMap((on, i) => (on ? [i] : []));
  return numbers as unknown as TicketCompleteInput["todo_checked"];
}

/** getTicket の答えの完了（K165 が足す）。by は押した人の表示名（引けなければ null） */
export interface Completed {
  at: string;
  by: string | null;
}
const JST_MS = 9 * 3600_000;
const pad = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の「11/08 15:20」 */
export function jstStamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() + JST_MS);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 帯の ⑦：「完了しました（高本・11/08 15:20）」。名前か時刻が引けなければ、引けた方だけを出す */
export function completedLine(c: Completed): string {
  const who = [c.by, jstStamp(c.at)].filter(Boolean).join("・");
  return who ? `完了しました（${who}）` : "完了しました";
}

/** 完了の口の 422 の明細（残りの項目・終わっていない子）。子は id があればそのチケットへのリンクにする */
export interface Problem {
  message: string;
  items: { text: string; href?: string }[];
}
