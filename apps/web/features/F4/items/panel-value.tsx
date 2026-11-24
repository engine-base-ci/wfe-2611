"use client";
// 詳細のパネルの会社の項目の 1 行の値（K-1153）。値のボタン（button.k-f4d-valbtn・名前「〈項目の名前〉を直す」）を押すと、
//   その行が div.k-f4d-editcell の中の入力（K-569 の CustomInput・説明は出さない）に替わる。決めると 1 項目だけを送る：
//   短い文字・数・日付＝入力の Enter（form の送信に頼らない）／長い文章・複数選ぶ＝「〈名前〉を決める」／選ぶ＝選んだとき。
//   入力から外れても決めない。Esc で何も送らずにやめる（選ぶ欄の一覧の中から伝わった Esc は一覧を閉じるだけ）。
//   チェックは値のボタンを使わず箱で、押した時点で箱を新しい形にして送る（断られたら元に戻す）。
//   誤りの文はどれも CustomInput の error に渡す（枠が誤りの色になり .k-err は部品が出す）
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, useNotify } from "@/components/k";
import { CustomInput } from "./custom-input";
import { checkField, toValue, type FieldValue, type TicketField } from "./field-values";
import { show } from "./field-show";
import type { SaveResult } from "./use-field-save";

export interface PanelField extends TicketField {
  value: FieldValue;
}

export interface Saver {
  save: (field: TicketField, value: FieldValue) => Promise<SaveResult>;
  busy: string | null;
}

export interface PanelValueProps {
  field: PanelField;
  saver: Saver;
  onReload: () => void;
}

const same = (a: FieldValue, b: FieldValue): boolean => JSON.stringify(a) === JSON.stringify(b);
/** 決めるボタンで決める型（Enter では決めない） */
const BY_BUTTON = new Set(["long_text", "multi_select"]);
const BY_ENTER = new Set(["short_text", "number", "date"]);

export function PanelValue(p: PanelValueProps) {
  return p.field.field_type === "check" ? <CheckValue {...p} /> : <EditValue {...p} />;
}

/** 断りを受けた後、手元の状態に何をするか（チェックと入力で共通） */
function useOutcome(onReload: () => void) {
  const notify = useNotify();
  return (r: SaveResult, on: { field: (t: string) => void; revert: () => void }): void => {
    if (r.kind === "field") on.field(r.text);
    else if (r.kind === "gone") {
      on.field(r.text);
      onReload();
    } else if (r.kind === "toast") {
      notify(r.text);
      if (r.revert) on.revert();
    }
  };
}

function CheckValue({ field: f, saver, onReload }: PanelValueProps) {
  const [cur, setCur] = useState<FieldValue>(f.value);
  const [err, setErr] = useState<string | null>(null);
  const outcome = useOutcome(onReload);
  useEffect(() => setCur(f.value), [f.value]);

  const onChange = async (next: FieldValue): Promise<void> => {
    const local = checkField(f, next);
    if (local) {
      setErr(local);
      return;
    }
    const prev = cur;
    setCur(next);
    setErr(null);
    const r = await saver.save(f, toValue(f, next));
    if (r.kind === "ok") return;
    // 断られた・送れなかったときは、どれも箱を元に戻す（403・503 は知らせ、ほかは箱の下に文）
    setCur(prev);
    outcome(r, { field: setErr, revert: () => undefined });
  };
  return (
    <CustomInput field={f} value={cur} error={err} disabled={saver.busy === f.id} onChange={(v) => void onChange(v)} />
  );
}

function EditValue({ field: f, saver, onReload }: PanelValueProps) {
  const [cur, setCur] = useState<FieldValue>(f.value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FieldValue>(f.value);
  const [err, setErr] = useState<string | null>(null);
  const [backToButton, setBackToButton] = useState(false);
  const cell = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const outcome = useOutcome(onReload);

  // 読み直した答え（f.value が替わったとき）だけを映す。閉じたときに古い答えで上書きしない
  const seen = useRef(f.value);
  useEffect(() => {
    if (seen.current === f.value) return;
    seen.current = f.value;
    if (!editing) setCur(f.value);
  }, [f.value, editing]);
  useEffect(() => {
    if (backToButton && !editing) {
      btn.current?.focus();
      setBackToButton(false);
    }
  }, [backToButton, editing]);

  const close = (): void => {
    setEditing(false);
    setErr(null);
  };
  const open = (): void => {
    setDraft(cur);
    setErr(null);
    setEditing(true);
  };
  const commit = async (v: FieldValue): Promise<void> => {
    const local = checkField(f, v);
    if (local) {
      setErr(local);
      return;
    }
    const out = toValue(f, v);
    if (same(out, toValue(f, cur))) {
      close();
      return;
    }
    const r = await saver.save(f, out);
    if (r.kind === "ok") {
      setCur(out);
      close();
      return;
    }
    outcome(r, { field: setErr, revert: close });
  };
  const onCellKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "Escape") return;
    // 選ぶ欄の一覧（portal）から伝わった Esc は一覧を閉じるだけ
    if (!cell.current?.contains(e.target as Node)) return;
    if (saver.busy === f.id) return;
    e.preventDefault();
    close();
    setBackToButton(true);
  };
  const onInputKey = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key !== "Enter" || !BY_ENTER.has(f.field_type) || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void commit(draft);
  };

  if (!editing) {
    const text = show(f, cur);
    return (
      <button ref={btn} type="button" className="k-f4d-valbtn" aria-label={`${f.name}を直す`} onClick={open}>
        {f.field_type === "long_text" ? <span className="k-pre">{text}</span> : text}
      </button>
    );
  }
  const busy = saver.busy === f.id;
  return (
    <div className="k-f4d-editcell" ref={cell} onKeyDown={onCellKey}>
      <CustomInput
        field={f}
        value={draft}
        error={err}
        disabled={busy}
        allowNone
        hideDescription
        autoFocus
        onKeyDown={onInputKey}
        onChange={(v) => {
          setDraft(v);
          if (f.field_type === "select") void commit(v);
        }}
      />
      {BY_BUTTON.has(f.field_type) ? (
        <Button variant="outlined" size="sm" disabled={busy} onClick={() => void commit(draft)}>
          {`${f.name}を決める`}
        </Button>
      ) : null}
    </div>
  );
}
