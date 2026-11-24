"use client";
// 一覧（全部）とグループの一覧の、検索条件の箱と表の上の道具（K-252・キャンバス List・D-145.9）。
//   言葉の欄（題名か番号で絞る）だけが使える：100 字まで・打ち終わってから 300ms で 1 回だけ口を呼ぶ（G-16）・打った字はそのまま渡す（そろえるのは口・K-92）。
//   検索条件を保存はグループの一覧で押せる（K-479・保存の小窓）。かんたん／詳しく・畳む・状態・親子・種別・分類・節目・担当者・AI に任せている は機能がまだ（K-67）なので、出すが押せない（aria-disabled・グレー）。
//   表の上の道具：件数は総数を返さない口なので空（[data-value] の中は空）。まとめて操作・CSV で取り込むは押せない。表示設定は一覧の共通の部品（list-columns.tsx）
import { useEffect, useRef, useState } from "react";
import { SaveViewButton } from "@/features/F7/saved/save-view-dialog";
import { ColumnSettings, type Columns } from "./list-columns";

/** 言葉の欄に入る字の上限（D-128.157） */
export const QUERY_MAX = 100;
/** 打ち終わってから口を呼ぶまで */
const QUERY_WAIT_MS = 300;

const STATES = ["すべて", "未着手", "作業中", "確認中", "承認待ち", "実行中", "渡し中", "完了以外"] as const;
const FAMILY = ["すべて", "親だけ", "子だけ"] as const;
const FIELDS: [string, string][] = [
  ["種別", "すべて"],
  ["分類", "すべて"],
  ["節目", "すべて"],
  ["担当者", "すべて"],
  ["AI に任せている", "どちらも"],
];

/** 押せない字（まだ使えない）。Tab で止まらない・押しても何も起きない */
function Off({ className, children, label }: { className: string; children: string; label?: string }) {
  return (
    <span className={className} aria-disabled="true" title={`${label ?? children}（準備中）`}>
      {children}
    </span>
  );
}

/** 札の行（状態・親子）。行ごと押せない */
function ChipGroup({ label, chips, current }: { label: string; chips: readonly string[]; current: string }) {
  return (
    <span
      className="k-list-search-group"
      role="group"
      aria-label={label}
      aria-disabled="true"
      title={`${label}（準備中）`}
    >
      <span className="k-list-search-label">{label}</span>
      {chips.map((c) => (
        <span key={c} className="k-list-search-chip" data-current={c === current || undefined}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** 字を 100 字（コードポイント）までに切る */
const clip = (v: string): string => {
  const chars = [...v];
  return chars.length > QUERY_MAX ? chars.slice(0, QUERY_MAX).join("") : v;
};

export function ListSearch({ onQuery }: { onQuery: (q: string) => void }) {
  const [text, setText] = useState("");
  const sent = useRef("");
  useEffect(() => {
    if (text === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = text;
      onQuery(text);
    }, QUERY_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [text, onQuery]);
  return (
    <section className="k-list-search" aria-label="検索条件">
      <div className="k-list-search-row">
        <b>検索条件</b>
        <span className="k-list-search-seg">
          <Off className="k-list-search-seg-item" label="かんたん">
            かんたん
          </Off>
          <Off className="k-list-search-seg-item" label="詳しく">
            詳しく
          </Off>
        </span>
        <span className="k-list-search-acts">
          <SaveViewButton className="k-list-tool" q={text} />
          <Off className="k-list-tool" label="畳む">
            畳む ▴
          </Off>
        </span>
      </div>
      <div className="k-list-search-chips">
        <ChipGroup label="状態" chips={STATES} current="すべて" />
        <ChipGroup label="親子" chips={FAMILY} current="すべて" />
      </div>
      <div className="k-list-search-fields">
        {FIELDS.map(([name, value]) => (
          <span key={name} className="k-list-search-field" aria-disabled="true" title={`${name}（準備中）`}>
            {name}
            <span className="k-list-search-input">{value} ▾</span>
          </span>
        ))}
        <label className="k-list-search-field" data-live>
          言葉
          <input
            className="k-list-search-input"
            type="text"
            aria-label="題名か番号で絞る"
            placeholder="題名・番号"
            maxLength={QUERY_MAX}
            value={text}
            onChange={(e) => setText(clip(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

/** 表の上の道具（件数・まとめて操作・CSV で取り込む・表示設定） */
export function ListTools({ columns }: { columns: Columns }) {
  return (
    <div className="k-list-filter" role="group" aria-label="一覧の道具">
      <span className="k-list-dim" data-value />
      <span className="k-list-tools">
        <Off className="k-list-tool">まとめて操作</Off>
        <Off className="k-list-tool">CSV で取り込む</Off>
        <ColumnSettings columns={columns} title="一覧の見え方" />
      </span>
    </div>
  );
}
