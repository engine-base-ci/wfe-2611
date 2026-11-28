"use client";
// 止めた後の箱（K-734）：人が止めた実行（stopped_reason が「〈名〉が止めました」・K-731 が書く字）は、赤い箱の代わりに白い箱。
//   題「〈実行の名〉のAI を止めました」・要約「〈名〉が MM/DD HH:MM に止めました。止める前にできていた物は残っています」。
//   acts は受けた箱と同じ（今は［自分で直す］だけ・持ち主の差し込み口のまま。answer=4d049789b537）。ほかの理由は受けた赤い箱のまま。
//   ［AI に任せる］は帯に出さない（題の行のボタン・K-573）。文は全部文字として出す
import { isValidElement, type ReactNode } from "react";
import { Band, type BandProps } from "@/components/k";
import { trailStamp } from "@/features/F5/more/trail";
import type { RunStoppedProps } from "@/features/F5/more/slots";

const STOPPED_BY = /^(.+)が止めました$/;
const KEPT = "止める前にできていた物は残っています";

/** 人が止めた実行なら止めた人の名前（K-731 の字「〈名〉が止めました」）。ほかの理由は null */
export function stoppedBy(reason: string | null | undefined): string | null {
  const m = reason?.trim().match(STOPPED_BY);
  return m?.[1] ? m[1] : null;
}

/** 要約。止めた時刻が読めなければ時刻を出さない */
export function stoppedSub(who: string, finishedAt: string | null | undefined): string {
  const t = finishedAt ? Date.parse(finishedAt) : Number.NaN;
  return Number.isNaN(t) ? `${who}が止めました。${KEPT}` : `${who}が ${trailStamp(t)} に止めました。${KEPT}`;
}

/** 受けた箱の acts（Band の要素なら）。読めなければ何も出さない */
function actsOf(box: ReactNode): ReactNode {
  return isValidElement<BandProps>(box) ? (box.props.acts ?? null) : null;
}

export function StoppedBox({ run, box }: RunStoppedProps): ReactNode {
  const who = stoppedBy(run.stopped_reason);
  if (!who) return <>{box}</>;
  const acts = actsOf(box);
  return (
    <Band
      tone="plain"
      title={`${run.by?.display_name || "自分"}のAI を止めました`}
      sub={stoppedSub(who, run.finished_at)}
      {...(acts ? { acts } : {})}
    />
  );
}
