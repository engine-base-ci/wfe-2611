"use client";
// チケットの設定「項目」の入れ物（K-709・読む口は K-706・直す口は K-717・種別は K-707 の useKinds）：
//   一覧（?id= で選ぶ）・右の欄（名前・型・選ぶ物・必須・説明・どの種別で出すか）・保存。項目を足す・消すは差し込み口（fields-slots.ts）。
//   見た目は views.tsx の FieldsPanel（モック /dev/mock/f9/set-fields と同じ部品）に値と動きを渡すだけ。
//   出し分け：入力の確かめと 409 E-FMS-001（名前）・E-FMS-004（選ぶ物）・E-FMS-002（型）はその欄の下／
//   503・網の切れ・403・404・E-FMS-005 は欄の上の赤い箱。どれも書いた中身は残し、押し直せる
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, Empty, ErrorState, Loading, PAGE_ERROR, errorCodeOf, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import {
  fieldDraftOf,
  fieldPatch,
  fieldProblems,
  shapeFields,
  type FieldAnswer,
  type FieldDraft,
  type FieldProblems,
} from "./fields-shape";
import { FIELD_SLOTS, isInertField, mergeFieldSlots } from "./fields-slots";
import { shapeKinds } from "./kinds-shape";
import { useUnsaved } from "./unsaved-guard";
import { FIELDS_KEY, useFieldMaster, useSaveField } from "./use-fields";
import { useKinds } from "./use-kinds";
import { FieldsPanel, type FieldsLive } from "./views";

const RETRY = "もう一度読む";
const EMPTY = "会社が足した項目はまだありません";

/** タブの中身が受け取る物（K-707 の SettingsPanelProps と同じ形） */
export interface FieldsContainerProps {
  id: string | undefined;
  hrefOf: (id: string) => string;
  select: (id: string) => void;
  onForbidden: () => void;
}

type Errors = { [K in keyof FieldProblems | "type"]?: string | undefined };

const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 口の断り（網の切れは null）→ 正本の ID */
function failureCode(err: CallErr | null): string {
  if (!err) return PAGE_ERROR.loadFailed;
  if (err.code in CATALOG) return err.code;
  if (err.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(err);
}
/** 欄に結ぶ断り（それ以外は赤い箱） */
const FIELD_OF: Record<string, keyof Errors> = { "E-FMS-001": "name", "E-FMS-004": "options", "E-FMS-002": "type" };
const trimText = (s: string): string => s.replace(/^\s+|\s+$/g, "");

function Loader() {
  return (
    <div role="status" aria-label="読み込んでいます…">
      <Loading delayMs={0} />
    </div>
  );
}

/** タブを離れたら項目だけ捨てる（戻ると読み直す）。StrictMode の付け外しでは見ている物が残るので捨てない */
function useDropFieldsOnLeave() {
  const qc = useQueryClient();
  useEffect(
    () => () => {
      setTimeout(() => {
        const q = qc.getQueryCache().find({ queryKey: FIELDS_KEY });
        if (q && q.getObserversCount() === 0) qc.removeQueries({ queryKey: FIELDS_KEY });
      }, 0);
    },
    [qc],
  );
}

export function FieldsContainer({ id, hrefOf, select, onForbidden }: FieldsContainerProps) {
  const fieldsQ = useFieldMaster();
  const kindsQ = useKinds();
  const save = useSaveField();
  const notify = useNotify();
  const { setDirty } = useUnsaved();
  useDropFieldsOnLeave();

  const kindRows = useMemo(() => shapeKinds(kindsQ.data ?? []), [kindsQ.data]);
  const allKindIds = useMemo(() => kindRows.map((k) => k.id), [kindRows]);
  const answers = useMemo(
    () => [...(fieldsQ.data ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [fieldsQ.data],
  );
  const rows = useMemo(() => shapeFields(answers, kindRows), [answers, kindRows]);
  const current: FieldAnswer | undefined = answers.find((f) => f.id === id) ?? answers[0];

  const [edit, setEdit] = useState<{ id: string; draft: FieldDraft } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  // 差し込み（別の葉の足す・消す）。描きのたびに同じ順で呼ぶので、早く返る前に呼ぶ
  const slot = mergeFieldSlots(FIELD_SLOTS, {
    fields: rows,
    kinds: kindRows,
    selectedId: current?.id,
    select,
    reload: () => void fieldsQ.refetch(),
    notify: (text) => notify(text),
  });

  const currentId = current?.id;
  // 項目が替わったら前の項目の直しと赤字を捨てる（前の項目の字を残さない）
  useEffect(() => {
    setEdit((e) => (e && e.id !== currentId ? null : e));
    setErrors({});
  }, [currentId]);

  const forbidden = fieldsQ.error?.result?.status === 403 || kindsQ.error?.result?.status === 403;
  useEffect(() => {
    if (forbidden) onForbidden();
  }, [forbidden, onForbidden]);

  const draft: FieldDraft | undefined =
    current && (edit && edit.id === current.id ? edit.draft : fieldDraftOf(current, allKindIds));
  const patch = current && draft ? fieldPatch(current, draft, allKindIds) : {};
  const dirty = Object.keys(patch).length > 0;
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  if (fieldsQ.isPending || kindsQ.isPending || forbidden) return <Loader />;
  const loadErr = (fieldsQ.isError && !fieldsQ.data) || (kindsQ.isError && !kindsQ.data);
  if (loadErr) {
    const err = (fieldsQ.isError ? fieldsQ.error.result : kindsQ.error?.result) ?? null;
    return (
      <div className="k-f9s-stack">
        <ErrorState code={failureCode(err)} />
        <div>
          <Button
            onClick={() => {
              void fieldsQ.refetch();
              void kindsQ.refetch();
            }}
          >
            {RETRY}
          </Button>
        </div>
      </div>
    );
  }

  const addInert = isInertField(slot, "add");
  if (!current || !draft) {
    return (
      <div className="k-f9s-stack">
        <Empty title={EMPTY} />
        <div>
          <Button variant="outlined" size="sm" {...(addInert ? { "aria-disabled": true } : {})} onClick={slot.add}>
            項目を足す
          </Button>
        </div>
        {slot.overlay ?? null}
      </div>
    );
  }

  const change = (p: Partial<FieldDraft>, clear?: keyof Errors) => {
    setEdit({ id: current.id, draft: { ...draft, ...p } });
    if (clear) setErrors((e) => (e[clear] ? { ...e, [clear]: undefined } : e));
  };

  const onSave = async () => {
    if (saving.current || !dirty) return;
    const problems = fieldProblems(draft);
    if (Object.keys(problems).length > 0) return setErrors(problems);
    saving.current = true;
    setBusy(true);
    setNotice(undefined);
    setErrors({});
    const r = await save(current.id, patch);
    saving.current = false;
    setBusy(false);
    if (r.ok) {
      setEdit(null);
      notify(`項目「${trimText(draft.name)}」を保存しました`);
      return;
    }
    const at = r.err ? FIELD_OF[r.err.code] : undefined;
    if (at && r.err) return setErrors({ [at]: msgOf(r.err.code) });
    setNotice(msgOf(failureCode(r.err)));
  };

  const live: FieldsLive = {
    draft,
    typeLocked: (current.value_count ?? 0) > 0,
    errors,
    notice,
    canSave: dirty && !busy,
    addInert,
    deleteInert: isInertField(slot, "delete"),
    onName: (name) => change({ name }, "name"),
    onType: (type) => change({ type }, "type"),
    onOptions: (options) => change({ options: [...options] }, "options"),
    onRequired: (required) => change({ required }),
    onDescription: (description) => change({ description }),
    onKinds: (kindIds) => change({ kindIds: [...kindIds] }, "kinds"),
    onSave: () => void onSave(),
    onAdd: () => slot.add?.(),
    onDelete: () => slot.delete?.(current.id),
  };

  return (
    <>
      <FieldsPanel
        fields={rows}
        current={current.id}
        kinds={kindRows}
        hrefOf={hrefOf}
        onSelect={(to) => {
          if (to === current.id) return;
          setNotice(undefined);
          select(to);
        }}
        live={live}
      />
      {slot.overlay ?? null}
    </>
  );
}
