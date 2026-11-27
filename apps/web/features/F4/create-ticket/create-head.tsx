"use client";
import type { ReactNode } from "react";
import { DuplicateHow } from "@/features/F4/duplicate/duplicate-how";
import { AiHowButton, SelfHowButton } from "@/features/F5/room/create-talk-aside";
// チケットを作る画面の帯（K-224・キャンバス Create の header）。見出し・作り方の切り替え・下書きの保存の状態。
//   作り方は「自分で書く」と「AI と話して作る」（道 how=ai・欄の右に会話・K-767・D-153.17）と「過去のチケットから複製」（元を選ぶ小窓 → 複製の小窓・K-446 の DuplicateHow）
//   保存の状態は、開いた直後（まだ残していない）は空。サーバーに残したら答えの saved_at を日本時間で、残せなかったら短く「下書きを残せませんでした」
//     （詳しい知らせは本文の箱「下書きをサーバーに残せませんでした」。同じ文を 2 か所に出さない・answer=d4790d24d5e2・D-128.62）
//   知らせの鈴は外枠の上の帯にある（どの幅でも・D-147）。この帯には置かない
//   右に「下書きのまま閉じる」と「作る」（action・K-442・下絵 v2 の f4v2-create-head と同じ div.k-f4d-head-acts）。読み込み中は action なし

export type SaveView = { kind: "none" } | { kind: "saved"; at: string } | { kind: "failed" };

/** 保存した時刻（ISO）を日本時間の HH:MM に */
export function jstClock(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 3600_000).toISOString().slice(11, 16);
}

export function CreateHead({ save, action }: { save: SaveView; action?: ReactNode }) {
  const text =
    save.kind === "saved"
      ? `下書きを自動で保存しました（${save.at}）`
      : save.kind === "failed"
        ? "下書きを残せませんでした"
        : "";
  return (
    <header className="k-page-head k-create-head">
      <h1 id="create-ticket-title" title="チケットを作る">
        チケットを作る
      </h1>
      <DuplicateHow
        lead={
          <>
            <SelfHowButton />
            <AiHowButton />
          </>
        }
      />
      <span className="k-create-saved" role="status" aria-label="下書きの保存">
        {text}
      </span>
      {action ? <div className="k-f4d-head-acts">{action}</div> : null}
    </header>
  );
}
