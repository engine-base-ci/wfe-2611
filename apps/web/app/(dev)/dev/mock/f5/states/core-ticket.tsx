"use client";
// 段 6 core の下絵（チケットの詳細の側）：止める・取り下げる・確認の表・自分で直す・差し戻す・試し打ち・完了の後。
//   どの状態も代表に聞くことの ★（勧め）の形で描く。ticket はその状態を本物にする画面の葉（切り方.md 1 章）。
import type { ReactNode } from "react";
import { Band, BandLine, Button } from "@/components/k";
import { ArtifactCardMore, SelfEditSurface } from "@/features/F5/more/artifact";
import {
  ApprovalBand,
  DryBand,
  ExecutingBand,
  QueuedBand,
  Refused,
  RunningBand,
  StoppedBand,
  TrailLine,
} from "@/features/F5/more/bands";
import { ActivityLog, ChecksTable, checksSummary, type CheckRow } from "@/features/F5/more/checks";
import {
  ApproveConfirmMore,
  DryConfirm,
  ReturnMoreDialog,
  StopApprovalConfirm,
  StopRunConfirm,
  WithdrawConfirm,
} from "@/features/F5/more/dialogs";
import type { Theme } from "@/lib/theme";
import { ME, TicketPage } from "./core-page";

const ROWS: readonly CheckRow[] = [
  {
    text: "金額が見積の月額と一致している",
    who: "ai",
    at: "11/01 09:12",
    basis: "PDF の合計 1,716,000 円 ＝ 見積 EG-097 の月額と追加対応の合計",
  },
  {
    text: "インボイスの必須記載事項を満たしている",
    who: "ai",
    at: "11/01 09:12",
    basis: "登録番号・税率ごとの金額と税額が PDF にある",
  },
  { text: "宛名と CC が取引先のルールどおり", who: "ai", at: "11/01 09:12", basis: "宛先は経理部 山田様・CC は鈴木様" },
  { text: "送る前に PDF を目で見る", who: { human: ME }, at: "11/01 10:18" },
  { text: "山田様へのメールの文面を確かめる", who: null },
];
const ROWS_PENDING: readonly CheckRow[] = [
  ...ROWS.slice(0, 3),
  { text: "送る前に PDF を目で見る", who: null },
  ROWS[4]!,
];
const ROWS_FAILED: readonly CheckRow[] = [
  { text: "金額が見積の月額と一致している", who: null },
  {
    text: "インボイスの必須記載事項を満たしている",
    who: "ai",
    at: "11/01 09:10",
    basis: "登録番号・税率ごとの金額と税額が PDF にある",
  },
  { text: "送る前に PDF を目で見る", who: null },
];

const summary = (rows: readonly CheckRow[]) => `成果物は 11/01 09:12 に作成 ・ 確認 ${checksSummary(rows)}`;
const REASON = "10/19 の追加対応は無償なので外してください";

type ApprovalOpts = { extra?: ReactNode; card?: ReactNode; rows?: readonly CheckRow[]; edited?: string; log?: boolean };
type Parts = { band: ReactNode; below: ReactNode };

/** 承認待ちの帯の並び：帯・成果物のカード・確認の表 */
function approval({ extra, card, rows = ROWS, edited, log = false }: ApprovalOpts = {}): Parts {
  return {
    band: (
      <>
        <ApprovalBand summary={summary(rows)} />
        {extra}
      </>
    ),
    below: (
      <>
        {card ?? <ArtifactCardMore version={1} />}
        <ChecksTable rows={rows} {...(edited ? { edited } : {})} />
        {log ? <ActivityLog rows={rows} /> : null}
      </>
    ),
  };
}

export function ticketView(id: string, theme: Theme): ReactNode | null {
  const page = (
    stage: "doing" | "awaiting_approval" | "done",
    band: ReactNode,
    below?: ReactNode,
    dialog?: ReactNode,
  ) => <TicketPage theme={theme} ps="PS2" stage={stage} band={band} below={below} dialog={dialog} />;
  const aw = (o: ApprovalOpts = {}, dialog?: ReactNode) => {
    const p = approval(o);
    return page("awaiting_approval", p.band, p.below, dialog);
  };
  const stopped = (title: string, sub: string, line?: string) => (
    <StoppedBand title={title} sub={sub} {...(line ? { line } : {})} />
  );
  switch (id) {
    case "stop-running-band":
      return page("doing", <RunningBand />);
    case "stop-running-confirm":
      return page("doing", <RunningBand />, undefined, <StopRunConfirm />);
    case "stop-running-busy":
      return page("doing", <RunningBand busy />, undefined, <StopRunConfirm busy />);
    case "stop-approval-band":
      return aw();
    case "stop-approval-confirm":
      return aw({}, <StopApprovalConfirm />);
    case "stop-stopped-band":
      return page(
        "doing",
        stopped("高本のAI を止めました", "高本が 11/01 10:40 に止めました。止める前にできていた物は残っています"),
      );
    case "stop-approval-stopped":
      return page(
        "doing",
        stopped("承認待ちの成果物を止めました", "この成果物は送っていません。チケットは作業中に戻りました"),
        <TrailLine time="11/01 10:42">高本が承認待ちを止めました（成果物の版 1 は残っています）</TrailLine>,
      );
    case "stop-ignored-result":
      return page(
        "doing",
        stopped("高本のAI を止めました", "高本が 11/01 10:40 に止めました。止める前にできていた物は残っています"),
        <TrailLine time="11/01 10:52">止めたので、届いた結果は使いませんでした</TrailLine>,
      );
    case "stop-conflict":
      return page(
        "doing",
        <>
          <Refused>この AI はもう止まっていました。表示を読み直しました</Refused>
          <RunningBand />
        </>,
      );
    case "stop-denied":
      return page(
        "doing",
        <>
          <Refused>この AI を止められるのは担当者です</Refused>
          <RunningBand />
        </>,
      );
    case "stop-approval-denied":
      return aw({ extra: <Refused>承認待ちを止められるのは、承認する人だけです</Refused> });
    case "withdraw-band":
      return page("doing", <QueuedBand />);
    case "withdraw-confirm":
      return page("doing", <QueuedBand />, undefined, <WithdrawConfirm />);
    case "withdraw-done":
      return aw({
        extra: <TrailLine time="11/01 10:24">高本が承認を取り下げました（承認待ちに戻りました）</TrailLine>,
      });
    case "withdraw-late":
      return page(
        "doing",
        <>
          <Refused>もう実行が始まっています。止めるには［止める］を押してください</Refused>
          <ExecutingBand />
        </>,
      );
    case "checks-table":
      return aw({ log: true });
    case "checks-failed":
      return page(
        "doing",
        <Band
          tone="danger"
          role="alert"
          title="高本のAI が止まりました"
          sub={`確認 ${checksSummary(ROWS_FAILED)}`}
          acts={<Button>AI に任せる</Button>}
        >
          <BandLine>金額が見積 EG-097 の月額と合いませんでした</BandLine>
        </Band>,
        <>
          <ChecksTable rows={ROWS_FAILED} />
          <ActivityLog rows={ROWS_FAILED} />
        </>,
      );
    case "checks-approve-modal":
      return aw(
        { rows: ROWS_PENDING },
        <ApproveConfirmMore
          pending={["送る前に PDF を目で見る", "山田様へのメールの文面を確かめる"]}
          picked={[true, false]}
        />,
      );
    case "checks-none":
      return page(
        "awaiting_approval",
        <ApprovalBand summary="成果物は 11/01 09:12 に作成 ・ 確認 検査なし" />,
        <>
          <ArtifactCardMore version={1} />
          <ChecksTable rows={[]} noneReason="社内の確認だけで済む作業なので、確認項目は使わないと決めました" />
        </>,
      );
    case "selfedit-band":
      return aw();
    case "selfedit-editing":
      return aw({ card: <SelfEditSurface state="editing" /> });
    case "selfedit-saving":
      return aw({ card: <SelfEditSurface state="saving" /> });
    case "selfedit-saved":
      return aw({
        card: <ArtifactCardMore version={3} />,
        edited: "成果物は 高本 が直しました（版 3）",
        extra: <TrailLine time="11/01 10:48">高本が成果物を直しました（版 3）。AI のチェックは残っています</TrailLine>,
      });
    case "selfedit-conflict":
      return aw({
        card: <SelfEditSurface state="conflict" />,
        extra: <Refused>先にほかの人が成果物を直していました（版 2）。開き直して、続きから直してください</Refused>,
      });
    case "return-modal":
      return aw({}, <ReturnMoreDialog who="ai" note={REASON} />);
    case "return-modal-self":
      return aw({}, <ReturnMoreDialog who="self" note={REASON} />);
    case "return-error":
      return aw({}, <ReturnMoreDialog who="ai" note="" error="差し戻す理由を書いてください" />);
    case "return-self-band":
      return page(
        "doing",
        stopped("差し戻しました。次は 高本 が直します", `理由：${REASON}`),
        <TrailLine time="11/01 10:50">高本が差し戻しました（直すのは自分）</TrailLine>,
      );
    case "dry-card":
      return aw();
    case "dry-confirm":
      return aw({}, <DryConfirm />);
    case "dry-running":
      return aw({ extra: <DryBand kind="running" /> });
    case "dry-done":
      return aw({ extra: <DryBand kind="done" /> });
    case "dry-stopped":
      return aw({ extra: <DryBand kind="stopped" /> });
    default:
      return null;
  }
}
