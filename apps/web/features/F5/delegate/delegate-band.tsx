"use client";
// AI に任せる（K-62）：チケットの詳細の上の帯（<section aria-label="AI に任せる">）。
//   帯は段で分ける（同じことを言う帯は 1 つ・D-128.178）：
//     作る段（phase make）の間 … この帯だけ（作っています・PC が起きるのを待っています・止まった理由・10 分の知らせ・差し戻しの理由）
//     承認待ち … 承認する人でない人にだけ「成果物ができました。承認待ちです」の橙の箱（承認する人には K-63 の承認の帯）。
//       要約は確認の 12px の字（札にしない）・ボタンなし。担当者がいなければ出さない（K-63 の帯がその文の箱を出す・箱は 1 つ・K-227）
//     承認の後の実行（phase execute）… この帯の状態の文は出さない（K-63 の帯）。can.delegate なら「AI に任せる」のボタンだけ
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く
import { useEffect, useRef, useState } from "react";
import { Band, Button, Callout } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
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
  /** K-63 の帯が今「完了にする」（主ボタン）を出しているか。出している間は「AI に任せる」を outlined にする（主ボタンは 1 つ・D31） */
  completeShown: boolean;
}
interface Props {
  ticket: BandTicket;
  run: RunView | null;
  /** 任せた・別のタブで走っていた実行に替わる */
  onRun: (runId: string) => Promise<void>;
  /** 段が変わっていた（承認待ち・完了）：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
}
type Notice = { code: string; retryAfterSec?: number | null; link?: boolean } | null;

const SETUP_BRIDGE = "/setup/bridge";
const MSG = {
  waking: "PC が起きるのを待っています",
  made: "成果物ができました。承認待ちです",
  noChecks: "検査なし（まだ流していません）",
} as const;
const nameOf = (r: RunView) => `${r.by?.display_name ?? "自分"}のAI`;

/** 作る段の実行の様子の文（帯の中だけ） */
function RunLines({ run }: { run: RunView }) {
  const lines: string[] = [];
  if (isActive(run)) {
    if (run.status === "queued")
      lines.push(`${nameOf(run)} に任せました。${run.pc === "asleep" ? MSG.waking : "PC が受け取るのを待っています"}`);
    else lines.push(`${nameOf(run)} が作っています`);
    if (run.return_reason) lines.push(`差し戻しの理由：${run.return_reason}`);
    if (run.progress) lines.push(run.progress);
    if (run.silent) lines.push(errorText("E-TO-005").entry.message);
  } else if (run.status === "stopped" || run.status === "cancelled") {
    lines.push(`${nameOf(run)} が止まりました`);
    if (run.stopped_reason) lines.push(run.stopped_reason);
  }
  return (
    <>
      {lines.map((t, i) => (
        <p key={i} className="k62-band-line" data-run-line>
          {t}
        </p>
      ))}
    </>
  );
}

export function DelegateBand({ ticket, run, onRun, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const active = isActive(run);
  const making = !!run && run.phase !== "execute";
  const awaiting = ticket.stageKey === "awaiting_approval";
  const closed = awaiting || ticket.stageKey === "done";
  const showButton = ticket.canDelegate && !active && !closed;
  const showRun = making && !!run && !closed && (active || run.status === "stopped" || run.status === "cancelled");
  const showMade = awaiting && !ticket.canDecide && ticket.hasAssignee;
  const approvalDetail = useApprovalDetail(showMade ? ticket.approvalId : null);

  const delegate = async () => {
    if (busy || waitUntil) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call("delegateTicket", { params: { id: ticket.id }, body: {}, screenId: "tickets" });
      if (r.ok) {
        await onRun(String((r.data as { run_id?: string }).run_id ?? ""));
        return;
      }
      if (r.status === 401) return; // 入り直しへ（共通の扱い・戻る先にこのチケット）
      if (r.status === 429) {
        const sec = r.retryAfterSec ?? 60;
        setNotice({ code: "RATE", retryAfterSec: sec });
        setWaitUntil(Date.now() + sec * 1000);
        timer.current = setTimeout(() => {
          setWaitUntil(null);
          setNotice(null);
        }, sec * 1000);
        return;
      }
      const code = errorCodeOf(r);
      setNotice({ code, link: code === "E-CONN-001" });
      if (code === "E-CONF-013") {
        const runId = typeof r.body["run_id"] === "string" ? r.body["run_id"] : await runIdOf(ticket.id);
        if (runId) await onRun(runId);
      } else if (code === "E-CONF-014") await onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!showButton && !showRun && !showMade && !notice) return null;
  return (
    <section aria-label="AI に任せる" className="k62-band k-section">
      {notice ? <NoticeLine notice={notice} /> : null}
      {showRun && run ? <RunLines run={run} /> : null}
      {showMade ? (
        // 確認の要約は承認の 1 件の check_summary。読めない間・読めなかったときは前からの文（K-62 の帯の文）
        <Band tone="approval" title={MSG.made} sub={approvalDetail.data?.check_summary || MSG.noChecks} />
      ) : null}
      {showButton ? (
        <div>
          <Button
            variant={ticket.completeShown ? "outlined" : "primary"}
            onClick={() => void delegate()}
            loading={busy}
            disabled={waitUntil !== null}
          >
            AI に任せる
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** 別のタブで先に任せていた（409・E-CONF-013）：答えの run_id が無くても、今の実行を一覧から引く */
async function runIdOf(ticketId: string): Promise<string | null> {
  const r = await call("listTicketRuns", { params: { id: ticketId }, screenId: "tickets" });
  if (!r.ok) return null;
  const first = (r.data as unknown as RunView[])[0];
  return first?.id ?? null;
}

function NoticeLine({ notice }: { notice: NonNullable<Notice> }) {
  if (notice.code === "RATE")
    return <Callout tone="warn">押しすぎです。{notice.retryAfterSec} 秒たってから、もう一度押してください</Callout>;
  const code = notice.code;
  let message: string;
  try {
    message = errorText(code).entry.message;
  } catch {
    message = errorText(PAGE_ERROR.loadFailed).entry.message;
  }
  return (
    <Callout tone={code === "E-CONF-013" || code === "E-CONF-014" ? "info" : "danger"}>
      {message}
      {notice.link ? (
        <>
          {" "}
          <a className="k-link" href={SETUP_BRIDGE}>
            PC をつなぐ
          </a>
        </>
      ) : null}
    </Callout>
  );
}
