"use client";
// 期限を動かす確かめの小窓（キャンバス GtMove・K-482・D-151.11・D-151.12）。ガントで棒を動かしたとき・日の小窓から動かしたときに開く。
//   理由は必須（欄の名前は「理由」・やり取りに残り、担当者に知らせる）。親の期限に収まるかは本当に確かめる（収まらないと「にする」は押せない・D-128.65）。
//   「あとに続くもの」の行と「あとに続くものも動かす」は押せない形（つながりに「続く」が無い・D-151.12）。「土日を飛ばす」は土日だけ。
//   形は共通の小窓（components/k の Dialog）。値は全部 props（日付の計算は葉が決める）。
//   動き（K-482）：理由・土日のチェックは on… で画面に渡す（渡さなければ下絵のまま）。口が断った字は小窓の上の role=alert（notice）。
//   送っている間（busy）は「にする」を押せない形にし、Esc・× でも閉じない
import type { ChangeEvent } from "react";
import { Button, Dialog, TextArea } from "@/components/k";
import "../overview/tones.css";
import "./gantt.css";

export interface MoveFollower {
  text: string;
}

export interface MoveImpactDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  ticket: { number: string; title: string };
  /** 「11/05（木）」 */
  from: string;
  to: string;
  /** 「3 日後ろへ」 */
  shift: string;
  /** 親の期限の確かめ（親が無いときは出さない） */
  parent?: { number: string; due: string; fits: boolean };
  /** あとに続くもの（押せない形で並べる） */
  followers: readonly MoveFollower[];
  /** 「あとに続く EG-129 も 3 日ずらす」の行（押せない形） */
  followLabel: string;
  followNote: string;
  /** 土日を飛ばす */
  weekend: { checked: boolean; note: string };
  /** 担当者の名前（「担当の〇〇さんに知らせる」） */
  owner: string;
  reason: string;
  reasonError?: string | null;
  /** 決める日の字（「11/09 にする」の 11/09） */
  confirmDate: string;
  /** 「あとに続くものも動かす」のチェック（押せない形・既定は付いた見本の形） */
  followChecked?: boolean;
  /** 口が断った字（小窓の上の赤い箱） */
  notice?: string | null;
  busy?: boolean;
  onReason?: (text: string) => void;
  onWeekend?: (checked: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function MoveImpactDialog(p: MoveImpactDialogProps) {
  const blocked = p.parent ? !p.parent.fits : false;
  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => {
        if (!o && p.busy) return;
        p.onOpenChange?.(o);
        if (!o) p.onCancel?.();
      }}
      title="期限を動かしますか"
      target={`${p.ticket.number} ${p.ticket.title}`}
      actions={
        <>
          <Button variant="outlined" disabled={p.busy ?? false} onClick={p.onCancel}>
            やめる（元に戻す）
          </Button>
          <Button disabled={blocked || (p.busy ?? false)} onClick={p.onConfirm}>
            {p.confirmDate} にする
          </Button>
        </>
      }
    >
      {p.notice ? (
        <p className="k-err" role="alert">
          {p.notice}
        </p>
      ) : null}
      <div className="k-f7-gantt-move-dates">
        <span className="k-list-dim">期限</span>
        <b>{p.from}</b>
        <span aria-hidden="true">→</span>
        <b>{p.to}</b>
        <span className="k-list-dim">{p.shift}</span>
      </div>
      {p.parent ? (
        <p className="k-f7-gantt-move-parent" data-fits={p.parent.fits}>
          {p.parent.fits
            ? `親 ${p.parent.number} の期限 ${p.parent.due} には収まる`
            : `親 ${p.parent.number} の期限 ${p.parent.due} を過ぎるので、動かせません`}
        </p>
      ) : null}
      <div className="k-f7-gantt-move-follow" aria-disabled="true" title="あとに続くもの（準備中）">
        <b>あとに続くものにかかる</b>
        {p.followers.map((f) => (
          <span key={f.text}>{f.text}</span>
        ))}
      </div>
      <div className="k-f7-gantt-move-checks">
        <label className="k-f7-gantt-move-check" aria-disabled="true" title="あとに続くものも動かす（準備中）">
          <input type="checkbox" disabled checked={p.followChecked ?? true} readOnly />
          <span>
            {p.followLabel}
            <span className="k-list-dim">{p.followNote}</span>
          </span>
        </label>
        <label className="k-f7-gantt-move-check">
          {p.onWeekend ? (
            <input type="checkbox" checked={p.weekend.checked} onChange={(e) => p.onWeekend?.(e.target.checked)} />
          ) : (
            <input type="checkbox" defaultChecked={p.weekend.checked} />
          )}
          <span>
            土日を飛ばす
            <span className="k-list-dim">{p.weekend.note}</span>
          </span>
        </label>
      </div>
      <TextArea
        name="reason"
        label="理由"
        required
        hint={`やり取りに残り、担当の${p.owner}さんに知らせる`}
        {...(p.onReason
          ? { value: p.reason, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => p.onReason?.(e.target.value) }
          : { defaultValue: p.reason })}
        error={p.reasonError ?? null}
        rows={2}
      />
    </Dialog>
  );
}
