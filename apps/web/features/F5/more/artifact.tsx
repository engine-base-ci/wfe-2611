"use client";
// 成果物のカード（［試し打ち（自分宛）］が押せる形）と、自分で直す面（段 6 core・K-743・K-747 の下絵）。
//   試し打ちは任意（聞くこと 5）：承認の前に必ず通す手順に見えないよう、承認の帯の主ボタンより控えめな［ghost］にしてカードの横に置く。
//   カードの枠は今の artifact-card.tsx と同じクラス（.k-artifact-*）。データを見る・先方に確かめてもらうは押せない形のまま。
import { Button } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import "@/features/F5/approve-complete/approve.css";
import "./more.css";

export const SAMPLE_ARTIFACT =
  "請求書 No.2026-1101\nセイコー株式会社 経理部 山田様\nシステム保守（11 月分）1,500,000 円 ／ 追加対応 2 回 60,000 円\n合計（税込）1,716,000 円";

export function ArtifactCardMore({ version, text = SAMPLE_ARTIFACT }: { version: number; text?: string }) {
  return (
    <section aria-label="成果物" className="k-artifact-card">
      <div className="k-artifact-head">{text}</div>
      <div className="k-artifact-info">
        <div className="k-artifact-meta">{`成果物の版 ${version}`}</div>
        <div className="k-artifact-acts">
          <Button variant="outlined" className="k-artifact-btn">
            大きく見る
          </Button>
          <InertButton className="k-artifact-btn">データを見る</InertButton>
          <Button variant="ghost" className="k-artifact-btn">
            試し打ち（自分宛）
          </Button>
          <InertButton className="k-artifact-btn">先方に確かめてもらう</InertButton>
        </div>
      </div>
    </section>
  );
}

export type EditState = "editing" | "saving" | "conflict";

const EDIT_NOTE: Record<EditState, string> = {
  editing: "直した物は新しい版になり、承認待ちのままです。AI のチェックは残ります",
  saving: "保存しています",
  conflict: "",
};

/** 自分で直す面：成果物の字を直し、保存すると新しい版（欄は見本の値を出すだけ） */
export function SelfEditSurface({ state, text = SAMPLE_ARTIFACT }: { state: EditState; text?: string }) {
  const saving = state === "saving";
  return (
    <section aria-label="成果物を直す" className="k-more-edit">
      <h3>{state === "conflict" ? "成果物を直す（版 2 をもとに）" : "成果物を直す（版 1 をもとに）"}</h3>
      <textarea className="k-input" aria-label="成果物の字" rows={5} value={text} readOnly />
      <div className="k-more-edit-acts">
        <Button loading={saving} disabled={saving || state === "conflict"}>
          直して保存する
        </Button>
        <Button variant="outlined" disabled={saving}>
          やめる
        </Button>
        {EDIT_NOTE[state] ? <span className="k-more-edit-note">{EDIT_NOTE[state]}</span> : null}
      </div>
    </section>
  );
}
