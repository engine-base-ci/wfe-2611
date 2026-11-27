"use client";
// 片付けに失敗した承認の後の実行の帯（K-1192・K-190 の子）：実行の形の sweep_failed_at が null でない待っている実行のとき、
//   帯（band.tsx）の ④「実行待ち・PC が閉じています」の代わりに赤い箱（role=alert）を出す。
//   ［この実行を止める］は担当者だけ（D-190.3 answer=449e47c15ace）。押すと確かめの小窓（components/k の Confirm）。
//   「止める」で止める口 stopActionRun（K-731）を 1 回呼ぶ。答えを待つ間は主ボタンが処理中（二度押しで 2 回呼ばない）。
//   字は決める人の答え（D-190.4 answer=ed20fcc1483d）。色・大きさは components/k のまま（生の値を書かない）。
import { useRef, useState } from "react";
import { Band, BandLine, Button, Confirm } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";

export const SWEEP_MSG = {
  title: "片付けに失敗しています",
  body: "この実行は待ったままで、PC には渡していません。止めると、もう一度『AI に任せる』から始められます",
  stop: "この実行を止める",
  confirmTitle: "この実行を止めますか",
  confirmBody: "承認した中身は実行しません。チケットは作業中に戻ります。",
  confirmLabel: "止める",
} as const;

export interface SweepFailedBandProps {
  runId: string;
  /** 見ている人が担当者か（読めるまでは false・ボタンを出さない） */
  canStop: boolean;
  /** 止めた：チケットと実行を読み直す */
  onChanged: () => Promise<void>;
  /** 口が断った：知らせを出して読み直す（帯の failed） */
  onFailed: (r: CallErr) => Promise<void>;
  /** 下絵の描き手だけ：小窓を開いた形で描く（口は呼ばない） */
  initialOpen?: boolean;
}

export function SweepFailedBand({ runId, canStop, onChanged, onFailed, initialOpen = false }: SweepFailedBandProps) {
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない（描き直しを待たずに守る）
  const stop = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("stopActionRun", { params: { id: runId }, body: {}, screenId: "tickets" });
      setOpen(false);
      if (r.ok) await onChanged();
      else await onFailed(r);
    } finally {
      // 網が切れて投げても、処理中の印を外して小窓を閉じる（閉じ込めない）
      sending.current = false;
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <>
      <Band
        tone="danger"
        role="alert"
        title={SWEEP_MSG.title}
        {...(canStop ? { acts: <Button onClick={() => setOpen(true)}>{SWEEP_MSG.stop}</Button> } : {})}
      >
        <BandLine>{SWEEP_MSG.body}</BandLine>
      </Band>
      {canStop ? (
        <Confirm
          open={open}
          onOpenChange={setOpen}
          title={SWEEP_MSG.confirmTitle}
          description={SWEEP_MSG.confirmBody}
          confirmLabel={SWEEP_MSG.confirmLabel}
          tone="danger"
          busy={busy}
          onConfirm={() => void stop()}
        />
      ) : null}
    </>
  );
}
