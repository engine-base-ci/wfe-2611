"use client";
// 自分に関わるもの（キャンバス Main・MobileList）の部品：スマホの 1 行と本文。値を受け取って描くだけ（K-478）。
//   数の札と絞りの札は features/F7/due の NumberCards・MineChips が正（押す動きを受ける口がある・デスクトップもスマホも同じ部品）。
//   表（ListTable）・右の列（MainSide）・表示設定（ColumnSettings）は前からの部品（features/F4/ticket-list）をそのまま使う。
//   「渡されたもの」の札は押せない形（D-151.19）。本当の値が無い数は出さない（D-144.3）
import { Flame } from "lucide-react";
import { MineChips, type MineChip } from "../due/views";
import { STAGE_TONE, type Tone } from "./head";

export interface MobileTicketRowProps {
  href?: string;
  number: string;
  title: string;
  stage: string;
  who: string;
  due: string;
  late?: boolean;
}

/** スマホの 1 件 1 行（キャンバス MobileList）：題名・番号・状態・担当・期限 */
export function MobileTicketRow({ href, number, title, stage, who, due, late }: MobileTicketRowProps) {
  const tone: Tone = STAGE_TONE[stage] ?? "neutral";
  return (
    <a className="k-f7-overview-mrow" href={href ?? "#"}>
      <b className="k-f7-overview-mrow-title">{title}</b>
      <span className="k-f7-overview-mrow-meta">
        <span>{number}</span>
        <span className="k-f7-overview-mrow-stage" data-f7-tone={tone}>
          {stage}
        </span>
        <span>{who}</span>
        <span className="k-f7-overview-mrow-due" data-late={late || undefined}>
          {due}
          {late ? (
            <span role="img" aria-label="期限切れ">
              <Flame aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </span>
    </a>
  );
}

export interface MobileSection {
  label: string;
  rows: readonly MobileTicketRowProps[];
}

export interface MobileMineBodyProps {
  /** 絞りの札（features/F7/due の MineChips と同じ値） */
  chips: readonly MineChip[];
  /** 押している札の鍵（無ければ「すべて」の all） */
  current?: string;
  /** 絞りの札を押したとき（K-478） */
  onPick?: (key: string) => void;
  sections: readonly MobileSection[];
}

/** スマホの本文：絞りの札の行と、期限で区切った 1 行ずつの並び。縦に送れるのは並びの所だけ（頭のタブと札は止まったまま） */
export function MobileMineBody({ chips, current = "all", onPick, sections }: MobileMineBodyProps) {
  return (
    <div className="k-f7-overview-phone">
      <div className="k-f7-overview-phone-chips" role="group" aria-label="自分に関わるものの絞り込み">
        <MineChips chips={chips} current={current} {...(onPick ? { onPick } : {})} />
      </div>
      <div className="k-f7-overview-phone-list">
        {sections.map((s) => (
          <section key={s.label} className="k-f7-overview-phone-section" aria-label={s.label}>
            <h2 className="k-f7-overview-phone-label">{s.label}</h2>
            {s.rows.map((r) => (
              <MobileTicketRow key={r.number} {...r} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
