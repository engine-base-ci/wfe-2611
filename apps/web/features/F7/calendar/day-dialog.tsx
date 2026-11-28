"use client";
// 日の小窓（キャンバス CalDay・K-481）：その日のチケットの一覧と、その日が期限のチケットを作る行。
//   期限を動かすときは理由が必須（D-151.11）：各行の「日を動かす」を開くと、動かす先と理由の欄が出る（案）。理由は変更の 1 行に残り、担当者に知らせが出る。
//   形は共通の小窓（components/k の Dialog）。開閉・戻り先は Dialog が持つ
import { Button, Dialog, NoticeBox, TextArea, TextField } from "@/components/k";
import "../../F4/ticket-list/ticket-list.css";
import "../overview/tones.css";
import "./calendar.css";
import type { Tone } from "../overview/head";

export interface DayItem {
  number: string;
  title: string;
  kindTone: Tone;
  stage: string;
  stageTone: Tone;
  /** 担当者の名前（理由の補足「担当の〇〇さんに知らせる」） */
  owner: string;
  href?: string;
}

/** 開いている「日を動かす」 */
export interface DayMove {
  number: string;
  /** 動かす先（input[type=date] の値） */
  to: string;
  reason: string;
  /** 理由が空などの誤り（欄の赤い字） */
  reasonError?: string | null;
  /** 動かす先の誤り（今日より前・欄の赤い字） */
  toError?: string | null;
  /** 口が断った・落ちた（editor の上の赤い箱） */
  notice?: string | null;
  /** 送っている間（押し直しを止める） */
  busy?: boolean;
  /** 「動かす」を押せない訳（aria-disabled・title） */
  submitDisabled?: string | undefined;
}

/** 日を動かす editor の動き（無ければ描くだけ＝モック） */
export interface DayMoveActs {
  onMoveOpen: (number: string) => void;
  onTo: (to: string) => void;
  onReason: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export interface DayDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 「11/5（木）」 */
  title: string;
  /** その日の節目など（「セイコー様の締め」） */
  note?: string;
  items: readonly DayItem[];
  moving?: DayMove;
  /** 日を動かす editor の動き（本番の画面が渡す） */
  acts?: DayMoveActs;
}

function MoveEditor({ item, move, acts }: { item: DayItem; move: DayMove; acts?: DayMoveActs | undefined }) {
  const off = move.submitDisabled;
  return (
    <div className="k-f7-calendar-move">
      {move.notice ? <NoticeBox>{move.notice}</NoticeBox> : null}
      <TextField
        name="to"
        label="動かす先"
        type="date"
        error={move.toError ?? null}
        {...(acts ? { value: move.to, onChange: (e) => acts.onTo(e.target.value) } : { defaultValue: move.to })}
      />
      <TextArea
        name="reason"
        label="理由"
        required
        {...(item.owner ? { hint: `やり取りに残り、担当の${item.owner}さんに知らせる` } : {})}
        error={move.reasonError ?? null}
        rows={2}
        {...(acts
          ? { value: move.reason, onChange: (e) => acts.onReason(e.target.value) }
          : { defaultValue: move.reason })}
      />
      <div className="k-f7-calendar-move-acts">
        <Button variant="outlined" size="sm" {...(acts ? { onClick: acts.onCancel } : {})}>
          やめる
        </Button>
        <Button
          size="sm"
          loading={Boolean(move.busy)}
          {...(off ? { "aria-disabled": true, title: off } : {})}
          {...(acts ? { onClick: () => !off && acts.onSubmit() } : {})}
        >
          動かす
        </Button>
      </div>
    </div>
  );
}

export function DayDialog({ open, onOpenChange, title, note, items, moving, acts }: DayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange?.(o)} title={title} {...(note ? { subtitle: note } : {})}>
      <ul className="k-f7-calendar-day-list">
        {items.map((i) => (
          <li key={i.number}>
            <div className="k-f7-calendar-day-row">
              <span className="k-f7-calendar-dot" data-f7-tone={i.kindTone} aria-hidden="true" />
              <a className="k-f7-calendar-day-main" href={i.href ?? "#"}>
                <span className="k-list-dim">{i.number}</span> {i.title}
              </a>
              <span className="k-f7-calendar-stage" data-f7-tone={i.stageTone}>
                {i.stage}
              </span>
              <button
                type="button"
                className="k-list-tool"
                aria-expanded={moving?.number === i.number}
                aria-label={`${i.number} の日を動かす`}
                {...(acts ? { onClick: () => acts.onMoveOpen(i.number) } : {})}
              >
                日を動かす
              </button>
            </div>
            {moving?.number === i.number ? <MoveEditor item={i} move={moving} acts={acts} /> : null}
          </li>
        ))}
      </ul>
      <form className="k-f7-calendar-day-new" onSubmit={(e) => e.preventDefault()}>
        {/* 作る面は F4 の物。この小窓からはまだ作らない（押せない形・D-145.9） */}
        <input
          className="k-input"
          name="title"
          aria-label="この日が期限のチケットを作る"
          placeholder="この日が期限のチケットを作る"
          disabled
        />
        <Button type="submit" variant="outlined" aria-disabled>
          作る
        </Button>
      </form>
      <p className="k-f7-calendar-day-hint">チケットをほかの日へつかんで動かすと、期限が変わる（確かめる小窓が出る）</p>
    </Dialog>
  );
}
