"use client";
// チケットの設定「項目」を足す・消す（K-720）の状態と口：足す（createTicketField・K-706）・消す（deleteTicketField・K-717）。
//   開いている小窓（足す・消す・なし）・足す小窓の値・欄の誤り・赤い箱・送っている間を持つ（更新は新しい値を作って入れ替える）。
//   出し分け：入力の確かめと 409 E-FMS-001（名前）・E-FMS-004（選ぶ物）は欄の下／404・403・503・網の切れは小窓の赤い箱。
//   どの失敗でも小窓は閉じず、入れた中身は残る。通ったら項目を 1 回読み直す（種別は読み直さない）
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { fieldCreateBody, newFieldDraft } from "./field-edit-shape";
import { addOption, fieldProblems, removeOption, type FieldAnswer, type FieldDraft } from "./fields-shape";
import type { FieldCtx } from "./fields-slots";
import { FIELDS_KEY, useFieldMaster } from "./use-fields";

const SCREEN = "masters";
/** 種別の読みの鍵（K-707 の useKinds と分け合う） */
const KINDS_KEY = ["k707", "kinds"] as const;
/** 欄に結ぶ断り（それ以外は赤い箱） */
const FIELD_OF: Record<string, "name" | "options"> = { "E-FMS-001": "name", "E-FMS-004": "options" };

export interface AddErrors {
  name?: string | undefined;
  options?: string | undefined;
  kinds?: string | undefined;
}
export type EditDialog =
  | { kind: "none" }
  | { kind: "add"; draft: FieldDraft; errors: AddErrors; error?: string | undefined }
  | { kind: "delete"; id: string; name: string; count: number; error?: string | undefined };

const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 口の断り（網の切れは null）→ 正本の ID */
function failureCode(err: CallErr | null): string {
  if (!err) return PAGE_ERROR.loadFailed;
  if (err.code in CATALOG) return err.code;
  if (err.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(err);
}
const trimText = (s: string): string => s.replace(/^\s+|\s+$/g, "");
const byPosition = (xs: readonly FieldAnswer[]): FieldAnswer[] =>
  [...xs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

/** 小窓の中の欄に焦点を移す（描いた後に） */
function focusInDialog(selector: string): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`.k-dialog ${selector}`)?.focus());
}
const FIRST_ERROR: Record<keyof AddErrors, string> = {
  name: 'input[name="new_field_name"]',
  options: 'input[aria-label^="選ぶ物 "]',
  kinds: 'fieldset:last-of-type input[type="checkbox"]',
};

export function useFieldEdit(ctx: FieldCtx) {
  const qc = useQueryClient();
  const master = useFieldMaster();
  const [dialog, setDialog] = useState<EditDialog>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const allKindIds = ctx.kinds.map((k) => k.id);

  // 閉じたら焦点を押した所へ戻す
  const open = dialog.kind !== "none";
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && opener.current?.isConnected) opener.current.focus();
    wasOpen.current = open;
  }, [open]);

  const remember = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const close = () => {
    if (!sending.current) setDialog({ kind: "none" });
  };

  /** 送る（二度押しでも 1 回） */
  const guarded = async (job: () => Promise<void>, onNetwork: () => void) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await job();
    } catch {
      onNetwork(); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- 足す
  const openAdd = () => {
    remember();
    setDialog({ kind: "add", draft: newFieldDraft(allKindIds), errors: {} });
  };
  /** 足す小窓の値を替える（直した欄の赤字は消す） */
  const change = (p: Partial<FieldDraft>, clear?: keyof AddErrors) =>
    setDialog((d) =>
      d.kind === "add"
        ? { ...d, draft: { ...d.draft, ...p }, errors: clear ? { ...d.errors, [clear]: undefined } : d.errors }
        : d,
    );
  const addDraft = dialog.kind === "add" ? dialog.draft : undefined;
  // 消えた種別のチェックは持たない（読み直した種別の中だけ）
  const draftNow: FieldDraft | undefined = addDraft && {
    ...addDraft,
    kindIds: addDraft.kindIds.filter((id) => allKindIds.includes(id)),
  };
  const setAddError = (p: { errors?: AddErrors; error?: string }) =>
    setDialog((d) => (d.kind === "add" ? { ...d, errors: p.errors ?? {}, error: p.error } : d));

  const submitAdd = () => {
    if (!draftNow) return;
    const problems = fieldProblems(draftNow);
    const first = (["name", "options", "kinds"] as const).find((k) => problems[k]);
    if (first) {
      setAddError({ errors: problems });
      focusInDialog(FIRST_ERROR[first]);
      return;
    }
    const body = fieldCreateBody(draftNow, allKindIds);
    void guarded(
      async () => {
        setAddError({});
        const r = await call("createTicketField", {
          body: body as unknown as Ops["createTicketField"]["body"],
          screenId: SCREEN,
        });
        if (r.ok) {
          setDialog({ kind: "none" });
          ctx.notify(`項目「${body.name}」を足しました`);
          await qc.invalidateQueries({ queryKey: FIELDS_KEY });
          const id = (r.data as { id?: string } | undefined)?.id;
          if (id) ctx.select(id);
          return;
        }
        const at = FIELD_OF[r.code];
        if (at) return setAddError({ errors: { [at]: msgOf(r.code) } });
        if (r.status === 404) void qc.invalidateQueries({ queryKey: KINDS_KEY }); // 開いている間に種別が消された
        setAddError({ error: msgOf(failureCode(r)) });
      },
      () => setAddError({ error: msgOf(failureCode(null)) }),
    );
  };

  // ---------------------------------------------------------------- 消す
  const openDelete = (id: string) => {
    const row = ctx.fields.find((f) => f.id === id);
    if (!row) return;
    remember();
    const count = master.data?.find((f) => f.id === id)?.value_count ?? 0;
    setDialog({ kind: "delete", id, name: row.name, count });
  };
  const setDeleteError = (error: string | undefined) => setDialog((d) => (d.kind === "delete" ? { ...d, error } : d));

  const submitDelete = () => {
    if (dialog.kind !== "delete") return;
    const { id, name } = dialog;
    void guarded(
      async () => {
        setDeleteError(undefined);
        const r = await call("deleteTicketField", { params: { id }, screenId: SCREEN });
        if (r.ok) {
          setDialog({ kind: "none" });
          ctx.notify(`項目「${trimText(name)}」を消しました`);
          await qc.invalidateQueries({ queryKey: FIELDS_KEY });
          const rest = byPosition(qc.getQueryData<FieldAnswer[]>(FIELDS_KEY) ?? []);
          if (rest[0]) ctx.select(rest[0].id);
          return;
        }
        if (r.status === 404) void qc.invalidateQueries({ queryKey: FIELDS_KEY }); // もう消されていた
        setDeleteError(msgOf(failureCode(r)));
      },
      () => setDeleteError(msgOf(failureCode(null))),
    );
  };

  return {
    dialog,
    draft: draftNow,
    busy,
    openAdd,
    openDelete,
    close,
    submitAdd,
    submitDelete,
    setName: (name: string) => change({ name }, "name"),
    setType: (type: string) => change({ type }, "options"),
    setOption: (i: number, name: string) =>
      change({ options: (addDraft?.options ?? []).map((o, j) => (j === i ? { ...o, name } : o)) }, "options"),
    addOption: () => {
      const next = addOption(addDraft?.options ?? []);
      change({ options: next }, "options");
      focusInDialog(`input[aria-label="選ぶ物 ${next.length}"]`);
    },
    removeOption: (i: number) => change({ options: removeOption(addDraft?.options ?? [], i) }, "options"),
    setRequired: (required: boolean) => change({ required }),
    setDescription: (description: string) => change({ description }),
    setKind: (id: string, on: boolean) =>
      change(
        {
          kindIds: on
            ? [...(draftNow?.kindIds ?? []).filter((k) => k !== id), id]
            : (draftNow?.kindIds ?? []).filter((k) => k !== id),
        },
        "kinds",
      ),
  };
}

export type FieldEdit = ReturnType<typeof useFieldEdit>;
