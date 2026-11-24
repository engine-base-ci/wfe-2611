"use client";
// 条件を組む（キャンバス LsFilter・一覧の検索条件「詳しく」）。値を受け取って描くだけ（口は呼ばない）。
//   上から：題（件数は出さない：口が総数を返さない）／ことばで探す（AI・まだ使えないので押せない形・D-145.9）／条件の行（かつ）と まとまり（どれか 1 つ・または）／＋ 条件・＋ まとまり／足の行。
//   各行は 項目 ▾・が（でない・に含む）▾・値の札（×で外す）。値の札は担当者・状態・分類の複数、期限・題名の 1 つ
import type { ReactNode } from "react";
import { Button } from "@/components/k";

export interface ConditionRow {
  field: string;
  /** 「が」「でない」「に含む」 */
  op: string;
  /** 値の札（鈴木・鈴木のAI など。× で 1 つずつ外す） */
  values?: readonly string[];
  /** 値が 1 つの字（今週（11/02〜11/08）・見積） */
  text?: string;
}

export type ConditionItem =
  { kind: "row"; row: ConditionRow } | { kind: "group"; join: string; rows: readonly ConditionRow[] };

export interface ConditionBuilderProps {
  /** ことばで探すの見本の文（AI がまだ使えない間は押せない形） */
  aiSample: string;
  items: readonly ConditionItem[];
  /** 足の「検索条件を保存」（一覧では K-479 の SaveViewButton を渡す。無ければ見本のボタン） */
  saveAction?: ReactNode;
}

function Row({ lead, row }: { lead: string; row: ConditionRow }) {
  return (
    <li className="k-f7-saved-cond-row">
      <span className="k-f7-saved-cond-lead">{lead}</span>
      <button type="button" className="k-f7-saved-pick" aria-haspopup="listbox" aria-label={`項目：${row.field}`}>
        {row.field}
        <span aria-hidden="true"> ▾</span>
      </button>
      <button
        type="button"
        className="k-f7-saved-pick"
        aria-haspopup="listbox"
        aria-label={`${row.field}の言い方：${row.op}`}
      >
        {row.op}
        <span aria-hidden="true"> ▾</span>
      </button>
      <span className="k-f7-saved-cond-values">
        {row.values?.map((v) => (
          <span key={v} className="k-f7-saved-chip" data-tone="value">
            {v}
          </span>
        ))}
        {row.text ? <span className="k-f7-saved-cond-text">{row.text}</span> : null}
      </span>
      <button type="button" className="k-f7-saved-cond-x" aria-label={`外す：${row.field}`}>
        ×
      </button>
    </li>
  );
}

export function ConditionBuilder({ aiSample, items, saveAction }: ConditionBuilderProps) {
  return (
    <section className="k-f7-saved-cond" aria-label="条件を組む">
      <div className="k-f7-saved-cond-head">
        <b>条件を組む</b>
      </div>
      <div className="k-f7-saved-ai" aria-disabled="true" title="ことばで探す（準備中）">
        <span className="k-f7-saved-ai-mark" aria-hidden="true">
          AI
        </span>
        <span className="k-f7-saved-ai-text">ことばで探す：「{aiSample}」</span>
        <Button size="sm" variant="outlined" aria-disabled="true" tabIndex={-1} title="条件にする（準備中）">
          条件にする
        </Button>
      </div>
      <ul className="k-f7-saved-cond-list" aria-label="条件">
        {items.map((it, i) =>
          it.kind === "row" ? (
            <Row key={`${it.row.field}-${i}`} lead={i === 0 ? "条件" : "かつ"} row={it.row} />
          ) : (
            <li key={`group-${i}`} className="k-f7-saved-cond-group">
              <p className="k-f7-saved-cond-lead">まとまり：{it.join}</p>
              <ul className="k-f7-saved-cond-list" aria-label="まとまりの条件">
                {it.rows.map((r, j) => (
                  <Row key={`${r.field}-${j}`} lead={j === 0 ? "" : "または"} row={r} />
                ))}
              </ul>
            </li>
          ),
        )}
      </ul>
      <div className="k-f7-saved-cond-add">
        <Button size="sm" variant="outlined">
          ＋ 条件
        </Button>
        <Button size="sm" variant="outlined">
          ＋ まとまり
        </Button>
      </div>
      <div className="k-f7-saved-cond-foot">
        <Button variant="ghost" size="sm">
          かんたんに戻す
        </Button>
        <span className="k-f7-saved-cond-foot-acts">
          {saveAction ?? (
            <Button variant="outlined" size="sm">
              検索条件を保存
            </Button>
          )}
          <Button size="sm">この条件で見る</Button>
        </span>
      </div>
    </section>
  );
}
