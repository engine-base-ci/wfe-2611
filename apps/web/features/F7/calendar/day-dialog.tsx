"use client";
// 日の小窓（キャンバス CalDay・K-481）：その日のチケットの一覧と、その日が期限のチケットを作る行。
//   期限を動かすときは理由が必須（D-151.11）：各行の「日を動かす」を開くと、動かす先と理由の欄が出る（案）。理由は変更の 1 行に残り、担当者に知らせが出る。
//   形は共通の小窓（components/k の Dialog）。開閉・戻り先は Dialog が持つ
import { Button, Dialog, TextArea, TextField } from "@/components/k";
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
}

function MoveEditor({ item, move }: { item: DayItem; move: DayMove }) {
  return (
    <div className="k-f7-calendar-move">
      <TextField name="to" label="動かす先" type="date" defaultValue={move.to} />
      <TextArea
        name="reason"
        label="理由"
        required
        hint={`やり取りに残り、担当の${item.owner}さんに知らせる`}
        defaultValue={move.reason}
        error={move.reasonError ?? null}
        rows={2}
      />
      <div className="k-f7-calendar-move-acts">
        <Button variant="outlined" size="sm">
          やめる
        </Button>
        <Button size="sm">動かす</Button>
      </div>
    </div>
  );
}

export function DayDialog({ open, onOpenChange, title, note, items, moving }: DayDialogProps) {
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
              >
                日を動かす
              </button>
            </div>
            {moving?.number === i.number ? <MoveEditor item={i} move={moving} /> : null}
          </li>
        ))}
      </ul>
      <form className="k-f7-calendar-day-new" onSubmit={(e) => e.preventDefault()}>
        <input
          className="k-input"
          name="title"
          aria-label="この日が期限のチケットを作る"
          placeholder="この日が期限のチケットを作る"
        />
        <Button type="submit" variant="outlined">
          作る
        </Button>
      </form>
      <p className="k-f7-calendar-day-hint">チケットをほかの日へつかんで動かすと、期限が変わる（確かめる小窓が出る）</p>
    </Dialog>
  );
}
