"use client";
// 動いている実行を止める（K-734）：任せる帯の作っている箱（where=make）と承認と実行の帯の実行中の箱（where=execute）の［止める］。
//   押すと確かめの小窓（components/k の Confirm・役 alertdialog・× は無い・閉じ方は「やめる」と Esc）。小窓の「止める」で口 stopActionRun（K-731）を 1 回。
//   201：小窓を閉じ、実行の一覧・今の実行・やり取りを読み直す。409 E-RUN-002 は画面の字の知らせと読み直し。ほかの断りは正本の文の知らせ（帯は動いたまま）。
//   画面は役の名前で出し分けない（止められない人が押したら口の 403 を知らせに出す）。文は全部文字として出す
import "@/features/F5/more/more.css";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Confirm } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { messageOf } from "@/features/F5/approve-complete/message";
import { targetLine, ticketKey } from "@/features/F5/approve-complete/band";
import { runsKey, type RunView } from "@/features/F5/delegate/use-run";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import { clearNotice, pushNotice } from "@/features/F5/more/trail";
import type { StopRunActProps } from "@/features/F5/more/slots";

const SCREEN = "tickets";
/** 口の文と違う、画面の字（下絵 stop-conflict） */
export const STOP_RUN_MSG = {
  title: "AI を止めます",
  confirm: "止める",
  conflict: "この AI はもう止まっていました。表示を読み直しました",
} as const;
const CONFLICT_CODE = "E-RUN-002";

/** 小窓の本文「〈番号 題名〉。〈名〉のAI の作業を止めます…」（対象の行が無ければ頭を付けない） */
export function stopRunBody(run: Pick<RunView, "by">, target?: string): string {
  const who = run.by?.display_name || "自分";
  const head = target ? `${target}。` : "";
  return `${head}${who}のAI の作業を止めます（止められるのは担当者だけです）。止めたあとに届いた結果は使いません。もう一度 AI に任せることもできます`;
}

/** 断られたときの知らせの文 */
function refusedText(r: CallErr): string {
  return r.status === 409 && r.code === CONFLICT_CODE ? STOP_RUN_MSG.conflict : messageOf(r);
}

/** 止める口を呼ぶ（送っている間の 2 本目は送らない）。答えが来たら小窓を閉じてから読み直す */
function useStopRun(run: RunView, onChanged: () => Promise<void>) {
  const qc = useQueryClient();
  const [open, setOpenState] = useState(false);
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const ticketId = run.ticket_id;
  /** 開くときに、詳細が読んだチケットの答え（同じ器）から対象の行を取る（口は呼ばない） */
  const setOpen = (o: boolean) => {
    if (o) {
      const t = qc.getQueryData<{ ticket?: { number?: string | null; title?: string | null } }>(ticketKey(ticketId));
      setTarget(targetLine(t?.ticket?.number, t?.ticket?.title));
    }
    setOpenState(o);
  };
  const reread = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: runsKey(ticketId) }),
      qc.invalidateQueries({ queryKey: ["k62", "run"] }),
      qc.invalidateQueries({ queryKey: timelineKey(ticketId) }),
    ]);
    await onChanged();
  };
  const stop = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("stopActionRun", { params: { id: run.id }, body: {}, screenId: SCREEN });
      setBusy(false);
      setOpen(false);
      if (r.ok) {
        clearNotice(ticketId);
        await reread();
        return;
      }
      pushNotice(ticketId, refusedText(r));
      if (r.status === 409) await reread();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { open, setOpen, busy, stop, target };
}

export function StopRunAct({ run, onChanged }: StopRunActProps) {
  const { open, setOpen, busy, stop, target } = useStopRun(run, onChanged);
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        {STOP_RUN_MSG.confirm}
      </Button>
      <Confirm
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        onConfirm={() => void stop()}
        busy={busy}
        title={STOP_RUN_MSG.title}
        confirmLabel={STOP_RUN_MSG.confirm}
        description={stopRunBody(run, target)}
      >
        <i className="k-more-sheetmark" hidden aria-hidden="true" />
      </Confirm>
    </>
  );
}
