"use client";
// 帯の下絵（段 6 core）：任せる帯・承認の帯・実行待ちの帯・止めた後の帯・試し打ちの帯・完了の後の帯。値は props で受け取り描くだけ。
//   押せる物は主に 4 つ（止める・承認を取り下げる・自分で直す・試し打ち）。ほかは今の本線と同じ（まだ使えない物は押せない形）。
//   文は画面に出る字。キャンバスに無い状態の文は「仮」（報告に載せた）。
import type { ReactNode } from "react";
import { Band, BandCaution, BandLine, Button, NoticeBox } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { RunSteps } from "@/features/F5/delegate/run-steps";
import "./more.css";

/** 帯のすぐ下に残る 1 行 */
export function TrailLine({ time, children }: { time: string; children: ReactNode }) {
  return (
    <p className="k-more-trail">
      <time>{time}</time>
      <span>{children}</span>
    </p>
  );
}

/** 作っています（任せる帯）：［止める］が押せる */
export function RunningBand({ busy = false }: { busy?: boolean }) {
  return (
    <Band
      tone="info"
      title="高本のAI が作っています"
      sub="開始 10:31 ・ 3 分"
      acts={
        <>
          <InertButton>AI と話す</InertButton>
          <Button variant="outlined" loading={busy} disabled={busy}>
            止める
          </Button>
        </>
      }
    >
      <RunSteps />
    </Band>
  );
}

/** 承認の後の実行が走っている */
export function ExecutingBand({ busy = false }: { busy?: boolean }) {
  return (
    <Band
      tone="info"
      title="実行中"
      sub="承認 11/01 10:20 ・ 実行 10:21 から"
      acts={
        <Button variant="outlined" loading={busy} disabled={busy}>
          止める
        </Button>
      }
    />
  );
}

/** 承認の後・PC がまだ受け取っていない：受け取るまでは承認を取り下げられる */
export function QueuedBand({ busy = false }: { busy?: boolean }) {
  return (
    <Band
      tone="wait"
      title="実行待ち ・ PC が受け取るのを待っています"
      sub="承認 11/01 10:20 ・ PC が受け取るまでは承認を取り下げられます"
      acts={
        <Button variant="outlined" loading={busy} disabled={busy}>
          承認を取り下げる
        </Button>
      }
    />
  );
}

interface ApprovalProps {
  summary: string;
  /** 押した後の待ち（承認を取り下げた直後など） */
  busy?: boolean;
}

/** 承認待ち・決められる人の帯：［自分で直す］［止める］が押せる */
export function ApprovalBand({ summary, busy = false }: ApprovalProps) {
  return (
    <Band
      tone="approval"
      title="あなたの承認を待っています"
      sub={summary}
      acts={
        <>
          <Button disabled={busy}>承認して送る</Button>
          <Button variant="outlined" disabled={busy}>
            自分で直す
          </Button>
          <Button variant="outlined" disabled={busy}>
            差し戻す
          </Button>
          <Button variant="outlined" disabled={busy}>
            止める
          </Button>
        </>
      }
    >
      <BandCaution>取り消せません</BandCaution>
    </Band>
  );
}

/** 止めた・差し戻した後の帯（作業中に戻っている）：もう一度 AI に任せられる */
export function StoppedBand({ title, sub, line }: { title: string; sub: string; line?: string }) {
  return (
    <Band
      tone="plain"
      title={title}
      sub={sub}
      acts={
        <>
          <InertButton>自分で直す</InertButton>
          <Button>AI に任せる</Button>
        </>
      }
    >
      {line ? <BandLine>{line}</BandLine> : null}
    </Band>
  );
}

/** 口が断った知らせ（帯の箱の外） */
export function Refused({ children }: { children: ReactNode }) {
  return <NoticeBox tone="warn">{children}</NoticeBox>;
}

type DryKind = "running" | "done" | "stopped";
const DRY_ACTS: Record<DryKind, ReactNode> = {
  running: null,
  done: <Button variant="outlined">もう一度試し打ち</Button>,
  stopped: <Button variant="outlined">もう一度試し打ち</Button>,
};

/** 試し打ちの帯（承認の帯の下）：承認待ちはそのまま。宛先は自分に差し替えて 1 回だけ実行する */
export function DryBand({ kind }: { kind: DryKind }) {
  if (kind === "running")
    return (
      <Band tone="info" title="試し打ちを実行しています" sub="宛先をあなたに差し替えています ・ 開始 10:44">
        <BandLine>本来の宛先には送りません。承認待ちはそのままです</BandLine>
      </Band>
    );
  if (kind === "done")
    return (
      <Band
        tone="ok"
        title="試し打ちをあなた宛てに送りました"
        sub="届いた物を確かめてください ・ 10:45"
        acts={DRY_ACTS.done}
      >
        <BandLine>本来の宛先には送っていません。承認待ちはそのままです</BandLine>
      </Band>
    );
  return (
    <Band tone="danger" role="alert" title="試し打ちは止まりました" sub="10:45" acts={DRY_ACTS.stopped}>
      <BandLine>
        宛先を差し替えられない操作（応募フォームなど）があったので、実行せずに止まりました。本来の宛先には何も送っていません
      </BandLine>
    </Band>
  );
}
