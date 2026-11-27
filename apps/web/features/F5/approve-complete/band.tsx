"use client";
// 承認と実行の帯（K-162・K-182・K-183・K-63 の孫）：チケットの詳細の題名のすぐ下（<section aria-label="承認と実行">・どの状態でも同じ名前）。
//   帯は段で分ける（D-128.178）：作る段（phase make）の間は何も描かない（K-62 の帯だけ）。部品は置いたままで、
//   今の実行が走っている間は 3 秒ごとにチケットを読み直す（作る段が終わって承認待ちになったら帯に替わる・K63-UI-044）。
//     ① 承認待ち・決められる人 … decide.tsx（成果物の中身・「承認して送る」「差し戻す」）
//     ② 承認待ち・決められない人 … 描かない（K-62 の帯「成果物ができました。承認待ちです」）。担当者がいなければその文の橙の箱（K63-UI-049・K-227）
//   口の失敗の知らせは帯の region の中の赤い箱（NoticeBox・K-227）
//     ③ 承認の後の実行が走っている … pc live は「実行中」・running で pc asleep は「実行中・PC が閉じています…」・asking は「AI が許可を求めています…」
//     ④ 実行待ち・PC が閉じている（queued・pc asleep）… 「実行待ち・PC が閉じています…」（queued・pc live は「実行中」）
//     ④' 片付けに失敗した待っている実行（sweep_failed_at あり・K-1192）… 赤い箱「片付けに失敗しています」。［この実行を止める］は担当者だけ（sweep-failed.tsx）
//     ⑤ 止まった … 実行の記録（action_runs）の止まった理由を全文そのまま（切らない・言い換えない・D-131.2・D-131.4）
//     ⑥ 作業中・承認待ちなし・走っている実行なし・can.complete（AI に任せていないチケットも・K-184）… 「完了の条件を確かめて完了にしてください」（案内の字だけ）。
//        「完了にする」のボタンは題の行（complete-act.tsx・K-572）。押したときの流れ（use-complete.ts）の小窓と赤い知らせは、この帯が同じ store を読んで出す
//     ⑦ 完了 … 「完了しました（高本・11/08 15:20）」・ボタンなし
//   ③〜⑤ はボタンなし（K-182）。止まったときも自動で戻さない（「完了にする」は題の行・K63-UI-035）。
//   箱は components/k の Band（K-228・キャンバス StConfirmDone・StDone）：④ は淡い橙（題「実行待ち ・ PC が閉じています」・「PC をつなぐ」のリンク）、
//   ③ は青（題が今の文）、⑤ は赤（role=alert・題「実行が止まりました」・理由の全文）、⑥ は白（案内の字）、⑦ は緑
//   帯の section の印 data-busy（K-620）：AI が動いている・承認待ちの間だけ付ける（① 決める帯・担当者なしの箱・③ 実行が走っている・④ 実行待ち）。
//   ⑤ 止まった・⑥ 完了にする・⑦ 完了・知らせだけのときは付けない。題名の下の帯の順の器（F4 の detail-slots.ts・属性の名前は両方の注に書く）が
//   この印の付いた帯だけを「承認・実行の帯」と数え、渡し・保留の帯に譲らせる。帯の section は状態が替わっても同じ要素のまま
//   段 6 の画面の葉の差し込み口（K-730・features/F5/more/slots.tsx）：③ 走っている箱の acts＝StopRunActSlot（where execute）・
//   実行待ち（④ と ③ の queued）の箱＝ExecuteQueuedSlot。帯の上の知らせ（TicketNotice）は ① 承認待ちの箱を出している間だけここが描く（ほかは K-62 の帯）
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く。本人確認は取り直さない（D-128.177）
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Band, BandLine, NoticeBox } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { isActive, type RunView } from "@/features/F5/delegate/use-run";
import { ExecuteQueuedSlot, StopRunActSlot, TicketNotice } from "@/features/F5/more/slots";
import { useNotice, useTrail } from "@/features/F5/more/trail";
import { CompleteBlockedDialog } from "@/features/F9/knowledge/ticket-views";
import { CompleteDialog } from "./complete-dialog";
import { completedLine, type Completed } from "./complete-model";
import { DecideBody, type BandApproval } from "./decide";
import { messageOf } from "./message";
import { docOf, useComplete } from "./use-complete";
import { SweepFailedBand } from "./sweep-failed";
import { docOf, useComplete } from "./use-complete";

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
  waitTitle: "実行待ち ・ PC が閉じています",
  stoppedTitle: "実行が止まりました",
} as const;
const SETUP_BRIDGE = "/setup/bridge";
/** 完了にできる段は作業中だけ（口の can.complete と同じ判定を画面でも重ねる・K63-UI-031・K63-UI-061） */
const COMPLETABLE_STAGE = "doing";

/** 承認の後の実行（phase execute）の今の様子。帯は実行の記録（getActionRun）だけを読む。終わった（done）・理由の無い結末は何も出さない */
type ExecuteView =
  | { kind: "running"; title: string; queued: boolean }
  | { kind: "wait" }
  | { kind: "sweepFailed" }
  | { kind: "stopped"; reason: string }
  | null;
function executeView(run: RunView): ExecuteView {
  if (!isActive(run)) {
    if (run.status === "done" || !run.stopped_reason) return null;
    return { kind: "stopped", reason: run.stopped_reason }; // ⑤ 理由は口の文をそのまま
  }
  if (run.status === "queued" && run.sweep_failed_at) return { kind: "sweepFailed" }; // ④ の代わり（PC の様子に関わらず・K-1192）
  if (run.status === "asking") return { kind: "running", title: MSG.asking, queued: false };
  if (run.pc !== "asleep") return { kind: "running", title: MSG.running, queued: run.status === "queued" }; // queued・running で PC が開いている
  return run.status === "queued" ? { kind: "wait" } : { kind: "running", title: MSG.runningAsleep, queued: false };
}

/** 帯が読む getTicket の答えのところ（K-60 の詳細・K-162 の approval・K165 の can.complete と completed） */
export interface BandTicket {
  /** 番号と題名（小窓の頭の下の対象の行・K-229） */
  ticket?: { number?: string | null; title?: string | null } | null;
  stage: { key?: string | null } | null;
  assignee: unknown;
  /** 本文（K-560 の getTicket の body）。無い答えは本文の未チェック 0 */
  body?: { doc?: unknown } | null;
  approval?: BandApproval | null;
  can?: { complete?: boolean } | null;
  completed?: Completed | null;
  /** 確認項目を使わない理由（K-560 の getTicket の no_spec_reason・承認のカードの要約に足す・K-573） */
  no_spec_reason?: string | null;
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

/** チケットの詳細の問い合わせ（詳細の最初の読み込みと帯の読み直しで分け合う・同じ口を 2 回呼ばない・K-235） */
export const ticketKey = (ticketId: string) => ["k63", "ticket", ticketId] as const;
/** チケットの詳細を読む。断られたら答え（result）をつけて投げる（読み直しの失敗では、前に読んだ答えを残す） */
export async function readTicket<T>(ticketId: string): Promise<T> {
  const r = await call("getTicket", { params: { id: ticketId }, screenId: "tickets" });
  if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
  return r.data as unknown as T;
}

/** 今の実行が走っている間だけ、3 秒ごとにチケットを読み直す（動いていないときは止める）。
 *  詳細が読んだ答えを同じ器から使い、走り出した直後に読み直さない（次の読み直しは 3 秒後） */
function usePolledTicket<T>(ticketId: string, active: boolean, onTicket: (t: T) => void) {
  const polled = useQuery({
    queryKey: ticketKey(ticketId),
    enabled: active,
    retry: false,
    staleTime: POLL_MS,
    refetchInterval: active ? POLL_MS : false,
    queryFn: () => readTicket<T>(ticketId),
  });
  const onTicketRef = useRef(onTicket);
  onTicketRef.current = onTicket;
  useEffect(() => {
    if (polled.data) onTicketRef.current(polled.data);
  }, [polled.data]);
}

/** ⑥ 完了にできるか：段が作業中・承認待ちが無い・走っている実行が無い（作る段も）・口が can.complete と答えた。
 *  AI に任せていない（実行の記録が無い）チケットでも出す（K63-UI-059） */
export function canCompleteNow(ticket: BandTicket, run: RunView | null, runKnown: boolean): boolean {
  if (!runKnown || isActive(run) || ticket.approval) return false; // 「走っている実行が無い」は分かってから数える（K63-UI-069〜071）
  return ticket.can?.complete === true && ticket.stage?.key === COMPLETABLE_STAGE;
}

/** 小窓の対象の行「EG-133 11 月分の請求書を送る」。番号も題名も無ければ出さない */
export const targetLine = (number?: string | null, title?: string | null): string | undefined =>
  [number, title].filter(Boolean).join(" ") || undefined;

/** 見ている人の member_id（外枠と同じ鍵 ["me"] の問い合わせ・口は増えない・読めるまで null） */
function useMeId(): string | null {
  const signedIn = typeof window !== "undefined" && Boolean(getToken());
  const who = useQuery({
    queryKey: ["me"],
    queryFn: me,
    enabled: signedIn,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return who.isSuccess ? who.data.member_id : null;
}
/** 担当者の member_id（getTicket の assignee.id。無ければ null） */
const assigneeIdOf = (assignee: unknown): string | null =>
  assignee !== null && typeof assignee === "object" && typeof (assignee as { id?: unknown }).id === "string"
    ? (assignee as { id: string }).id
    : null;
export function ApproveBand<T extends BandTicket>({ ticketId, ticket, run, runKnown, onTicket, onChanged }: Props<T>) {
  usePolledTicket(ticketId, isActive(run), onTicket);
  const meId = useMeId();
  const assigneeId = assigneeIdOf(ticket.assignee);
  const isAssignee = meId !== null && assigneeId !== null && meId === assigneeId;
  const [notice, setNotice] = useState<string | null>(null);
  const c = useComplete({ ticketId, doc: docOf(ticket), onChanged });
  /** 口が断った（409・404 など）：知らせを出して読み直す。401 は入り直し（共通の扱い・戻る先にこのチケット） */
  const failed = async (r: CallErr) => {
    if (r.status === 401) return;
    setNotice(messageOf(r));
    await onChanged();
  };

  const approval = ticket.approval ?? null;
  // 帯の上の知らせ・帯の下の 1 行（段 6・trail.ts）：在る間は帯を null にしない
  const moreNotice = useNotice(ticketId);
  const trail = useTrail(ticketId);
  const execute = run?.phase === "execute" ? run : null;
  const complete = canCompleteNow(ticket, run, runKnown);
  const target = targetLine(ticket.ticket?.number, ticket.ticket?.title);
  // 「完了にする」を出さない形に替わったら（実行が走り出した・承認待ちになった・段が変わった）、開いていた小窓も閉じる
  const { back } = c;
  useEffect(() => {
    if (!complete) back();
  }, [complete, back]);
  /** 実行待ち（queued）の箱を差し込み口で包む（K-735 が取り下げを足す） */
  const queued = (r: RunView, box: ReactNode) => (
    <ExecuteQueuedSlot run={r} ticketId={ticketId} {...(target ? { target } : {})} box={box} onChanged={onChanged} />
  );
  /** 帯の中身と、AI が動いている・承認待ちか（data-busy を付けるか・K-620） */
  const { body, busy } = (() => {
    const busyBody = (node: ReactNode) => ({ body: node, busy: true });
    const idleBody = (node: ReactNode = null) => ({ body: node, busy: false });
    if (ticket.stage?.key === "done")
      return idleBody(ticket.completed ? <Band tone="ok" title={completedLine(ticket.completed)} /> : null); // ⑦
    if (approval?.can_decide)
      return busyBody(
        <DecideBody
          approval={approval}
          onChanged={onChanged}
          onFailed={failed}
          onStart={() => setNotice(null)}
          {...(target ? { target } : {})}
          noSpecReason={ticket.no_spec_reason ?? null}
          ticketId={ticketId}
        />,
      );
    if (approval && ticket.assignee === null) return busyBody(<Band tone="approval" title={MSG.noAssignee} />); // 箱は 1 つ（K-62 の帯は出さない）
    if (approval) return idleBody(); // 決められない人：K-62 の帯だけ（D-128.178）
    const view = execute ? executeView(execute) : null; // 作る段の間・まだ任せていない：K-62 の帯だけ
    if (view?.kind === "stopped")
      return idleBody(
        <Band tone="danger" role="alert" title={MSG.stoppedTitle}>
          <BandLine>{view.reason}</BandLine>
        </Band>,
      );
    if (view?.kind === "sweepFailed" && execute)
      return busyBody(
        <SweepFailedBand
          runId={execute.id}
          canStop={isAssignee}
          onChanged={async () => {
            setNotice(null);
            await onChanged();
          }}
          onFailed={failed}
        />,
      );
    if (execute && view?.kind === "running") {
      const box = (
        <Band
          tone="info"
          title={view.title}
          acts={<StopRunActSlot run={execute} where="execute" onChanged={onChanged} />}
        />
      );
      return busyBody(view.queued ? queued(execute, box) : box);
    }
    if (execute && view?.kind === "wait")
      return busyBody(
        queued(
          execute,
          <Band
            tone="wait"
            title={MSG.waitTitle}
            acts={
              <a className="k-link" href={SETUP_BRIDGE}>
                PC をつなぐ
              </a>
            }
          >
            <BandLine>{MSG.pcClosed}</BandLine>
          </Band>,
        ),
      );
    if (!complete) return idleBody();
    return idleBody(<Band tone="plain" title={MSG.completeHint} />);
  })();

  const dialogOpen = c.state.dialog && complete;
  // 必ず守るから入った確認項目にチェックの無い行：止める小窓（spec-guard-shape の行・K-703）
  const blocked = complete ? c.state.blocked : null;
  const shownNotice = notice ?? c.state.notice;
  /** 知らせと帯の下の 1 行は、承認待ちの箱（DecideBody）を出している間だけこの帯が描く（ほかは K-62 の帯・2 回描かない） */
  const ownsTrail = !!approval?.can_decide && ticket.stage?.key !== "done";
  const hasMore = ownsTrail && (moreNotice !== null || trail.length > 0);
  if (!body && !shownNotice && !dialogOpen && !hasMore && !blocked) return null;
  return (
    <section aria-label={BAND_LABEL} className="k62-band k-section" data-busy={busy ? "" : undefined}>
      {shownNotice ? <NoticeBox>{shownNotice}</NoticeBox> : null}
      {ownsTrail ? <TicketNotice ticketId={ticketId} /> : null}
      {body}
      {dialogOpen ? (
        <CompleteDialog
          {...(target ? { target } : {})}
          tasks={c.state.tasks}
          specs={c.state.specs}
          problems={c.state.problems}
          busy={c.state.phase === "sending"}
          onBack={back}
          onGo={() => void c.go()}
        />
      ) : null}
      {blocked ? (
        <CompleteBlockedDialog {...(target ? { target } : {})} left={blocked} onClose={back} onBack={back} />
      ) : null}
    </section>
  );
}
