"use client";
// 成果物のカード（K-227・キャンバス TicketDetail の本文の区画「成果物」）：承認待ちの帯の箱の下（帯の region の中・箱の外）。
//   縮小の絵の代わりに字の頭（.k-artifact-head・高さ 240 まで）・「成果物の版 N」・「大きく見る」（小窓「成果物」に全文）。
//   データを見る・試し打ち（自分宛）・先方に確かめてもらう はまだ使えないので押せない形で出す（D-145.9）。
//   口は成果物を作った AI の名前・ファイルの名前・縮小の絵を返さないので、名前は「成果物の版 N」にする（嘘の値を書かない）
import { useState } from "react";
import { Button, Dialog, Prose } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import "./approve.css";

export const ARTIFACT_LABEL = "成果物";
const INERT = ["データを見る", "試し打ち（自分宛）", "先方に確かめてもらう"] as const;

export function ArtifactCard({ version, text }: { version: number; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={ARTIFACT_LABEL} className="k-artifact-card">
      <div className="k-artifact-head">{text}</div>
      <div className="k-artifact-info">
        <div className="k-artifact-meta">{`成果物の版 ${version}`}</div>
        <div className="k-artifact-acts">
          <Button variant="outlined" className="k-artifact-btn" onClick={() => setOpen(true)}>
            大きく見る
          </Button>
          {INERT.map((n) => (
            <InertButton key={n} className="k-artifact-btn">
              {n}
            </InertButton>
          ))}
        </div>
      </div>
      <Dialog title={ARTIFACT_LABEL} open={open} onOpenChange={setOpen}>
        <Prose>{text}</Prose>
      </Dialog>
    </section>
  );
}
