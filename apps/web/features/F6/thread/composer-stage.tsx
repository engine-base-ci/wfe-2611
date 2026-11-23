"use client";
// 書く欄の「状態 ▾」の入れ物（K-393 が器の口 useComposerStage を置き、中身は K-396 が作る）。口は呼ばない（書く器 use-post.ts が送る前に fields()、
//   422 の段の項目は setErrors、届いたら afterPost と reset、409 なら afterPost だけを呼ぶ）。見た目は部品 views.tsx の StageSelect・HoldFields に値と押す関数を渡すだけ。
//   選ぶ物は 変えない（既定）・未着手・作業中・保留…（完了は出さない・頭の札の K-395 から）。今の段の項目は押せない形。
//   押せない形（「状態 変えない（変えられません）」）にするのは、詳細の答えの can.progress が false のとき・仕組みの段のとき・段が完了のとき。
//   保留…を選んだら書く欄の中に保留の理由と再開の条件（確かめと文は K-395 の progress/hold-fields.ts）。段を送ったときだけ、届いた後と 409 の後に詳細を読み直す
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { checkHold, holdErrorsOf, type HoldErrors } from "@/features/F6/progress/hold-fields";
import { LOCKED_STAGES, progressOf } from "@/features/F6/progress/progress-detail";
import { HoldFields, StageSelect, type StageChoice } from "./views";

export type StageFields = { ok: true; body: Record<string, unknown> } | { ok: false };

export interface ComposerStageState {
  /** 部品の stageSlot に置く物 */
  slot: ReactNode;
  /** 部品の holdSlot に置く物（保留の 2 つの欄） */
  holdSlot: ReactNode | null;
  /** 送る前に段の欄を集める（ok でなければ送らない） */
  fields(): StageFields;
  /** 口が返した段の項目の理由（hold_reason・resume_condition・stage_key） */
  setErrors(fields: Record<string, string>): void;
  /** 書けた・断られた（409）後に詳細を読み直す */
  afterPost(): Promise<void>;
  /** 書けた後に段の選びを戻す */
  reset(): void;
}

const KEEP: StageChoice = "変えない";
const HOLD: StageChoice = "保留…";
/** 選ぶ物 → 書く口の段の鍵（K-389） */
const KEY_OF: Record<Exclude<StageChoice, "変えない">, string> = { 未着手: "todo", 作業中: "doing", "保留…": "hold" };
/** 今の段の鍵 → 押せない選ぶ物（会社が足した段は何も押せなくしない） */
const CURRENT_OF: Record<string, StageChoice> = { todo: "未着手", doing: "作業中", hold: "保留…" };
const DONE = "done";

export function useComposerStage(ticket: SlotTicket): ComposerStageState {
  const v = progressOf(ticket.detail);
  const locked = !v.canProgress || v.stageKey === DONE || (v.stageKey !== null && LOCKED_STAGES.has(v.stageKey));
  const current = v.stageKey ? CURRENT_OF[v.stageKey] : undefined;
  const [choice, setChoice] = useState<StageChoice>(KEEP);
  const [reason, setReason] = useState("");
  const [resume, setResume] = useState("");
  const [errors, setHoldErrors] = useState<HoldErrors | undefined>(undefined);
  /** 段の欄を送った（届いた後・409 の後に詳細を読み直す） */
  const sentStage = useRef(false);

  // 読み直して押せなくなったら、選んだ段を「変えない」に戻す（保留の欄の字は残す）
  useEffect(() => {
    if (locked) setChoice(KEEP);
  }, [locked]);

  const pick = (c: StageChoice) => {
    if (c === current) return; // 今の段は選んでも何も変わらない
    setHoldErrors(undefined);
    setChoice(c);
  };

  const fields = (): StageFields => {
    sentStage.current = false;
    if (locked || choice === KEEP) return { ok: true, body: {} };
    if (choice !== HOLD) {
      sentStage.current = true;
      return { ok: true, body: { stage_key: KEY_OF[choice] } };
    }
    const check = checkHold(reason, resume);
    if (!check.ok) {
      setHoldErrors(check.errors);
      return { ok: false };
    }
    setHoldErrors(undefined);
    sentStage.current = true;
    return { ok: true, body: { stage_key: KEY_OF[HOLD], ...check.body } };
  };

  const setErrors = (f: Record<string, string>) => {
    const hold = holdErrorsOf(Object.entries(f).map(([field, message]) => ({ field, message })));
    if (hold.reason !== undefined || hold.resume !== undefined) setHoldErrors(hold);
  };

  const reload = ticket.reload;
  const afterPost = useCallback(async () => {
    if (!sentStage.current) return;
    sentStage.current = false;
    await reload();
  }, [reload]);

  const reset = () => {
    setChoice(KEEP);
    setReason("");
    setResume("");
    setHoldErrors(undefined);
  };

  const slot = locked ? (
    <StageSelect stage={KEEP} locked />
  ) : (
    <StageSelect stage={choice} onPick={pick} {...(current ? { disabledChoices: [current] } : {})} />
  );
  const holdSlot =
    !locked && choice === HOLD ? (
      <HoldFields
        reason={reason}
        resume={resume}
        onReason={setReason}
        onResume={setResume}
        {...(errors ? { errors } : {})}
      />
    ) : null;

  return { slot, holdSlot, fields, setErrors, afterPost, reset };
}

export function ComposerStage(_props: { ticket: SlotTicket }): null {
  void _props;
  return null;
}
