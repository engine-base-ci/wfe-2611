"use client";
// チケットの設定「項目」の差し込み（K-720）：「項目を足す」「この項目を消す…」に動きを渡し、小窓（field-dialogs.tsx）を重ねる。
//   fields-slots.ts の FIELD_SLOTS に 1 行で入る。入れ物の描きのたびに同じ順で呼ばれる（中で React のフックを使う）
import { FieldAddDialog, FieldDeleteDialog } from "./field-dialogs";
import { deleteCaution } from "./field-edit-shape";
import { typeKey, typeLabel } from "./fields-shape";
import type { FieldCtx, FieldSlot } from "./fields-slots";
import { useFieldEdit, type FieldEdit } from "./use-field-edit";
import type { KindRow, Tone } from "./views";

const DEFAULT_TONE: Tone = "indigo";

function Overlay({ e, kinds }: { e: FieldEdit; kinds: readonly KindRow[] }) {
  const d = e.dialog;
  if (d.kind === "add" && e.draft) {
    return (
      <FieldAddDialog
        name={e.draft.name}
        type={typeLabel(e.draft.type)}
        options={e.draft.options.map((o) => o.name)}
        required={e.draft.required}
        desc={e.draft.description}
        kinds={kinds}
        kindIds={e.draft.kindIds}
        errors={d.errors}
        error={d.error}
        busy={e.busy}
        onName={e.setName}
        onType={(t) => e.setType(typeKey(t))}
        onOption={e.setOption}
        onAddOption={e.addOption}
        onRemoveOption={e.removeOption}
        onRequired={e.setRequired}
        onDesc={e.setDescription}
        onKind={e.setKind}
        onSubmit={e.submitAdd}
        onClose={e.close}
      />
    );
  }
  if (d.kind === "delete") {
    return (
      <FieldDeleteDialog
        name={d.name}
        caution={deleteCaution(d.count)}
        error={d.error}
        busy={e.busy}
        onSubmit={e.submitDelete}
        onClose={e.close}
      />
    );
  }
  return null;
}

export function useFieldEditSlot(ctx: FieldCtx): FieldSlot {
  const e = useFieldEdit(ctx);
  // 入れ物は種別の行（色つき）を渡す。色が無い形で来たときは既定の色にする
  const kinds: KindRow[] = ctx.kinds.map((k) => ({ tone: DEFAULT_TONE, hasTemplate: false, ...k }));
  return {
    add: e.openAdd,
    delete: e.openDelete,
    ...(e.dialog.kind !== "none" ? { overlay: <Overlay e={e} kinds={kinds} /> } : {}),
  };
}
