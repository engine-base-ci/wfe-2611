"use client";
// 期限の欄（K-444・作る面の本物）。項目の表の「期限」の行（K-442 の DueSlot の先 create-slot.tsx）に置く。
//   欄は日付の入力（直に打てる・読み上げの名前「期限」）と右の「期限の早見」。早見を押すと小窓「期限を決める」（mode create）が開く。
//   どちらで入れても同じ値（onChange(YYYY-MM-DD)）で作る面の下書きへ返す。口は呼ばない（日付を渡すだけ）。
//   今日は日本時間の日付で、小窓を開くたび・打つたびに数える（開いたまま日が替わっても、口が最後の砦）。
//   今日より前の日：小窓では選べない（押すと正本 E-VAL-012 の文を日付の下に赤く出す）。欄に打ったら欄の下に同じ文（口へは送らない）。
//   値が今日より前（下書きから戻した過去の期限）なら、小窓は今月・選ばれた日なしで、赤い理由を最初から出して選び直す形で開く。
//   作る口の断り（E-VAL-012・028）は K-442 の placeCreateError が error で渡す
import { useState } from "react";
import { errorText } from "@/components/k/error-of";
import { todayJst } from "../create-ticket/detail-head";
import { DueDialog, DueField as DueFieldView } from "./views";

export interface DueFieldProps {
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
}

/** 小窓の中身（開くたびに作り直す）。月は YYYY-MM・選ぶ日は決めるまで無い */
interface DialogView {
  open: boolean;
  today: string;
  month: string;
  selected: string | null;
  dateError: string | undefined;
}

const pastText = (): string => errorText("E-VAL-012").entry.message;

/** 開くときの中身：値が今日以降ならその月・その日に印／値が無いか過去なら今月・選ばれた日なし（過去なら赤い理由つき） */
function openedView(value: string): DialogView {
  const today = todayJst();
  const past = value !== "" && value < today;
  const keep = value !== "" && !past;
  return {
    open: true,
    today,
    month: (keep ? value : today).slice(0, 7),
    selected: keep ? value : null,
    dateError: past ? pastText() : undefined,
  };
}

const CLOSED: DialogView = { open: false, today: "", month: "", selected: null, dateError: undefined };

export function DueField({ value, onChange, error }: DueFieldProps) {
  const [view, setView] = useState<DialogView>(CLOSED);
  /** 欄に打った日が今日より前のときの理由（手元の確かめ。打ち直すか小窓で決めると消える） */
  const [typedPast, setTypedPast] = useState<string | undefined>(undefined);
  const close = () => setView((v) => ({ ...v, open: false }));
  const confirm = () => {
    if (!view.selected) return;
    setTypedPast(undefined);
    onChange(view.selected);
    close();
  };
  const type = (ymd: string) => {
    setTypedPast(ymd !== "" && ymd < todayJst() ? pastText() : undefined);
    onChange(ymd);
  };
  const shown = error ?? typedPast;
  return (
    <>
      <DueFieldView
        bare
        value={value || null}
        {...(shown ? { error: shown } : {})}
        onType={type}
        onOpen={() => setView(openedView(value))}
      />
      <DueDialog
        open={view.open}
        mode="create"
        today={view.today}
        month={view.month}
        selected={view.selected}
        {...(view.dateError ? { dateError: view.dateError } : {})}
        onPick={(ymd) => setView((v) => ({ ...v, selected: ymd, dateError: undefined }))}
        onPast={() => setView((v) => ({ ...v, dateError: pastText() }))}
        onMonth={(month) => setView((v) => ({ ...v, month }))}
        onClose={close}
        onConfirm={confirm}
      />
    </>
  );
}
