"use client";
// 承認と実行の帯（K-162・K-182・K-183・K-63 の孫）：チケットの詳細の題名のすぐ下（<section aria-label="承認と実行">・どの状態でも同じ名前）。
//   帯は段で分ける（D-128.178）：作る段（phase make）の間は何も描かない（K-62 の帯だけ）。部品は置いたままで、
//   今の実行が走っている間は 3 秒ごとにチケットを読み直す（作る段が終わって承認待ちになったら帯に替わる・K63-UI-044）。
//     ① 承認待ち・決められる人 … decide.tsx（成果物の中身・「承認して送る」「差し戻す」）
//     ② 承認待ち・決められない人 … 描かない（K-62 の帯「成果物ができました。承認待ちです」）。担当者がいなければその文（K63-UI-049）
//     ③ 承認の後の実行が走っている … pc live は「実行中」・running で pc asleep は「実行中・PC が閉じています…」・asking は「AI が許可を求めています…」
//     ④ 実行待ち・PC が閉じている（queued・pc asleep）… 「実行待ち・PC が閉じています…」（queued・pc live は「実行中」）
//     ⑤ 止まった … 実行の記録（action_runs）の止まった理由を全文そのまま（切らない・言い換えない・D-131.2・D-131.4）
//     ⑥ 作業中・承認待ちなし・走っている実行なし・can.complete（AI に任せていないチケットも・K-184）… 「完了の条件を確かめて完了にしてください」＋「完了にする」（小窓は complete-dialog.tsx）
//     ⑦ 完了 … 「完了しました（高本・11/08 15:20）」・ボタンなし
//   ③〜⑤ はボタンなし（K-182）。止まったときも自動で戻さず、ボタンは「完了にする」だけ（K63-UI-035）。
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く。本人確認は取り直さない（D-128.177）
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, Callout } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { isActive, type RunView } from "@/features/F5/delegate/use-run";
import { CompleteDialog } from "./complete-dialog";
import { completedLine, type Completed } from "./complete-model";
import { DecideBody, type BandApproval } from "./decide";
import { messageOf } from "./message";

export type { BandApproval } from "./decide";
export const BAND_LABEL = "承認と実行";
const POLL_MS = 3_000;
const MSG = {
  noAssignee: "担当者がいないので、承認する人がいません。担当者を決めてください",
  running: "実行中",
  runningAsleep: "実行中・PC が閉じています。開くと続きます",
  asking: "AI が許可を求めています。許可は自動で断られ、続けられなければ止まります",
  pcClosed: "実行待ち・PC が閉じています。開いたらすぐ実行します。承認から 24 時間を過ぎたら、もう一度聞きます",
  completeHint: "完了の条件を確かめて完了にしてください",
} as const;
/** 完了にできる段は作業中だけ（口の can.complete と同じ判定を画面でも重ねる・K63-UI-031・K63-UI-061） */
const COMPLETABLE_STAGE = "doing";

/** 承認の後の実行（phase execute）の今の様子の文。帯は実行の記録（getActionRun）だけを読む。終わった（done）・理由の無い結末は何も出さない */
function executeLine(run: RunView): string | null {
  if (!isActive(run)) return run.status === "done" ? null : run.stopped_reason || null; // ⑤ 理由は口の文をそのまま
  if (run.status === "asking") return MSG.asking;
  if (run.pc !== "asleep") return MSG.running; // queued・running で PC が開いている
  return run.status === "queued" ? MSG.pcClosed : MSG.runningAsleep;
}

interface Section {
  key: string;
  label: string;
  body: { text?: string } | null;
  version: number;
}
/** 帯が読む getTicket の答えのところ（K-60 の詳細・K-162 の approval・K165 の can.complete と completed） */
export interface BandTicket {
  stage: { key?: string | null } | null;
  assignee: unknown;
  sections: Section[];
  approval?: BandApproval | null;
  can?: { complete?: boolean } | null;
  completed?: Completed | null;
}
interface Props<T extends BandTicket> {
  ticketId: string;
  ticket: T;
  run: RunView | null;
  /** 実行の様子が分かっているか（一覧を読み終えた・任せた実行が届いた）。分かるまでは「完了にする」を出さない */
  runKnown: boolean;
  /** 読み直したチケット（詳細の全体を差し替える） */
  onTicket: (t: T) => void;
  /** 決めた・断られた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
}

/** 今の実行が走っている間だけ、3 秒ごとにチケットを読み直す（動いていないときは止める） */
function usePolledTicket<T>(ticketId: string, active: boolean, onTicket: (t: T) => void) {
  const polled = useQuery({
    queryKey: ["k63", "ticket", ticketId],
    enabled: active,
    retry: false,
    refetchInterval: active ? POLL_MS : false,
    queryFn: async (): Promise<T | null> => {
      const r = await call("getTicket", { params: { id: ticketId }, screenId: "tickets" });
      return r.ok ? (r.data as unknown as T) : null;
    },
  });
  const onTicketRef = useRef(onTicket);
  onTicketRef.current = onTicket;
  useEffect(() => {
    if (polled.data) onTicketRef.current(polled.data);
  }, [polled.data]);
}

/** ⑥ 完了にできるか：段が作業中・承認待ちが無い・走っている実行が無い（作る段も）・口が can.complete と答えた。
 *  AI に任せていない（実行の記録が無い）チケットでも出す（K63-UI-059） */
function canCompleteNow(ticket: BandTicket, run: RunView | null, runKnown: boolean): boolean {
  if (!runKnown || isActive(run) || ticket.approval) return false; // 「走っている実行が無い」は分かってから数える（K63-UI-069〜071）
  return ticket.can?.complete === true && ticket.stage?.key === COMPLETABLE_STAGE;
}

const sectionOf = (ticket: BandTicket, key: string, fallback: string) => {
  const s = ticket.sections.find((x) => x.key === key);
  return { label: s?.label ?? fallback, text: s?.body?.text ?? "", version: s?.version ?? 0 };
};

export function ApproveBand<T extends BandTicket>({ ticketId, ticket, run, runKnown, onTicket, onChanged }: Props<T>) {
  usePolledTicket(ticketId, isActive(run), onTicket);
  const [notice, setNotice] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false); // 完了の小窓（「完了にする」を出せる間だけ開く）
  /** 口が断った（409・404 など）：知らせを出して読み直す。401 は入り直し（共通の扱い・戻る先にこのチケット） */
  const failed = async (r: CallErr) => {
    if (r.status === 401) return;
    setNotice(messageOf(r));
    await onChanged();
  };

  const approval = ticket.approval ?? null;
  const execute = run?.phase === "execute" ? run : null;
  const complete = canCompleteNow(ticket, run, runKnown);
  // 「完了にする」を出さない形に替わったら（実行が走り出した・承認待ちになった・段が変わった）、開いていた小窓も閉じる
  useEffect(() => {
    if (!complete) setCompleting(false);
  }, [complete]);
  const body = (() => {
    if (ticket.stage?.key === "done") return ticket.completed ? <p>{completedLine(ticket.completed)}</p> : null; // ⑦
    if (approval?.can_decide)
      return <DecideBody approval={approval} onChanged={onChanged} onFailed={failed} onStart={() => setNotice(null)} />;
    if (approval && ticket.assignee === null) return <p>{MSG.noAssignee}</p>;
    if (approval) return null; // 決められない人：K-62 の帯だけ（D-128.178）
    const line = execute ? executeLine(execute) : null; // 作る段の間・まだ任せていない：K-62 の帯だけ
    if (!line && !complete) return null;
    return (
      <>
        {line ? <p className="k62-band-line">{line}</p> : null}
        {complete ? <CompleteHint onOpen={() => setCompleting(true)} /> : null}
      </>
    );
  })();

  const dialogOpen = completing && complete;
  if (!body && !notice && !dialogOpen) return null;
  return (
    <section aria-label={BAND_LABEL} className="k62-band k-section">
      {notice ? <Callout tone="danger">{notice}</Callout> : null}
      {body}
      {dialogOpen ? (
        <CompleteDialog
          ticketId={ticketId}
          todo={sectionOf(ticket, "todo", "実施事項")}
          conditions={sectionOf(ticket, "done", "完了の条件")}
          onClose={() => setCompleting(false)}
          onDone={async () => {
            setNotice(null);
            await onChanged();
          }}
          onFailed={failed}
        />
      ) : null}
    </section>
  );
}

/** ⑥ 完了の案内と「完了にする」（押すと完了の小窓） */
function CompleteHint({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <p className="k62-band-line">{MSG.completeHint}</p>
      <div>
        <Button onClick={onOpen}>完了にする</Button>
      </div>
    </>
  );
}
