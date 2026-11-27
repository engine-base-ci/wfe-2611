"use client";
// 差し込み口の先：まとめて承認（K-769・器 slots.tsx の QueueBulkSlot）。器と承認待ちのファイルは触らない。
//   head＝頭の四角（全部選ぶ・一部なら途中の印）・row＝行の四角（AI の成果物だけ・ほかは「—」）・tool＝［まとめて承認（全部）］・
//   band＝選んだ帯（table＝表の上・mobile＝スマホのカードの後ろで画面の下に貼り付く・幅で片方だけ・answer=0050b3906ae6）・
//   card＝スマホのカードの番号の所（カードの li の中の meta の行。選べる物は四角と番号の 1 行・ほかは番号だけ。番号はここだけが描く＝1 回）。
//   確かめの小窓と承認した後の帯（Callout）は 1 つだけ描く：どの幅でも在る mobile の置き場（承認待ちの本文の箱 .k-ap-body の直の子）が持ち、
//   帯は本文の箱の頭に並べる（flex の order。下絵 bulk-done・bulk-partial は帯がカードの上）。
//   選べるのは 50 件まで：選んでいない四角は素の disabled と title（answer=0574d6e78a2a）
import { useEffect, useRef, type ReactNode } from "react";
import { Button, Callout } from "@/components/k";
import type { QueueRow } from "@/features/F5/approve-complete/queue";
import type { QueueBulkProps } from "../slots";
import { BulkApproveConfirm } from "../bulk/bulk-confirm";
import {
  ALL_LABEL,
  BAR_REGION,
  BULK_LIMIT,
  LIMIT_TITLE,
  ONE_BY_ONE_TITLE,
  PICKED_LABEL,
  PICK_ALL_LABEL,
  pickLabel,
  pickedText,
} from "../bulk/bulk-words";
import { inListOrder, isPickable, useBulkApprove, useBulkPick, useBulkPreview, useBulkState } from "../bulk/use-bulk";

/** 帯を本文の箱の頭へ（本文の箱は flex の縦並び） */

export function QueueBulkFill({ part, at, row, rows }: QueueBulkProps): ReactNode {
  if (part === "head") return <HeadPick rows={rows ?? []} />;
  if (part === "row" || part === "card") return row ? <RowPick row={row} layout={part} /> : null;
  if (part === "tool") return <AllButton />;
  if (part === "band") return <Band at={at ?? "table"} rows={rows ?? []} />;
  return null;
}

function HeadPick({ rows }: { rows: readonly QueueRow[] }): ReactNode {
  const { picked, setAll } = useBulkPick();
  const ref = useRef<HTMLInputElement>(null);
  const pickable = rows.filter(isPickable);
  const all = pickable.length > 0 && pickable.slice(0, BULK_LIMIT).every((r) => picked.includes(r.id));
  const some = picked.length > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="k-more-pick"
      aria-label={PICK_ALL_LABEL}
      checked={all}
      disabled={pickable.length === 0}
      onChange={(e) => setAll(rows, e.currentTarget.checked)}
    />
  );
}

function RowPick({ row, layout }: { row: QueueRow; layout: "row" | "card" }): ReactNode {
  const { picked, toggle } = useBulkPick();
  if (!isPickable(row)) {
    if (layout === "card") return <span className="k-hnd-mcard-num">{row.ticket_number}</span>;
    return (
      <span className="k-ap-dash" title={ONE_BY_ONE_TITLE}>
        —
      </span>
    );
  }
  const on = picked.includes(row.id);
  const asRow = layout === "row";
  const full = !on && picked.length >= BULK_LIMIT;
  const box = (
    <input
      type="checkbox"
      className={asRow ? "k-more-pick" : undefined}
      aria-label={pickLabel(row.ticket_number)}
      checked={on}
      disabled={full}
      {...(full ? { title: LIMIT_TITLE } : {})}
      onChange={(e) => toggle(row.id, e.currentTarget.checked)}
    />
  );
  if (layout === "row") return box;
  // カード：下絵の Choice（四角と番号の 1 行・more.css の .k-more-choice で印と字の中心をそろえる）
  return (
    <label className="k-dialog-check k-more-choice k-more-mcard-pick">
      {box}
      <span className="k-hnd-mcard-num">{row.ticket_number}</span>
    </label>
  );
}

function AllButton(): ReactNode {
  const { reading, flow } = useBulkState();
  const preview = useBulkPreview();
  return (
    <Button variant="outlined" size="sm" disabled={reading || flow !== null} onClick={() => void preview("all", [])}>
      {ALL_LABEL}
    </Button>
  );
}

function Band({ at, rows }: { at: "table" | "mobile"; rows: readonly QueueRow[] }): ReactNode {
  const { picked, prune } = useBulkPick();
  const { reading, flow, note } = useBulkState();
  const preview = useBulkPreview();
  const { approve, cancel } = useBulkApprove();
  useEffect(() => {
    prune(rows);
  }, [rows, prune]);
  const bar =
    picked.length > 0 ? (
      <div className="k-more-bulkbar" data-at={at} role="region" aria-label={BAR_REGION}>
        <p>{pickedText(picked.length)}</p>
        <Button
          size="sm"
          disabled={reading || flow !== null}
          onClick={() => void preview("selected", inListOrder(rows, picked))}
        >
          {PICKED_LABEL}
        </Button>
      </div>
    ) : null;
  if (at === "table") return bar;
  return (
    <>
      {note ? (
        <div className="k-more-bulk-note">
          <Callout tone={note.tone}>{note.text}</Callout>
        </div>
      ) : null}
      {bar}
      {flow ? (
        <BulkApproveConfirm
          scope={flow.scope}
          preview={flow.preview}
          busy={flow.busy}
          error={flow.error}
          onConfirm={() => void approve()}
          onCancel={cancel}
        />
      ) : null}
    </>
  );
}
