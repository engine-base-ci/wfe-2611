"use client";
// AI に任せる（K-62）：チケットの詳細の上の帯（<section aria-label="AI に任せる">）。
//   帯は段で分ける（同じことを言う帯は 1 つ・D-128.178）。帯の箱は components/k の Band（K-227・K-228 がキャンバスの色と形に合わせた）：
//     作る段（phase make）の間 … この帯だけ
//       作っています（running・asking）… 青の箱・題「〈名〉のAI が作っています」・要約「開始 HH:MM ・ N 分」・差し戻しの理由・途中の 1 行・10 分の知らせ・進みの 5 段・
//         AI と話す と 止める は在るが押せない（D-145.9）
//       任せました（queued）… 淡い橙の箱・題「〈名〉のAI に任せました。」・要約は PC が受け取る／起きるのを待っています・AI と話す は押せない
//       止まった（stopped・cancelled）… 赤い箱（role=alert）・題「〈名〉のAI が止まりました」・理由の全文・
//         直し方を AI に伝える と 自分で直す は押せない。箱の下に確認の結果の表
//     任せる前（任せられる・走っている実行なし）… 白い箱・題「AI に任せる」・要約「〈見ている人〉のAI が実施事項を進め、確かめてから承認を待ちます」
//     承認待ち … 承認する人でない人にだけ「成果物ができました。承認待ちです」の橙の箱（承認する人には K-63 の承認の帯）。
//       要約は確認の 12px の字（札にしない）と、確認項目を使わない理由（あれば・K-573）・ボタンなし。担当者がいなければ出さない（K-63 の帯がその文の箱を出す・箱は 1 つ・K-227）
//     承認の後の実行（phase execute）… この帯の状態の文は出さない（K-63 の帯）。can.delegate なら任せる前の箱
//   「AI に任せる」のボタンは題の行（delegate-act.tsx・K-573・X8）。この帯はボタンを持たず、押したときの流れ（use-delegate.ts）の
//   知らせと確認項目 0 件の小窓（no-specs-dialog.tsx）を同じ store から出す
//   帯の section の印 data-busy（K-620）：AI が動いている（作る段の queued・running・asking）か承認待ちの間だけ付ける。
//   任せる前の箱・止まった箱（stopped・cancelled）・知らせだけのときは付けない。題名の下の帯の順の器（F4 の detail-slots.ts・
//   属性の名前は両方の注に書く）がこの印の付いた帯だけを「承認・実行の帯」と数え、渡し・保留の帯に譲らせる。帯の section は状態が替わっても同じ要素のまま
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Band, BandLine } from "@/components/k";
import { errorText } from "@/components/k/error-of";
import { me } from "@/lib/auth/ext";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import * as F7 from "@/features/F7/detail-slots";
import { CheckTable } from "@/features/F5/approve-complete/check-table";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import { NoSpecsDialog, NoticeLine } from "./no-specs-dialog";
import { RunSteps } from "./run-steps";
import { openSpecAdd } from "./spec-add-event";
import { delegateFlow, useDelegateState } from "./use-delegate";
import { isActive, type RunView } from "./use-run";

export interface BandTicket {
  id: string;
  stageKey: string | null;
  canDelegate: boolean;
  /** 見ている人が承認する人か（K-63 が getTicket に足す approval.can_decide） */
  canDecide: boolean;
  /** 承認待ちの承認の id（確認の要約を読む）。承認待ちでなければ null */
  approvalId: string | null;
  /** 担当者がいるか（いない承認待ちは K-63 の帯だけ） */
  hasAssignee: boolean;
  /** K-63 の帯が今「完了にする」（主ボタン）を出しているか（主ボタンは 1 つ・D31）。outlined の出し分けは題の行のボタンが同じ判定でする（K-573） */
  completeShown: boolean;
  /** getTicket の spec_count（K-560）。ちょうど 0 なら任せる前に小窓。無い・null は前の口の答え */
  specCount?: number | null;
  /** getTicket の no_spec_reason（前に残した理由）。渡されなければ題の行のボタンが載せた値 */
  noSpecReason?: string | null;
  /** 小窓の対象の行（「番号 題名」）。渡されなければ題の行のボタンが載せた値 */
  target?: string;
}
interface Props {
  ticket: BandTicket;
  run: RunView | null;
  /** 任せた・別のタブで走っていた実行に替わる */
  onRun: (runId: string) => Promise<void>;
  /** 段が変わっていた（承認待ち・完了）：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
  /** 差し込み口に渡す値（K-599・止まった箱ぜんたいの差し込み口 F7.StoppedHandSlot） */
  slot: SlotTicket;
}
const MSG = {
  waking: "PC が起きるのを待っています",
  receiving: "PC が受け取るのを待っています",
  made: "成果物ができました。承認待ちです",
  before: "AI に任せる",
  beforeSub: "のAI が実施事項を進め、確かめてから承認を待ちます",
} as const;
const JST_MS = 9 * 3600_000;
const MINUTE_MS = 60_000;
/** 見ている人の名前（詳細の画面と同じ鍵で読む・1 回だけ） */
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
const nameOf = (r: RunView) => `${r.by?.display_name ?? "自分"}のAI`;

/** 作っています の要約「開始 HH:MM ・ N 分」（日本時間・経過は分で切り捨て）。始めた時刻が無ければ出さない */
export function startedLine(startedAt: string | null, now = Date.now()): string | null {
  if (!startedAt) return null;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return null;
  const hhmm = new Date(t + JST_MS).toISOString().slice(11, 16);
  return `開始 ${hhmm} ・ ${Math.max(0, Math.floor((now - t) / MINUTE_MS))} 分`;
}

/** 作る段の途中の行（差し戻しの理由・途中の 1 行・10 分の知らせ） */
function MakeLines({ run }: { run: RunView }) {
  const lines: string[] = [];
  if (run.return_reason) lines.push(`差し戻しの理由：${run.return_reason}`);
  if (run.progress) lines.push(run.progress);
  if (run.silent) lines.push(errorText("E-TO-005").entry.message);
  return (
    <>
      {lines.map((t, i) => (
        <BandLine key={i}>{t}</BandLine>
      ))}
    </>
  );
}

/** 作っています の箱。要約の分は今の時刻を状態に持ち、started_at から数えた次の分の境目で持ち直す
 *  （口の答えが前と同じ間は描き直されないので、箱が自分で時計を進める・レビュー Q の指摘 1）。箱が消えたら timer を片付ける */
function MakingBox({ run }: { run: RunView }) {
  const now = useMinuteClock(run.started_at);
  const started = startedLine(run.started_at, now);
  return (
    <Band
      tone="info"
      title={`${nameOf(run)} が作っています`}
      {...(started ? { sub: started } : {})}
      acts={
        <>
          <InertButton>AI と話す</InertButton>
          <InertButton>止める</InertButton>
        </>
      }
    >
      <MakeLines run={run} />
      <RunSteps />
    </Band>
  );
}

/** 今の時刻。startedAt から数えた分の境目ごとに持ち直す（始めた時刻が無ければ持ち直さない） */
function useMinuteClock(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = startedAt ? Date.parse(startedAt) : Number.NaN;
    if (Number.isNaN(t)) return;
    const elapsed = Math.max(0, now - t);
    const wait = MINUTE_MS - (elapsed % MINUTE_MS);
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [startedAt, now]);
  return now;
}

/** 作る段の実行の箱（作っています・任せました・止まった）。「AI に任せる」は題の行（K-573） */
function RunBox({ run }: { run: RunView }) {
  if (run.status === "queued")
    return (
      <Band
        tone="wait"
        title={`${nameOf(run)} に任せました。`}
        sub={run.pc === "asleep" ? MSG.waking : MSG.receiving}
        acts={<InertButton>AI と話す</InertButton>}
      >
        <MakeLines run={run} />
      </Band>
    );
  if (isActive(run)) return <MakingBox run={run} />;
  return (
    <Band
      tone="danger"
      role="alert"
      title={`${nameOf(run)} が止まりました`}
      acts={
        <>
          <InertButton>直し方を AI に伝える</InertButton>
          <InertButton>自分で直す</InertButton>
        </>
      }
    >
      {run.stopped_reason ? <BandLine>{run.stopped_reason}</BandLine> : null}
    </Band>
  );
}

/** 承認待ちの箱の要約：確認の要約（読めたときだけ）と、確認項目を使わない理由（あれば・K-573） */
function madeSub(checkSummary: string | null | undefined, noSpecReason: string | null | undefined): string | null {
  const reason = noSpecReason?.trim() ? `確認項目を使わない理由：${noSpecReason}` : "";
  return [checkSummary ?? "", reason].filter(Boolean).join(" ・ ") || null;
}

export function DelegateBand({ ticket, run, onRun, onChanged, slot }: Props) {
  const qc = useQueryClient();
  const flow = useDelegateState(ticket.id);
  const noSpecReason = ticket.noSpecReason !== undefined ? ticket.noSpecReason : flow.info.noSpecReason;
  const target = ticket.target ?? flow.info.target;

  const active = isActive(run);
  const making = !!run && run.phase !== "execute";
  const awaiting = ticket.stageKey === "awaiting_approval";
  const closed = awaiting || ticket.stageKey === "done";
  const canDelegate = ticket.canDelegate && !active && !closed;
  const ended = run?.status === "stopped" || run?.status === "cancelled";
  // 引き取った止まった実行（taken_over_at・K-485）は止まった箱を出さない（白い「AI に任せる」の箱が出る・K-599）
  const showRun = making && !!run && !closed && !run.taken_over_at && (active || ended);
  const showMade = awaiting && !ticket.canDecide && ticket.hasAssignee;
  const approvalDetail = useApprovalDetail(showMade ? ticket.approvalId : null);
  // 任せる前の要約の名前：読めたらその名前、読めなかったら「自分」。読み終わるまでは要約を出さない
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: canDelegate, ...ONCE });
  const viewer = who.isSuccess ? who.data.display_name || "自分" : who.isError ? "自分" : null;
  // 帯が画面から外れたら（別の頁へ・別のチケットへ）、知らせ・小窓・書きかけの理由を元に戻す（戻ってきたときに前の知らせを言い切らない）
  useEffect(() => delegateFlow.show(ticket.id), [ticket.id]);
  // 任せられない形に替わったら（走り出した・段が変わった）、開いていた小窓も閉じる
  useEffect(() => {
    if (!canDelegate) delegateFlow.close(ticket.id);
  }, [canDelegate, ticket.id]);
  const dialogOpen = flow.dialog && canDelegate;
  const notice = flow.notice;

  /** 実行の一覧と今の実行を読み直してから、詳細を読み直す（止まった箱の差し込み口が書き込みの後に呼ぶ・K-599） */
  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ["k62"] });
    await onChanged();
  };
  if (!canDelegate && !showRun && !showMade && !notice) return null;
  const stopped = showRun && !!run && !active;
  /** AI が動いている・承認待ちの間だけ data-busy（押している間の busy とは別・K-620） */
  const bandBusy = (showRun && active) || showMade;
  const sub = showMade ? madeSub(approvalDetail.data?.check_summary, noSpecReason) : null;
  const deps = { ticketId: ticket.id, specCount: ticket.specCount, qc, onRun, onChanged };
  return (
    <section aria-label="AI に任せる" className="k62-band k-section" data-busy={bandBusy ? "" : undefined}>
      {notice ? <NoticeLine notice={notice} /> : null}
      {showRun && run && stopped ? (
        // 止まった帯の箱と確認の結果の表は 1 つの並び（間 14px・キャンバス StFailed）
        // 止まった箱の差し込み口（段 8 の F7.StoppedHandSlot・K-599）。その中の「AI に任せる」は題の行のボタンと同じ流れ（use-delegate.ts・K-573）
        <F7.StoppedHandSlot
          ticket={slot}
          run={run}
          delegate={{ run: () => void delegateFlow.start(deps), busy: flow.busy, disabled: flow.waitUntil !== null }}
          onChanged={reload}
        >
          <div className="k-check-stack">
            <RunBox run={run} />
            <CheckTable />
          </div>
        </F7.StoppedHandSlot>
      ) : showRun && run ? (
        <RunBox run={run} />
      ) : null}
      {showMade ? (
        // 確認の要約は承認の 1 件の check_summary。読めない間・読めなかったときは出さない（本当とは限らない文を言い切らない）
        <Band tone="approval" title={MSG.made} {...(sub ? { sub } : {})} />
      ) : null}
      {canDelegate && !showRun ? (
        <Band tone="plain" title={MSG.before} {...(viewer ? { sub: `${viewer}${MSG.beforeSub}` } : {})} />
      ) : null}
      {dialogOpen ? (
        <NoSpecsDialog
          target={target}
          reason={flow.reason}
          onReason={(r) => delegateFlow.setReason(ticket.id, r)}
          busy={flow.busy}
          wait={flow.waitUntil !== null}
          error={flow.dialogNotice}
          onQuit={() => delegateFlow.close(ticket.id)}
          onAdd={() => {
            delegateFlow.close(ticket.id);
            openSpecAdd(ticket.id);
          }}
          onGo={() => void delegateFlow.go(deps)}
        />
      ) : null}
    </section>
  );
}
