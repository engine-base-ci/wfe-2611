"use client";
// 承認待ちのカード（K-231・キャンバス Approvals）：道具の行・表 1 つ（期限の区切りは表の中の行）・下の注記。
//   キャンバスに在ってまだ使えない物（絞り込みの札 6 つ・まとめて承認・決めた履歴・選ぶのチェック）は出し、押せない（D-145.9）。
//   本当の値が無い字は空（種別：口がチケットの種別を返さない・期限なし）。札の件数は「すべて」だけ（種類ごとの数を返す口が無い）。
//   区切りの名前と並びは前からの決め（D-128.36）。名前と件数は別の span（ちょうどの字で探す前からの試験とぶつけない）
//   行の 1 つずつは段 9 の差し込み口 F8.QueueRowSlot で包む（K-380。渡された行は K-412 の queue-row-pass.tsx が描く）
//   幅 767 以下は表を隠し、表の後ろの 1 件 1 枚のカード（queue-card.tsx・K-412・D-148.26）を出す。小さな知らせの置き場は queue.tsx
//   段 6 の画面の葉の差し込み口（K-730・features/F5/more/slots.tsx）：札と並べ替え＝QueueToolsSlot・まとめて承認の四角とボタンと表の上＝QueueBulkSlot・
//   ［決めた履歴］＝QueueHistorySlot・「確認」のセル＝QueueCheckCellSlot（最初はどれも今と同じ物を返す）
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/k";
import { QueueBulkSlot, QueueCheckCellSlot, QueueHistorySlot, QueueToolsSlot } from "@/features/F5/more/slots";
import * as F8 from "@/features/F8/handover/detail-slots";
import { DUE_GROUPS, dueGroupOf, jstDay, type DueGroup } from "./due";
import type { QueueRow } from "./queue";
import { QueueCards } from "./queue-card";

const KIND_LABEL: Record<string, string> = { artifact: "AI の成果物" };
const HEADERS = ["決めること", "種別", "番号", "題名", "誰から", "確認", "期限"] as const;
const NOTE =
  "— は 1 件ずつ中身を見て決めるもの（取り消せない操作・あなたが見る項目がある）。押すとチケットの詳細の承認の帯へ";
/** 区切りの名前と件数の間（キャンバスの全角の空白） */
const GAP = "\u3000";
const RED_GROUPS: ReadonlySet<DueGroup> = new Set(["期限切れ"]);

export interface RowActs {
  busy: string | null;
  onApprove: (row: QueueRow) => void;
  onReturn: (row: QueueRow) => void;
}

export function QueueCard({ rows, total, acts }: { rows: QueueRow[]; total: number; acts: RowActs }) {
  const groups = DUE_GROUPS.map((g) => [g, rows.filter((r) => dueGroupOf(r.due_on) === g)] as const).filter(
    ([, rs]) => rs.length > 0,
  );
  return (
    <>
      {/* 選んだ N 件の帯は一覧の箱の上（下絵 bulk-select・K-769） */}
      <QueueBulkSlot part="band" at="table" rows={rows} total={total} />
      <section className="k-ap-card k-hnd-q-table" aria-label="承認待ちの一覧">
        <Tools total={total} />
        <div className="k-ap-scroll">
          <table className="k-ap-table">
            <thead>
              <tr>
                <th scope="col">
                  <QueueBulkSlot part="head" rows={rows} total={total} />
                </th>
                {HEADERS.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
                <th scope="col" className="k-ap-end">
                  その場で決める
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([g, rs]) => (
                <Fragment key={g}>
                  <tr className="k-ap-group" data-alert={RED_GROUPS.has(g) || undefined}>
                    <td colSpan={9}>
                      <span>{g}</span>
                      {GAP}
                      <span>{rs.length} 件</span>
                    </td>
                  </tr>
                  {rs.map((r) => (
                    <F8.QueueRowSlot key={r.id} row={r} acts={acts}>
                      <Row row={r} acts={acts} />
                    </F8.QueueRowSlot>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="k-ap-note">{NOTE}</p>
      </section>
      <QueueCards rows={groups.flatMap(([, rs]) => rs)} total={total} acts={acts} />
      {/* スマホのまとめて承認の帯はカードの後ろ（表の区画は幅 767 以下で隠れるので、その外に置く・answer=0050b3906ae6） */}
      <QueueBulkSlot part="band" at="mobile" rows={rows} total={total} />
    </>
  );
}

function Tools({ total }: { total: number }) {
  return (
    <div className="k-ap-tools">
      <QueueToolsSlot
        total={total}
        layout="table"
        end={
          <>
            <QueueBulkSlot part="tool" total={total} />
            <QueueHistorySlot where="tools" />
          </>
        }
      />
    </div>
  );
}

function Row({ row, acts }: { row: QueueRow; acts: RowActs }) {
  const href = `/tickets/${row.ticket_id}`;
  const kind = KIND_LABEL[row.kind];
  return (
    <tr>
      <td>
        <QueueBulkSlot part="row" row={row} />
      </td>
      <td>{kind ? <span className="k-ap-kind">{kind}</span> : null}</td>
      <td />
      <td>
        <a className="k-link k-ap-num" href={href}>
          {row.ticket_number}
        </a>
      </td>
      <td className="k-ap-title">
        <a href={href}>{row.title}</a>
        {row.note ? <span className="k-ap-sub">{row.note}</span> : null}
      </td>
      <td>
        <span className="k-ap-from">
          <span className="k-ap-avatar" aria-hidden="true">
            AI
          </span>
          {`${row.from_name ?? "自分"}のAI`}
        </span>
      </td>
      <td className="k-ap-check">
        <QueueCheckCellSlot row={row} layout="table" />
      </td>
      <Due due={row.due_on} />
      <td className="k-ap-end">
        <Acts row={row} acts={acts} href={href} />
      </td>
    </tr>
  );
}

/** 期限：今日は「MM/DD（今日）」・過ぎたら赤・期限なしは空（日本時間） */
function Due({ due }: { due: string | null }): ReactNode {
  if (!due) return <td />;
  const md = `${due.slice(5, 7)}/${due.slice(8, 10)}`;
  const today = jstDay(0);
  if (due === today) return <td>{`${md}（今日）`}</td>;
  return <td data-late={due < today || undefined}>{md}</td>;
}

/** 行のボタン：左に従（差し戻す）・右に主（取り消せる行は承認する＝確かめの小窓・ほかは中身を見る） */
function Acts({ row, acts, href }: { row: QueueRow; acts: RowActs; href: string }) {
  const { busy, onApprove, onReturn } = acts;
  return (
    <span className="k-ap-acts">
      <Button size="sm" variant="outlined" disabled={busy === row.id} onClick={() => onReturn(row)}>
        差し戻す
      </Button>
      {row.decide_inline ? (
        <Button size="sm" loading={busy === row.id} disabled={busy !== null} onClick={() => onApprove(row)}>
          承認する
        </Button>
      ) : (
        <a className="k-btn" data-variant="primary" data-size="sm" href={href}>
          中身を見る
        </a>
      )}
    </span>
  );
}
