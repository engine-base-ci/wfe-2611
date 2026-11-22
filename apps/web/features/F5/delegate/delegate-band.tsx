"use client";
// AI に任せる（K-62）：チケットの詳細の上の帯（<section aria-label="AI に任せる">）。
//   帯は段で分ける（同じことを言う帯は 1 つ・D-128.178）。帯の箱は components/k の Band（K-227・K-228 がキャンバスの色と形に合わせた）：
//     作る段（phase make）の間 … この帯だけ
//       作っています（running・asking）… 青の箱・題「〈名〉のAI が作っています」・要約「開始 HH:MM ・ N 分」・差し戻しの理由・途中の 1 行・10 分の知らせ・進みの 5 段・
//         AI と話す と 止める は在るが押せない（D-145.9）
//       任せました（queued）… 淡い橙の箱・題「〈名〉のAI に任せました。」・要約は PC が受け取る／起きるのを待っています・AI と話す は押せない
//       止まった（stopped・cancelled）… 赤い箱（role=alert）・題「〈名〉のAI が止まりました」・理由の全文・AI に任せる（任せられるとき）・
//         直し方を AI に伝える と 自分で直す は押せない。箱の下に確認の結果の表
//     任せる前（任せられる・走っている実行なし）… 白い箱・題「AI に任せる」・要約「〈見ている人〉のAI が実施事項を進め、確かめてから承認を待ちます」・AI に任せる
//     承認待ち … 承認する人でない人にだけ「成果物ができました。承認待ちです」の橙の箱（承認する人には K-63 の承認の帯）。
//       要約は確認の 12px の字（札にしない）・ボタンなし。担当者がいなければ出さない（K-63 の帯がその文の箱を出す・箱は 1 つ・K-227）
//     承認の後の実行（phase execute）… この帯の状態の文は出さない（K-63 の帯）。can.delegate なら任せる前の箱
//   主ボタンは 1 つ：K-63 の帯が「完了にする」を出している間は「AI に任せる」を outlined（決める人の答え answer=5cf21973b39f）
//   帯の section の印 data-busy（K-620）：AI が動いている（作る段の queued・running・asking）か承認待ちの間だけ付ける。
//   任せる前の箱・止まった箱（stopped・cancelled）・知らせだけのときは付けない。題名の下の帯の順の器（F4 の detail-slots.ts・
//   属性の名前は両方の注に書く）がこの印の付いた帯だけを「承認・実行の帯」と数え、渡し・保留の帯に譲らせる。帯の section は状態が替わっても同じ要素のまま
//   文は全部文字として出す（HTML を作らない）。エラーの文は正本（errors.json）から引く
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Band, BandLine, Button, NoticeBox } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { CheckTable } from "@/features/F5/approve-complete/check-table";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import { RunSteps } from "./run-steps";
import { fetchRuns, isActive, type RunView } from "./use-run";

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

/** 作る段の実行の箱（作っています・任せました・止まった）。止まったときだけ AI に任せる（delegate）を箱の中に置く */
function RunBox({ run, delegate }: { run: RunView; delegate: ReactNode }) {
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
          {delegate}
          <InertButton>直し方を AI に伝える</InertButton>
          <InertButton>自分で直す</InertButton>
        </>
      }
    >
      {run.stopped_reason ? <BandLine>{run.stopped_reason}</BandLine> : null}
    </Band>
  );
}

export function DelegateBand({ ticket, run, onRun, onChanged }: Props) {
  const qc = useQueryClient();
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
  // 任せる前の要約の名前：読めたらその名前、読めなかったら「自分」。読み終わるまでは要約を出さない
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: showButton, ...ONCE });
  const viewer = who.isSuccess ? who.data.display_name || "自分" : who.isError ? "自分" : null;

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
        const runId = typeof r.body["run_id"] === "string" ? r.body["run_id"] : await runIdOf(qc, ticket.id);
        if (runId) await onRun(runId);
      } else if (code === "E-CONF-014") await onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!showButton && !showRun && !showMade && !notice) return null;
  const stopped = showRun && !!run && !active;
  /** AI が動いている・承認待ちの間だけ data-busy（押している間の busy とは別・K-620） */
  const bandBusy = (showRun && active) || showMade;
  const delegateButton = showButton ? (
    <Button
      variant={ticket.completeShown ? "outlined" : "primary"}
      onClick={() => void delegate()}
      loading={busy}
      disabled={waitUntil !== null}
    >
      AI に任せる
    </Button>
  ) : null;
  return (
    <section aria-label="AI に任せる" className="k62-band k-section" data-busy={bandBusy ? "" : undefined}>
      {notice ? <NoticeLine notice={notice} /> : null}
      {showRun && run && stopped ? (
        // 止まった帯の箱と確認の結果の表は 1 つの並び（間 14px・キャンバス StFailed）
        <div className="k-check-stack">
          <RunBox run={run} delegate={delegateButton} />
          <CheckTable />
        </div>
      ) : showRun && run ? (
        <RunBox run={run} delegate={delegateButton} />
      ) : null}
      {showMade ? (
        // 確認の要約は承認の 1 件の check_summary。読めない間・読めなかったときは出さない（本当とは限らない文を言い切らない）
        <Band
          tone="approval"
          title={MSG.made}
          {...(approvalDetail.data?.check_summary ? { sub: approvalDetail.data.check_summary } : {})}
        />
      ) : null}
      {showButton && !showRun ? (
        <Band
          tone="plain"
          title={MSG.before}
          {...(viewer ? { sub: `${viewer}${MSG.beforeSub}` } : {})}
          acts={delegateButton}
        />
      ) : null}
    </section>
  );
}

/** 別のタブで先に任せていた（409・E-CONF-013）：答えの run_id が無くても、今の実行を一覧から引く。
 *  詳細と同じ実行の一覧の問い合わせを読み直す（器を分け合う・口を別に呼ばない・K-235） */
async function runIdOf(qc: QueryClient, ticketId: string): Promise<string | null> {
  const runs = await fetchRuns(qc, ticketId);
  return runs?.[0]?.id ?? null;
}

function NoticeLine({ notice }: { notice: NonNullable<Notice> }) {
  if (notice.code === "RATE")
    return <NoticeBox tone="warn">押しすぎです。{notice.retryAfterSec} 秒たってから、もう一度押してください</NoticeBox>;
  const code = notice.code;
  let message: string;
  try {
    message = errorText(code).entry.message;
  } catch {
    message = errorText(PAGE_ERROR.loadFailed).entry.message;
  }
  return (
    <NoticeBox tone={code === "E-CONF-013" || code === "E-CONF-014" ? "warn" : "danger"}>
      {message}
      {notice.link ? (
        <>
          {" "}
          <a className="k-link" href={SETUP_BRIDGE}>
            PC をつなぐ
          </a>
        </>
      ) : null}
    </NoticeBox>
  );
}
