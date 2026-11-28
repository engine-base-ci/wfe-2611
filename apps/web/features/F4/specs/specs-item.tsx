"use client";
// 確認項目の欄（K-450・項目の表の中の 1 つの項目）。行は「確かめること（文）とチェックの箱」だけ（D-150.39）。2 つの形で使う：
//   作る面（mode="create"）：行は画面の中だけに持ち、口を呼ばない。lines（文の並び・足した順・0〜50 件）と onChange で持つ（作るとき specs で送る・K-437）
//   詳細（mode="detail"）：閉じた形は「N 件 ・ 開く」だけ（N は getTicket の spec_count）。開くとき 1 回だけ listTestSpecs を読む。開いたあとは閉じない。
//     足す・付け外す・直す・外すは口の答えの meta.can_edit が true のときだけ。足す小窓は「＋ 確認項目を足す」か合図（kaname:f4:open-spec-add）で開く。
//     addOpen・onAddOpenChange を渡すと親が開閉を持つ（欄は合図を聞かない・畳んだままでも小窓は開く・K-571 が使う）
//   見た目の class は下絵の k-f4d-specs・k-f4d-spec-*（features/F4/doc/detail-extra.tsx の SpecsItemV3）。「AI の案を出す」は押せない形
import { useCallback, useRef, useState, type RefObject } from "react";
import { Button, Callout } from "@/components/k";
import "@/features/F4/doc/doc.css";
import "@/features/F4/doc/extra.css";
import { SpecAddDialog } from "./spec-add-dialog";
import { SpecRow } from "./spec-row";
import { MAX_SPECS, TEXT, refusalText } from "./spec-text";
import type { AddResult } from "./use-test-specs";
import { useOpenAddSignal } from "./use-open-add-signal";
import { useTestSpecs } from "./use-test-specs";

const GROUP = "確認項目の欄";

export type SpecsItemProps =
  | {
      mode: "create";
      /** 文の並び（足した順） */
      lines: readonly string[];
      onChange: (lines: string[]) => void;
    }
  | {
      mode: "detail";
      ticketId: string;
      /** 閉じた形に出す件数（getTicket の spec_count） */
      count: number;
      /** 渡すと親が足す小窓の開閉を持つ */
      addOpen?: boolean;
      onAddOpenChange?: (open: boolean) => void;
    };

interface ActsProps {
  addOff: boolean;
  addTitle?: string;
  onAdd: () => void;
  addRef: RefObject<HTMLButtonElement | null>;
}
function Acts({ addOff, addTitle, onAdd, addRef }: ActsProps) {
  return (
    <div className="k-f4d-spec-acts">
      <Button
        ref={addRef}
        variant="outlined"
        size="sm"
        {...(addOff ? { "aria-disabled": true } : {})}
        {...(addTitle ? { title: addTitle } : {})}
        onClick={() => {
          if (!addOff) onAdd();
        }}
      >
        ＋ 確認項目を足す
      </Button>
      <Button
        variant="outlined"
        size="sm"
        aria-disabled="true"
        tabIndex={-1}
        title={TEXT.notYet}
        onClick={() => undefined}
      >
        AI の案を出す
      </Button>
    </div>
  );
}

/** 小窓を閉じたらキーボードの場所を「＋ 確認項目を足す」に戻す */
function useReturnFocus(addRef: RefObject<HTMLButtonElement | null>) {
  return useCallback(() => {
    requestAnimationFrame(() => addRef.current?.focus());
  }, [addRef]);
}

function CreateSpecs({ lines, onChange }: { lines: readonly string[]; onChange: (lines: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const back = useReturnFocus(addRef);
  const full = lines.length >= MAX_SPECS;
  const add = (title: string): AddResult => {
    onChange([...lines, title]);
    return { ok: true, row: null };
  };
  return (
    <div className="k-f4d-specs" role="group" aria-label={GROUP}>
      {lines.length === 0 ? (
        <p className="k-f4d-hint">{TEXT.hint}</p>
      ) : (
        <ul className="k-f4d-spec-list" aria-label="確認項目">
          {lines.map((title, i) => (
            <SpecRow
              key={`${i}:${title}`}
              line={{ title, checked: false }}
              mode="create"
              canEdit
              onRemove={() => onChange(lines.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      <Acts addOff={full} {...(full ? { addTitle: TEXT.limit } : {})} onAdd={() => setOpen(true)} addRef={addRef} />
      <SpecAddDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) back();
        }}
        onAdd={add}
      />
    </div>
  );
}

function DetailSpecs({
  ticketId,
  count,
  addOpen,
  onAddOpenChange,
}: {
  ticketId: string;
  count: number;
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}) {
  const specs = useTestSpecs(ticketId);
  const [opened, setOpened] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const back = useReturnFocus(addRef);
  const controlled = addOpen !== undefined;
  const dialogOpen = controlled ? addOpen : ownOpen;
  const setDialog = (o: boolean): void => {
    if (!controlled) setOwnOpen(o);
    onAddOpenChange?.(o);
    if (!o) back();
  };
  const openSignal = useCallback(() => setOwnOpen(true), []);
  useOpenAddSignal(controlled ? null : ticketId, openSignal);
  const endEdit = useCallback(() => setEditingId(null), []);

  const open = (): void => {
    setOpened(true);
    void specs.load();
  };

  const dialog = <SpecAddDialog open={dialogOpen} onOpenChange={setDialog} onAdd={specs.add} />;

  if (!opened) {
    return (
      <div role="group" aria-label={GROUP}>
        <p className="k-f4d-hint">
          {`${count} 件 ・ `}
          <button type="button" className="k-f4d-link" onClick={open}>
            開く
          </button>
        </p>
        {dialog}
      </div>
    );
  }

  const failed = specs.state === "error";
  const addOff = specs.state !== "ok" || !specs.canEdit;
  return (
    <div
      className="k-f4d-specs"
      data-compact="true"
      role="group"
      aria-label={GROUP}
      aria-busy={specs.state === "loading" || undefined}
    >
      {failed ? (
        <Callout tone="danger">
          {refusalText({ kind: "failed", code: "E-PAGE-003", status: 503 })}
          <div>
            <Button variant="outlined" size="sm" onClick={() => void specs.load()}>
              読み直す
            </Button>
          </div>
        </Callout>
      ) : specs.state === "ok" && specs.rows.length === 0 ? (
        <p className="k-f4d-hint">{TEXT.hint}</p>
      ) : specs.rows.length > 0 ? (
        <ul className="k-f4d-spec-list" aria-label="確認項目">
          {specs.rows.map((row) => (
            <SpecRow
              key={row.id}
              line={row}
              mode="detail"
              canEdit={specs.canEdit}
              busy={specs.busy.has(row.id)}
              editing={editingId === row.id}
              onCheck={(checked) => specs.check(row, checked)}
              onStartEdit={() => setEditingId(row.id)}
              onEndEdit={endEdit}
              onEdit={(title) => {
                const latest = specs.rows.find((s) => s.id === row.id) ?? row;
                return specs.edit(latest, title);
              }}
              onRemove={() => specs.remove(row)}
            />
          ))}
        </ul>
      ) : null}
      <Acts addOff={addOff} onAdd={() => setDialog(true)} addRef={addRef} />
      {dialog}
    </div>
  );
}

export function SpecsItem(props: SpecsItemProps) {
  if (props.mode === "create") return <CreateSpecs lines={props.lines} onChange={props.onChange} />;
  return (
    <DetailSpecs
      ticketId={props.ticketId}
      count={props.count}
      {...(props.addOpen !== undefined ? { addOpen: props.addOpen } : {})}
      {...(props.onAddOpenChange ? { onAddOpenChange: props.onAddOpenChange } : {})}
    />
  );
}
