"use client";
// 確認項目の行（K-450・下絵 f4v2-specs・f4v2-spec-edit・f4v2-create-specs）。箱＋文＋「外す」。見た目は features/F4/doc/detail-extra.tsx の SpecsItemV3 と同じ class と並び。
//   詳細：文を押すとその場で入力に替わる（Enter で決める・Esc でやめる）。直せるのはチェックが付いていない間だけ（D-150.55）。
//   出どころ knowledge の行は文と「外す」が押せない形（箱は押せる）。can_edit が false なら全部押せない形。
//   作る面：箱は押せない形（作る前に確かめた事は無い）・文は字だけ・「外す」で画面の中から消える。
//   押せない形（D-145.9）：在る・aria-disabled・薄さは正本の CSS・押しても Enter でも何も起きない
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Button, TextField } from "@/components/k";
import { SpecFromOf } from "@/features/F9/knowledge/spec-from";
import type { EditResult } from "./use-test-specs";
import { TEXT, titleProblem, trimTitle } from "./spec-text";

export interface SpecLineView {
  title: string;
  checked: boolean;
  /** 出どころ（manual・knowledge・ai）。作る面は無い */
  source?: string;
  /** 必ず守るから入った行の出どころのページ（K-726・印は F9 の部品が出す） */
  source_page?: { id: string; title: string } | null;
}
export interface SpecRowProps {
  line: SpecLineView;
  mode: "create" | "detail";
  /** 書ける（口の答えの meta.can_edit）。作る面は true */
  canEdit: boolean;
  /** この行に送っている途中 */
  busy?: boolean;
  /** 入力に替わっている */
  editing?: boolean;
  onCheck?: (checked: boolean) => void;
  onStartEdit?: () => void;
  onEndEdit?: () => void;
  onEdit?: (title: string) => Promise<EditResult>;
  onRemove: () => void;
}

const stop = (e: MouseEvent): void => e.preventDefault();

function SpecEditor({
  initial,
  onEdit,
  onEndEdit,
}: {
  initial: string;
  onEdit: SpecRowProps["onEdit"];
  onEndEdit: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const commit = async (): Promise<void> => {
    if (sending || !onEdit) return;
    const problem = titleProblem(text);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    const r = await onEdit(trimTitle(text));
    setSending(false);
    if (r === "ok" || r === "close") onEndEdit();
    else if (typeof r === "object") setError(r.field);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEndEdit();
    }
  };
  return (
    <div className="k-f4d-spec-edit">
      <TextField
        label="確認項目の文"
        name="spec_edit"
        value={text}
        autoFocus
        readOnly={sending}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        error={error}
      />
    </div>
  );
}

export function SpecRow({
  line,
  mode,
  canEdit,
  busy = false,
  editing = false,
  onCheck,
  onStartEdit,
  onEndEdit,
  onEdit,
  onRemove,
}: SpecRowProps) {
  const create = mode === "create";
  const knowledge = line.source === "knowledge";
  const boxOff = create || !canEdit;
  const textOff = !canEdit || line.checked || knowledge;
  const removeOff = !create && (!canEdit || knowledge);
  const textTitle = knowledge ? TEXT.knowledgeLock : line.checked ? TEXT.checkedLock : undefined;

  // 直せない形になった行（読み直しでチェックが付いた・出どころが替わった）は入力を閉じる
  useEffect(() => {
    if (editing && textOff) onEndEdit?.();
  }, [editing, textOff, onEndEdit]);

  return (
    <li data-done={line.checked}>
      <input
        type="checkbox"
        className="k-f4d-spec-box"
        checked={line.checked}
        aria-label={line.title}
        {...(boxOff ? { "aria-disabled": true } : {})}
        {...(create ? { title: TEXT.afterCreate } : {})}
        onChange={() => undefined}
        onClick={(e) => {
          if (boxOff || busy) {
            e.preventDefault();
            return;
          }
          onCheck?.(!line.checked);
        }}
      />
      {create ? (
        <span className="k-f4d-spec-text">{line.title}</span>
      ) : editing && !textOff ? (
        <SpecEditor initial={line.title} onEdit={onEdit} onEndEdit={() => onEndEdit?.()} />
      ) : (
        <button
          type="button"
          className="k-f4d-spec-btn"
          aria-label={`${line.title}を直す`}
          {...(textOff ? { "aria-disabled": true } : {})}
          {...(textTitle ? { title: textTitle } : {})}
          onClick={(e) => {
            if (textOff || busy) return stop(e);
            onStartEdit?.();
          }}
        >
          {line.title}
        </button>
      )}
      <SpecFromOf line={line} />
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${line.title}を外す`}
        {...(removeOff ? { "aria-disabled": true } : {})}
        {...(knowledge && !create ? { title: TEXT.knowledgeLock } : {})}
        onClick={(e) => {
          if (removeOff || busy) return stop(e);
          onRemove();
        }}
      >
        外す
      </Button>
    </li>
  );
}
