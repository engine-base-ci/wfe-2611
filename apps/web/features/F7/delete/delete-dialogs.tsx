"use client";
// 消す前の確認の小窓 2 つ（F7・段 8・A116）。口とはまだつながず、値と押した結果を props で受けて描くだけ。
//   DeletePreview … 子・孫が無いチケット（キャンバス TdDelete）。DeleteChildrenDialog … 子・孫がいる親（3 択・D-125.62・字は案）。
//   口が断ったときは小窓の上の橙の箱（権限が無い・同時に直された。書いた理由は消さない）。消せない人には「消す」を押せない形で出す
import type { ReactNode } from "react";
import { Button, Callout, Dialog, NoticeBox } from "@/components/k";
import "@/features/F4/create-ticket/create-ticket.css";
import { DeleteBody, type ChildChoice, type DeletePreviewData } from "./delete-body";
import "./delete.css";

const noop = () => undefined;

interface Common {
  open: boolean;
  data: DeletePreviewData;
  reason: string;
  /** 口が断った・失敗した（書いた中身は消さない） */
  notice?: string | undefined;
  /** 箱の色：断り＝warn（既定）・送れない＝danger */
  noticeTone?: "warn" | "danger" | undefined;
  busy?: boolean;
  onReasonChange?: ((v: string) => void) | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  onConfirm?: (() => void) | undefined;
}

function Actions({
  busy,
  disabled,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <Button variant="outlined" disabled={busy} onClick={onCancel}>
        やめる
      </Button>
      <Button
        variant="danger"
        loading={busy}
        {...(disabled ? { "aria-disabled": true, tabIndex: -1 } : { onClick: onConfirm })}
      >
        消す
      </Button>
    </>
  );
}

/** 消す前の確認（子・孫が無いとき） */
export function DeletePreview({
  open,
  data,
  reason,
  notice,
  noticeTone = "warn",
  busy = false,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: Common) {
  return (
    <Dialog
      title="このチケットを消しますか"
      open={open}
      onOpenChange={(o) => onOpenChange?.(o)}
      target={`${data.number} ${data.title}`}
      actions={
        <Actions busy={busy} disabled={false} onCancel={() => onOpenChange?.(false)} onConfirm={onConfirm ?? noop} />
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox tone={noticeTone}>{notice}</NoticeBox> : null}
        <DeleteBody data={data} reason={reason} onReasonChange={onReasonChange} />
      </div>
    </Dialog>
  );
}

const CHOICES: readonly { key: ChildChoice; label: string; sub: (d: DeletePreviewData) => string }[] = [
  {
    key: "move",
    label: "別の親へ移す",
    sub: (d) =>
      `子チケット ${d.children} 件${d.grandchildren ? `・孫 ${d.grandchildren} 件` : ""}を、選んだ親の下へ移します`,
  },
  {
    key: "cascade",
    label: "一緒に消す",
    sub: (d) => `子チケット ${d.children} 件${d.grandchildren ? `・孫 ${d.grandchildren} 件` : ""}も一緒に消えます`,
  },
  {
    key: "detach",
    label: "親を外して単体にする",
    sub: (d) => `子チケット ${d.children} 件は親なしのチケットとして残ります。孫は子の下のままです`,
  },
];

export interface DeleteChildrenProps extends Common {
  choice: ChildChoice;
  /** 「別の親へ移す」で選んだ親（親を探す欄に出す字。選んでいなければ無し） */
  parent?: { number: string; title: string } | undefined;
  /** 親を探す欄そのもの。本番は前からの F4 の ParentPicker を渡す。無ければ同じ形の欄を描く（口は呼ばない） */
  parentField?: ReactNode;
  /** 移す先を選んでいないときの赤い字（親を探す欄の下） */
  parentError?: string | undefined;
  /** 親を探す欄（parentField）で移す先を選んだか（parent を渡さないときに「消す」を押せる形にする） */
  parentChosen?: boolean | undefined;
  onChoice?: ((c: ChildChoice) => void) | undefined;
}

/** 前からの ParentPicker（features/F4/create-ticket/parent-picker.tsx）と同じ並びと字の欄。描くだけ */
function ParentField({ parent }: { parent: { number: string; title: string } | undefined }) {
  return (
    <div className="k-create-assign-row">
      <div className="k-field">
        <label className="k-label" htmlFor="del-parent-in">
          親のチケット
        </label>
        <div className="k-create-parent">
          <input
            id="del-parent-in"
            className="k-input"
            role="combobox"
            name="parent_ticket"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={false}
            placeholder="番号か題名で探す"
            readOnly
            value={parent ? `${parent.number} ${parent.title}` : ""}
          />
        </div>
      </div>
      {parent ? (
        <Button variant="ghost" size="sm">
          親を外す
        </Button>
      ) : null}
    </div>
  );
}

/** 子・孫がいる親を消す（別の親へ移す・一緒に消す・親を外して単体にする を選ぶ段） */
export function DeleteChildrenDialog({
  open,
  data,
  choice,
  parent,
  parentField,
  parentError,
  parentChosen = false,
  reason,
  notice,
  noticeTone = "warn",
  busy = false,
  onChoice,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: DeleteChildrenProps) {
  const parentLabel = parent ? `${parent.number} ${parent.title}` : undefined;
  const needParent = choice === "move" && !parent && !parentChosen;
  return (
    <Dialog
      title="このチケットを消しますか"
      open={open}
      onOpenChange={(o) => onOpenChange?.(o)}
      target={`${data.number} ${data.title}`}
      actions={
        <Actions
          busy={busy}
          disabled={needParent}
          onCancel={() => onOpenChange?.(false)}
          onConfirm={onConfirm ?? noop}
        />
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox tone={noticeTone}>{notice}</NoticeBox> : null}
        <Callout tone="info">
          {`このチケットには子チケット ${data.children} 件${data.grandchildren ? `・孫 ${data.grandchildren} 件` : ""}があります。どう扱うか選んでください`}
        </Callout>
        <fieldset className="k-dialog-group k-f7-del-choices">
          <legend>子・孫の扱い</legend>
          {CHOICES.map((c) => (
            <label key={c.key} className="k-dialog-check k-f7-del-choice">
              <input type="radio" name="del-children" checked={choice === c.key} onChange={() => onChoice?.(c.key)} />
              <span className="k-f7-del-choice-text">
                <b>{c.label}</b>
                <span className="k-f7-del-sub">{c.sub(data)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {choice === "move" ? (parentField ?? <ParentField parent={parent} />) : null}
        {parentError ? (
          <p className="k-err" role="alert">
            {parentError}
          </p>
        ) : null}
        <DeleteBody data={data} choice={choice} parent={parentLabel} reason={reason} onReasonChange={onReasonChange} />
      </div>
    </Dialog>
  );
}

export interface DeleteRefusedProps {
  open: boolean;
  /** 対象の行（「EG-128 セイコー様へ…」） */
  target: string;
  /** 断りの文（正本の字） */
  notice: string;
  /** 消せない人＝warn・下見が読めない＝danger */
  tone: "warn" | "danger";
  onOpenChange?: ((open: boolean) => void) | undefined;
}

/** 下見の口が断った・読めなかったときの小窓（断りの箱と「やめる」だけ。一緒に起きること・理由・「消す」は出さない） */
export function DeleteRefused({ open, target, notice, tone, onOpenChange }: DeleteRefusedProps) {
  return (
    <Dialog
      title="このチケットを消しますか"
      open={open}
      onOpenChange={(o) => onOpenChange?.(o)}
      target={target}
      actions={
        <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
          やめる
        </Button>
      }
    >
      <div className="k-dialog-stack">
        <NoticeBox tone={tone}>{notice}</NoticeBox>
      </div>
    </Dialog>
  );
}
