"use client";
// 段 7 の決定ログの見た目の部品：本文の中の区画（一覧・空・読めない）と、決定にする／足す／改める小窓・取り消す確かめ。下絵（K-66 の切る段・/dev/mock/f6）で並べる。
//   口はまだつながない（読む・足す・改める・取り消す口は K-390・K-391、画面の結線は K-397・K-398）。ここは値を受け取って描くだけ。
//   代表の答え（2026-11-20）：⑯ 段 7 は人が書く所まで（AI の案の欄と本文を直す案はグレーで出す）／⑰ 取り消しは印と理由を付けて残す（消さない）／
//   ⑱ 決めた人は既定が本人・ほかの人とひとことを選べる／⑲ 担当者と承認する人に知らせ、やり取りにも 1 行／⑳ 作るときに書いた字は上に残し、下に一覧
//   取引先のルールにする（段 12）は押せない形（D-145.9）
import type { ReactNode } from "react";
import { Button, Callout, Confirm, Dialog, Radio, RadioGroup, Select, TextArea, TextField } from "@/components/k";
import "./decisions.css";

export interface DecisionView {
  id: string;
  text: string;
  /** 「11/01 鈴木 一郎（先方と合意）」 */
  by: string;
  reason?: string;
  /** 元の書き込み（「やり取り 11/01 10:20」） */
  source?: string;
  status: "live" | "revised" | "cancelled";
  /** 改められた・取り消した・改めた元の注（「新しい決定：…」「取り消し 10/22 佐藤：…」「10/28 の決定を改めた」） */
  note?: string;
  /** 「改めた」の札（この決定が前の決定を改めた） */
  revises?: boolean;
}

export interface DecisionLogProps {
  /** 作るときに「決定ログ」の欄に書いた字（⑳：上に残す） */
  intro?: string;
  items: readonly DecisionView[];
  canWrite: boolean;
  failed?: boolean;
}

/** 本文の中の決定ログの区画。見出しの数は生きている決定の数 */
export function DecisionLog({ intro, items, canWrite, failed }: DecisionLogProps) {
  const live = items.filter((d) => d.status === "live").length;
  return (
    <section className="k-section" aria-labelledby="sec-decisions">
      <div className="k-dec-head">
        <h2 id="sec-decisions">{live ? `決定ログ（${live}）` : "決定ログ"}</h2>
        {canWrite && !failed ? (
          <Button variant="outlined" size="sm">
            ＋ 決定を足す
          </Button>
        ) : null}
      </div>
      {intro ? <p className="k-dec-intro">作るときに書いた字：{intro}</p> : null}
      {failed ? (
        <Callout tone="danger">
          決定を読み込めませんでした{" "}
          <Button variant="outlined" size="sm">
            もう一度読む
          </Button>
        </Callout>
      ) : items.length === 0 ? (
        <p className="k-dec-empty">まだ決定はありません。決めたことと理由を残すと、あとから根拠として引けます</p>
      ) : (
        <ol className="k-dec-list">
          {items.map((d) => (
            <li key={d.id} className="k-dec-item" data-status={d.status}>
              <span className="k-dec-text">{d.text}</span>
              {d.status === "revised" ? <span className="k-dec-tag">改められた</span> : null}
              {d.status === "cancelled" ? <span className="k-dec-tag">取り消した</span> : null}
              {d.revises ? <span className="k-dec-tag">改めた</span> : null}
              <div className="k-dec-sub">
                {d.by}
                {d.reason ? ` ・ 理由：${d.reason}` : ""}
                {d.source ? ` ・ 元：${d.source} →` : ""}
                {d.note ? ` ・ ${d.note}` : ""}
              </div>
              {canWrite && d.status === "live" ? (
                <div className="k-dec-acts">
                  <Button variant="ghost" size="sm">
                    改める
                  </Button>
                  <Button variant="ghost" size="sm">
                    取り消す
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const PEOPLE = [
  { value: "me", label: "高本 聖斗" },
  { value: "suzuki", label: "鈴木 一郎" },
  { value: "sato", label: "佐藤 花子" },
];

export interface DecisionDialogProps {
  open: boolean;
  /** 書き込みから決定にする（元の書き込みの箱を出す）か、直接書くか */
  from?: { who: string; time: string; text: string };
  text?: string;
  by?: string;
  byNote?: string;
  reason?: string;
  errors?: { text?: string };
}

/** 決定にする（書き込みから）／決定を足す（直接書く）小窓。AI の案の欄・取引先のルール・本文を直す案はグレー */
export function DecisionDialog({
  open,
  from,
  text = "",
  by = "me",
  byNote = "",
  reason = "",
  errors,
}: DecisionDialogProps) {
  const title = from ? "決定にする" : "決定を足す";
  return (
    <Dialog
      open={open}
      title={title}
      {...(from ? { subtitle: "書き込みを決定ログに残す。あとから根拠として引ける" } : {})}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>{title}</Button>
        </>
      }
    >
      {from ? (
        <blockquote className="k-dec-source">
          <b>{from.who}</b> <span className="k-dec-sub">{from.time}</span>
          <br />
          {from.text}
        </blockquote>
      ) : null}
      <TextArea label="決めたこと" name="decision_text" required defaultValue={text} rows={2} error={errors?.text} />
      <div className="k-dec-inert" aria-disabled="true">
        AI が一文にまとめた案 ── AI の案は、自分の AI と話す画面ができてから使えます
      </div>
      <Select label="決めた人" name="decided_by" options={PEOPLE} defaultValue={by} />
      <TextField label="ひとこと" name="decided_note" defaultValue={byNote} placeholder="例：先方と合意" />
      <TextField label="理由" name="decision_reason" defaultValue={reason} />
      <RadioGroup className="k-dec-scope" legend="どこまで効かせる" name="decision_scope" defaultValue="ticket">
        <Radio value="ticket">このチケットだけ</Radio>
        <Radio value="client" disabled title="取引先の画面ができてから使えます">
          取引先のこれから（取引先のルールにする）
        </Radio>
      </RadioGroup>
      {from ? (
        <div className="k-dec-inert" aria-disabled="true">
          本文と食い違う所を AI が見つけて、直す案を出す（まだ使えません）
        </div>
      ) : null}
    </Dialog>
  );
}

export interface ReviseDialogProps {
  open: boolean;
  prev: { by: string; text: string };
  text?: string;
  reason?: string;
  /** 同時にほかの人が改めていた（書いた字は閉じるまで残す） */
  conflict?: boolean;
}

/** 決定を改める小窓（前の決定は消えず「改められた」の印） */
export function ReviseDialog({ open, prev, text = "", reason = "", conflict }: ReviseDialogProps) {
  const foot: ReactNode = conflict ? (
    <Button variant="outlined">閉じて読み直す</Button>
  ) : (
    <>
      <Button variant="outlined">やめる</Button>
      <Button>改める</Button>
    </>
  );
  return (
    <Dialog open={open} title="決定を改める" subtitle="前の決定は消えず、「改められた」の印が付きます" actions={foot}>
      {conflict ? (
        <Callout tone="danger">この決定は、いま別の人が改めました。読み直してから、もう一度お試しください</Callout>
      ) : null}
      <blockquote className="k-dec-source">
        <span className="k-dec-sub">前の決定（{prev.by}）</span>
        <br />
        {prev.text}
      </blockquote>
      <TextArea label="新しい決定" name="decision_text" required defaultValue={text} rows={2} />
      <TextField label="改める理由" name="decision_reason" defaultValue={reason} />
    </Dialog>
  );
}

/** 決定を取り消す確かめ（⑰：取り消した印と理由を残す・消さない） */
export function CancelDecisionConfirm({ open, text, error }: { open: boolean; text: string; error?: string }) {
  return (
    <Confirm
      open={open}
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
      title="この決定を取り消しますか？"
      description="取り消した印と理由が残ります（消えません）"
      confirmLabel="取り消す"
    >
      <blockquote className="k-dec-source">{text}</blockquote>
      <TextArea label="取り消す理由" name="cancel_reason" required rows={2} error={error} />
    </Confirm>
  );
}
