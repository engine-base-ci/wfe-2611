"use client";
// チケットを作る画面の帯（K-224・キャンバス Create の header）。見出し・作り方の切り替え・下書きの保存の状態。
//   作り方は「自分で書く」だけが使える。AI と話して作る・過去のチケットから複製 は出すが押せない（D-145.5・D-144.1：「準備中」の字は目に見せず title にだけ）
//   保存の状態は、開いた直後（まだ残していない）は空。サーバーに残したら答えの saved_at を日本時間で、残せなかったら短く「下書きを残せませんでした」
//     （詳しい知らせは本文の箱「下書きをサーバーに残せませんでした」。同じ文を 2 か所に出さない・answer=d4790d24d5e2・D-128.62）
//   幅 767 以下は外枠の鈴を見出しの右に置く（ShellBell・K-138）
import { ShellBell } from "@/components/k/shell";

export type SaveView = { kind: "none" } | { kind: "saved"; at: string } | { kind: "failed" };

/** 保存した時刻（ISO）を日本時間の HH:MM に */
export function jstClock(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 3600_000).toISOString().slice(11, 16);
}

const NOT_YET = ["AI と話して作る", "過去のチケットから複製"] as const;

export function CreateHead({ save }: { save: SaveView }) {
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
      <span className="k-create-how" aria-label="作り方">
        <span aria-current="true">自分で書く</span>
        {NOT_YET.map((name) => (
          <span key={name} aria-disabled="true" title={`${name}（準備中）`}>
            {name}
          </span>
        ))}
      </span>
      <span className="k-create-saved" role="status" aria-label="下書きの保存">
        {text}
      </span>
      <ShellBell />
    </header>
  );
}
