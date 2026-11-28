"use client";
// AI の案のカード（チケットを作る画面の右の会話・K-777）。AI がチケットの題・本文・確認項目の案を会話の中に出し、
//   人は［全部使う］か［選んで使う（欄ごとにチェック）］で左の欄に入れる。使った後は「欄に入りました」の印だけを残す。
//   動き（K-777）：onAll・onPick を渡したときだけ押せる。［選んで使う］の間（欄ごとの四角・最初は全部に印・［やめる］で戻る）はカードの中で持つ。
//   渡さなければ値を受け取って描くだけ（下絵）。字は書かれたとおり（HTML を作らない）
import { useState } from "react";
import { Badge, Button } from "@/components/k";
import "./room.css";

export interface ProposalItem {
  key: string;
  /** 欄の名前（題名・本文・確認項目） */
  label: string;
  /** 案の中身（1〜2 行） */
  preview: string;
  /** 選んで使うとき、最初からチェックが付いているか */
  checked?: boolean;
  /** 使い終わった後の状態：入った／使わなかった */
  result?: "in" | "skipped";
}

export interface Proposal {
  /** open＝まだ使っていない／select＝欄ごとに選んでいる／all＝全部使った／some＝選んで使った */
  mode: "open" | "select" | "all" | "some";
  items: readonly ProposalItem[];
  /** 案の行の id（会話の行の id・K-777） */
  id?: string;
  /** 案の中身そのもの（K-775 の proposal・欄に入れる元・K-777） */
  input?: { title?: string; body?: string; checks?: readonly string[] };
  /** ［全部使う］（K-777） */
  onAll?: () => void;
  /** ［選んだ欄を使う（N 件）］：選んだ欄の key（K-777） */
  onPick?: (keys: string[]) => void;
}

const HEAD: Record<Proposal["mode"], string> = {
  open: "まだ欄には入っていません",
  select: "使う欄にチェックを付けてください",
  all: "全部の欄に入りました",
  some: "選んだ欄に入りました",
};

/** 丸・四角の選択と、その字の 1 行目を同じ高さの中心にそろえる 1 つの小さな部品（字は 1 行にする） */
export function ChoiceRow({
  label,
  checked = false,
  kind = "checkbox",
  onChange,
}: {
  label: string;
  checked?: boolean;
  kind?: "checkbox" | "radio";
  /** 渡したときは印を持ち主が持つ（K-777）。渡さなければ最初の印だけ（下絵） */
  onChange?: (on: boolean) => void;
}) {
  return (
    <label className="k-room-choice">
      {onChange ? (
        <input type={kind} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      ) : (
        <input type={kind} defaultChecked={checked} />
      )}
      <span>{label}</span>
    </label>
  );
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { items, onAll, onPick } = proposal;
  const live = Boolean(onAll || onPick);
  /** 押せるカード：［選んで使う］の間と、欄ごとの印（最初は全部に印） */
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(items.map((i) => i.key)));
  const mode: Proposal["mode"] =
    live && selecting && (proposal.mode === "open" || proposal.mode === "select") ? "select" : proposal.mode;
  const done = mode === "all" || mode === "some";
  const isOn = (it: ProposalItem) => (live ? checked.has(it.key) : (it.checked ?? false));
  const picked = items.filter(isOn).length;
  const toggle = (key: string, on: boolean) =>
    setChecked((cur) => {
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const startSelect = () => {
    setChecked(new Set(items.map((i) => i.key)));
    setSelecting(true);
  };
  return (
    <article className="k-room-prop" aria-label="AI の案" data-mode={mode}>
      <header className="k-room-prop-head">
        <Badge tone="ai">案</Badge>
        <b>チケットの案</b>
        <span>{HEAD[mode]}</span>
      </header>
      <ul className="k-room-prop-list">
        {items.map((it) => (
          <li key={it.key} data-result={it.result}>
            {mode === "select" ? (
              live ? (
                <ChoiceRow label={it.label} checked={isOn(it)} onChange={(on) => toggle(it.key, on)} />
              ) : (
                <ChoiceRow label={it.label} checked={it.checked ?? false} />
              )
            ) : (
              <span className="k-room-prop-name">
                {it.label}
                {done ? (
                  <small data-result={it.result}>{it.result === "in" ? "欄に入りました" : "使っていません"}</small>
                ) : null}
              </span>
            )}
            <p className="k-room-prop-val">{it.preview}</p>
          </li>
        ))}
      </ul>
      {done ? null : (
        <footer className="k-room-prop-acts">
          {mode === "select" ? (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={live && picked === 0}
                onClick={
                  live
                    ? () => {
                        setSelecting(false);
                        onPick?.(items.filter(isOn).map((i) => i.key));
                      }
                    : undefined
                }
              >{`選んだ欄を使う（${picked} 件）`}</Button>
              <Button size="sm" variant="outlined" onClick={live ? () => setSelecting(false) : undefined}>
                やめる
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="primary" onClick={onAll}>
                全部使う
              </Button>
              <Button size="sm" variant="outlined" onClick={live ? startSelect : undefined}>
                選んで使う
              </Button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}
