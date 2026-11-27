"use client";
// 承認待ちを止める（K-734）：承認の帯の［止める］。押すと確かめの小窓「承認待ちの成果物を使わずに止めます」、小窓の「止める」で口 stopApproval（K-732）を 1 回。
//   201：小窓を閉じ、作業中に戻した後の箱「承認待ちの成果物を止めました」と帯の下の 1 行を積み、やり取りを読み直し、チケットを読み直す（onChanged）。
//   403 は画面の字「承認待ちを止められるのは、承認する人だけです」（口は汎用の 403）・409 E-CONF-003 は正本の文と読み直し・ほかは正本の文。
//   画面は役の名前で出し分けない。文は全部文字として出す
import "@/features/F5/more/more.css";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Confirm } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import { messageOf } from "@/features/F5/approve-complete/message";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import { clearNotice, pushBand, pushNotice, pushTrail } from "@/features/F5/more/trail";
import type { StopApprovalActProps } from "@/features/F5/more/slots";

const SCREEN = "tickets";
/** 口の文と違う、画面の字（下絵 stop-approval-confirm・stop-approval-stopped・stop-approval-denied） */
export const STOP_APPROVAL_MSG = {
  title: "承認待ちの成果物を使わずに止めます",
  confirm: "止める",
  stopped: "承認待ちの成果物を止めました",
  stoppedSub: "この成果物は送っていません。チケットは作業中に戻りました",
  denied: "承認待ちを止められるのは、承認する人だけです",
} as const;
const ONCE = { retry: false, staleTime: Infinity } as const;

/** 小窓の本文（対象の行が無ければ頭を付けない） */
export function stopApprovalBody(target?: string): string {
  const head = target ? `${target}。` : "";
  return `${head}この成果物は送りません。チケットは作業中に戻ります（止められるのは承認する人だけです）`;
}

/** 帯の下の 1 行「〈名〉が承認待ちを止めました（成果物の版 N は残っています）」（版が分からなければ版を書かない） */
export function stoppedTrail(who: string, version: number | null | undefined): string {
  return version == null
    ? `${who}が承認待ちを止めました`
    : `${who}が承認待ちを止めました（成果物の版 ${version} は残っています）`;
}

const refusedText = (r: CallErr): string => (r.status === 403 ? STOP_APPROVAL_MSG.denied : messageOf(r));

function useStopApproval({ approval, ticketId, onChanged, onFailed }: StopApprovalActProps) {
  const qc = useQueryClient();
  const detail = useApprovalDetail(approval.id); // 承認の帯と同じ器（口は増えない）
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const myName = async (): Promise<string> => {
    const who = await qc.fetchQuery({ queryKey: ["me"], queryFn: me, ...ONCE }).catch(() => null);
    return who?.display_name || "自分";
  };
  const done = async (id: string) => {
    const who = await myName();
    pushBand(id, { title: STOP_APPROVAL_MSG.stopped, sub: STOP_APPROVAL_MSG.stoppedSub });
    pushTrail(id, stoppedTrail(who, detail.data?.artifact_version?.version));
    await qc.invalidateQueries({ queryKey: timelineKey(id) });
  };
  const refused = async (r: CallErr) => {
    if (!ticketId) return onFailed(r); // 知らせの置き場が無い：呼んだ側に任せる
    pushNotice(ticketId, refusedText(r));
    if (r.status === 409) await onChanged();
  };
  const stop = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("stopApproval", { params: { id: approval.id }, body: {}, screenId: SCREEN });
      setBusy(false);
      setOpen(false);
      if (!r.ok) return await refused(r);
      if (ticketId) {
        clearNotice(ticketId);
        await done(ticketId);
      }
      await onChanged();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { open, setOpen, busy, stop };
}

export function StopApprovalAct(props: StopApprovalActProps) {
  const { open, setOpen, busy, stop } = useStopApproval(props);
  return (
    <>
      <Button
        variant="outlined"
        {...(props.className ? { className: props.className } : {})}
        onClick={() => setOpen(true)}
      >
        {STOP_APPROVAL_MSG.confirm}
      </Button>
      <Confirm
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        onConfirm={() => void stop()}
        busy={busy}
        title={STOP_APPROVAL_MSG.title}
        confirmLabel={STOP_APPROVAL_MSG.confirm}
        description={stopApprovalBody(props.target)}
      >
        <i className="k-more-sheetmark" hidden aria-hidden="true" />
      </Confirm>
    </>
  );
}
