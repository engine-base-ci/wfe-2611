"use client";
// チケットの設定「項目」の小窓（K-720・下絵 v2 に無かった物を足した・字は仮）：項目を足す・項目を消す確かめ。
//   見た目だけ（値は props・口は呼ばない）。押す関数は任意の props（無ければモックの形＝欄は読むだけ）。
//   「消す」の注意の文は呼ぶ側が作って渡す（値の数で変わるので、この部品は文を持たない）
import { Plus } from "lucide-react";
import { Button, Confirm, Dialog, NoticeBox, Select, TextField } from "@/components/k";
import type { FieldType, KindRow } from "./views";
import "./settings.css";

const noop = (): void => undefined;

/** 型の字（views.tsx の FieldsPanel の型と同じ 7 つ） */
const TYPES: readonly FieldType[] = ["1 行", "複数行", "数", "金額", "日付", "1 つ選ぶ", "複数選ぶ", "チェック"];
const isOptionType = (t: FieldType): boolean => t === "1 つ選ぶ" || t === "複数選ぶ";

// ---------------------------------------------------------------- 項目を足す
export interface FieldAddProps {
  name: string;
  type: FieldType;
  /** 選ぶ物の名前（選ぶ型のときだけ欄を出す） */
  options: readonly string[];
  required: boolean;
  desc: string;
  /** 今ある種別（どの種別で出すかのチェックの並び） */
  kinds: readonly KindRow[];
  /** チェックが付いている種別の id */
  kindIds: readonly string[];
  /** 欄の下の赤字（口の断り・入力の確かめ） */
  errors?: { name?: string | undefined; options?: string | undefined; kinds?: string | undefined };
  /** 小窓の上の赤い箱（口の断りのうち欄に結べない物） */
  error?: string | undefined;
  busy?: boolean;
  onName?: (v: string) => void;
  onType?: (t: FieldType) => void;
  onOption?: (index: number, v: string) => void;
  onAddOption?: () => void;
  onRemoveOption?: (index: number) => void;
  onRequired?: (v: boolean) => void;
  onDesc?: (v: string) => void;
  onKind?: (id: string, on: boolean) => void;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function FieldAddDialog(p: FieldAddProps) {
  const live = Boolean(p.onName);
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title="項目を足す"
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose ?? noop} disabled={p.busy}>
            やめる
          </Button>
          <Button onClick={p.onSubmit ?? noop} loading={Boolean(p.busy)}>
            足す
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
        <TextField
          label="名前"
          name="new_field_name"
          value={p.name}
          required
          error={p.errors?.name}
          {...(p.onName ? { onChange: (e) => p.onName?.(e.target.value) } : { readOnly: true })}
        />
        <Select
          label="型"
          name="new_field_type"
          options={TYPES.map((t) => ({ value: t, label: t }))}
          value={p.type}
          onValueChange={(v) => (v ? p.onType?.(v as FieldType) : undefined)}
        />
        {isOptionType(p.type) ? (
          <fieldset className="k-f9s-options">
            <legend className="k-label">選ぶ物</legend>
            <ul>
              {p.options.map((o, i) => (
                <li key={i}>
                  <input
                    className="k-input"
                    value={o}
                    aria-label={`選ぶ物 ${i + 1}`}
                    aria-invalid={p.errors?.options ? true : undefined}
                    {...(p.onOption ? { onChange: (e) => p.onOption?.(i, e.target.value) } : { readOnly: true })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`選ぶ物 ${i + 1}を外す`}
                    onClick={() => p.onRemoveOption?.(i)}
                  >
                    外す
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="outlined" size="sm" icon={<Plus size={14} />} onClick={p.onAddOption ?? noop}>
              選ぶ物を足す
            </Button>
            {p.errors?.options ? <p className="k-err">{p.errors.options}</p> : null}
          </fieldset>
        ) : null}
        <label className="k-f9s-check">
          <input
            type="checkbox"
            {...(live
              ? { checked: p.required, onChange: (e) => p.onRequired?.(e.target.checked) }
              : { defaultChecked: p.required })}
          />
          必須にする（入れないとチケットを作れません）
        </label>
        <TextField
          label="説明"
          name="new_field_desc"
          value={p.desc}
          description="入力の下に小さく出ます。AI もこの説明を読みます。"
          {...(p.onDesc ? { onChange: (e) => p.onDesc?.(e.target.value) } : { readOnly: true })}
        />
        <fieldset className="k-f9s-options">
          <legend className="k-label">どの種別で出すか</legend>
          <div className="k-f9s-kinds">
            {p.kinds.map((k) => (
              <label key={k.id} className="k-f9s-check">
                <input
                  type="checkbox"
                  {...(live
                    ? { checked: p.kindIds.includes(k.id), onChange: (e) => p.onKind?.(k.id, e.target.checked) }
                    : { defaultChecked: p.kindIds.includes(k.id) })}
                />
                <span className="k-f9s-dot" data-tone={k.tone} aria-hidden="true" />
                {k.name}
              </label>
            ))}
          </div>
          {p.errors?.kinds ? <p className="k-err">{p.errors.kinds}</p> : null}
        </fieldset>
        <p className="k-f9s-hint">足したあとも、名前・必須・説明・選ぶ物はいつでも直せます。</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 項目を消す確かめ
export interface FieldDeleteProps {
  name: string;
  /** 赤い箱に 1 行ずつ出す注意（値が見えなくなる数・元に戻せないこと） */
  caution: readonly string[];
  /** 口の断り（あれば確かめの中に赤い箱） */
  error?: string | undefined;
  busy?: boolean;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function FieldDeleteDialog(p: FieldDeleteProps) {
  return (
    <Confirm
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title={`項目「${p.name}」を消しますか`}
      caution={p.caution}
      confirmLabel="消す"
      busy={Boolean(p.busy)}
      onConfirm={p.onSubmit ?? noop}
    >
      {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
    </Confirm>
  );
}
