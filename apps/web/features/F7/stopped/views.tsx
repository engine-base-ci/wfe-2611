"use client";
// 止まった理由と一手（F7・段 8・A57・切る段の下絵・部品先行）。口とはまだつながず、値を受け取って描くだけ。
//   置き場：チケットの詳細の題名の下の「止まった帯」（前からの features/F5/delegate/delegate-band.tsx・キャンバス StFailed・D-129.47）の側。
//   「もう一度」は前からの帯の「AI に任せる」をそのまま使う（作らない）。新しく作るのは「自分で直す」だけ（TakeoverConfirm・D-151.17）。
//   直し方の行き先は F3 の PC をつなぐ画面（/setup/bridge）へのリンク。理由が届かないときは「理由は届いていません」（P7）。
//   形は正本の部品（Band・Button・Confirm・NoticeBox）だけで組む。値は stopped.css（正本のトークンだけ）
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Band, BandLine, Button, Confirm, NoticeBox } from "@/components/k";
import { SETUP_BRIDGE, stopCopy, type BrokenCause, type StopKind } from "./stop-copy";
import "./stopped.css";

export { stopCopy, SETUP_BRIDGE, type BrokenCause, type StopKind } from "./stop-copy";

const noop = () => undefined;

/** PC をつなぐ画面へ行く（帯のボタンの形のリンク） */
function SetupLink({ label, primary }: { label: string; primary: boolean }) {
  return (
    <Link href={SETUP_BRIDGE as Route} className="k-btn" data-variant={primary ? "primary" : "outlined"}>
      {label}
    </Link>
  );
}

export interface StopHandProps {
  kind: StopKind;
  /** 押せる人（担当者）か。false なら全部押せない形（title に訳）。下の 2 つの旗があればそちらを使う */
  canAct: boolean;
  /** 「AI に任せる」を押せるか（getTicket の can.delegate・K-486）。無ければ canAct */
  canDelegate?: boolean | undefined;
  /** 「自分で直す」を押せるか（担当者本人・K-486）。無ければ canAct */
  canTakeover?: boolean | undefined;
  /** 「AI に任せる」の答えを待っている間（前からの帯の busy） */
  delegateBusy?: boolean | undefined;
  /** 「AI に任せる」の押しすぎの待ち（前からの帯の disabled） */
  delegateDisabled?: boolean | undefined;
  /** 担当者の名前（押せない訳に出す） */
  assignee?: string | undefined;
  /** 「AI に任せる」（前からの帯の口・もう一度） */
  onDelegate?: (() => void) | undefined;
  /** 「自分で直す」 */
  onTakeover?: (() => void) | undefined;
}

/** 押せない形（aria-disabled・Tab で止まらない・指を置くと訳） */
const offOf = (on: boolean, assignee: string | undefined) =>
  on
    ? {}
    : ({ "aria-disabled": true, tabIndex: -1, title: `押せるのは担当者の${assignee ?? ""}さんだけです` } as const);

/** 一手のボタン列（帯の右）。止まった帯のボタンは［自分で直す］だけ（決める人 answer=d25f2e58bffb・［直し方を AI に伝える］も置かない answer=4d049789b537）。
 *  もう一度任せるのは題の行の「AI に任せる」（K-573）。理由が PC・AI の壊れなら、直す場所の「PC をつなぐ」（リンク）を前に置く。
 *  canDelegate・delegateBusy・delegateDisabled・onDelegate は受けるが使わない（差し込み口の形は残す） */
export function StopHand({ kind, canAct, canTakeover = canAct, assignee, onTakeover }: StopHandProps) {
  const takeover = (
    <Button variant="outlined" {...offOf(canTakeover, assignee)} {...(canTakeover ? { onClick: onTakeover } : {})}>
      自分で直す
    </Button>
  );
  if (kind === "broken")
    return (
      <>
        <SetupLink label="PC をつなぐ" primary />
        {takeover}
      </>
    );
  return takeover;
}

export interface StopReasonProps {
  /** 「高本のAI」 */
  who: string;
  kind: StopKind;
  cause?: BrokenCause | undefined;
  /** 確認で落ちた理由の全文（口が返した字のまま） */
  detail?: string | undefined;
  /** 一手のボタン列（StopHand）。無ければ帯に一手を出さない */
  hand?: ReactNode;
  /** 押した結果の失敗（口が断った・もう直っていた）。帯の上の赤い箱 */
  notice?: string | undefined;
  /** 帯の下（確認の結果の表など） */
  children?: ReactNode;
}

/** 止まった理由の帯（詳細の題名の下）。理由の文は stop-copy.ts。止まった（失敗）なので role=alert */
export function StopReason({ who, kind, cause, detail, hand, notice, children }: StopReasonProps) {
  const c = stopCopy({ who, kind, cause, detail });
  return (
    <section aria-label="止まった理由" className="k-f7-stop">
      {notice ? <NoticeBox>{notice}</NoticeBox> : null}
      <Band tone={c.tone} role="alert" title={c.title} sub={c.sub} acts={hand}>
        {c.lines.map((t) => (
          <BandLine key={t}>{t}</BandLine>
        ))}
      </Band>
      {children}
    </section>
  );
}

/** 「AI に任せる」を押した後の帯（前からの帯の「任せました」と同じ字）。PC が眠っていれば起きるのを待つ。
 *  ［AI と話す］は任せました の間は押せる形（段6 K-764・D-153.16。下絵では押しても何もしない） */
export function RetryConfirm({ who, waking = false }: { who: string; waking?: boolean }) {
  return (
    <section aria-label="AI に任せる" className="k-f7-stop">
      <Band
        tone="wait"
        title={`${who} に任せました。`}
        sub={waking ? "PC が起きるのを待っています" : "PC が受け取るのを待っています"}
        acts={<Button variant="outlined">AI と話す</Button>}
      />
    </section>
  );
}

export interface TakeoverConfirmProps {
  open: boolean;
  /** 「高本のAI」 */
  who: string;
  /** 担当者の名前（やり取りに残る 1 行「〈名〉が自分で進めることにしました」の名前・K-485 が書く 1 行と同じ字） */
  assigneeName: string;
  /** 口が断った（もう直っていた・担当者でなくなった）の赤い箱 */
  notice?: string | undefined;
  busy?: boolean;
  onOpenChange?: ((open: boolean) => void) | undefined;
  onConfirm?: (() => void) | undefined;
}

/** 自分で直す：AI の仕事を外し、担当者が自分で進める。段は作業中のまま・やり取りに 1 行残る（D-151.17。字は案） */
export function TakeoverConfirm({
  open,
  who,
  assigneeName,
  notice,
  busy = false,
  onOpenChange,
  onConfirm,
}: TakeoverConfirmProps) {
  return (
    <Confirm
      title="自分で直しますか？"
      description={`${who} の仕事を外して、担当者のあなたが自分で進めます。チケットの段は「作業中」のままです。やり取りに「${assigneeName}が自分で進めることにしました」と 1 行残ります。`}
      confirmLabel="自分で直す"
      tone="primary"
      open={open}
      busy={busy}
      onOpenChange={onOpenChange ?? noop}
      onConfirm={onConfirm ?? noop}
    >
      {notice ? <NoticeBox>{notice}</NoticeBox> : null}
    </Confirm>
  );
}
