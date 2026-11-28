"use client";
// K-190 の下絵の描き手（K-1192）：本番と同じ部品（SweepFailedBand・components/k）に見本の値を渡すだけ（口は呼ばない）。
//   並びは 07_functional/段1-K190/下絵.html の 2・4 と、小窓（確かめ）
import { SweepFailedBand } from "@/features/F5/approve-complete/sweep-failed";
import type { ReactNode } from "react";
import { BAND_LABEL } from "@/features/F5/approve-complete/band";

const RUN_ID = "mock-run";
const noop = async () => {};

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="k-root k-page">
      <section aria-label={BAND_LABEL} className="k62-band k-section" data-busy="">
        {children}
      </section>
    </main>
  );
}

export function MockView({ id }: { id: string }) {
  if (id === "k190-sweep-owner")
    return (
      <Frame>
        <SweepFailedBand runId={RUN_ID} canStop onChanged={noop} onFailed={noop} />
      </Frame>
    );
  if (id === "k190-sweep-other")
    return (
      <Frame>
        <SweepFailedBand runId={RUN_ID} canStop={false} onChanged={noop} onFailed={noop} />
      </Frame>
    );
  if (id === "k190-sweep-confirm")
    return (
      <Frame>
        <SweepFailedBand runId={RUN_ID} canStop initialOpen onChanged={noop} onFailed={noop} />
      </Frame>
    );
  return <p>この状態はまだありません：{id}</p>;
}
