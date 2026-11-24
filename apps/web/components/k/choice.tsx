"use client";
// 丸い選択・四角い選択（K-642・正本 components.choice・choice-box）。画面はネイティブの丸・四角を直に書かず、ここだけを使う
//   label がネイティブの input を包む（読み上げ・キーボード・押す的はブラウザのまま）。印は「字の 1 行目の高さの箱」の縦の真ん中に置く
//   大きさ：sm＝小窓の中（12px・間 6px）／md＝本文（13px・間 8px・既定）／lg＝14px（間 8px）
//   字が無いときは label を描かず input だけ（aria-label が要る・表の行の頭の印など）
import {
  createContext,
  useContext,
  useState,
  type FieldsetHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";

type ChoiceSize = "sm" | "md" | "lg";

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "className"> {
  /** 字。無ければ印だけ（aria-label が要る） */
  children?: ReactNode;
  /** 1 行目の下に小さく出す説明 */
  description?: ReactNode;
  size?: ChoiceSize;
  /** label に足すクラス（字の無い印では input に足す） */
  className?: string;
  ref?: Ref<HTMLInputElement>;
}
export type CheckboxProps = ChoiceBaseProps;
export type RadioProps = ChoiceBaseProps;

interface GroupState {
  name: string;
  value: string | undefined;
  disabled: boolean;
  size: ChoiceSize | undefined;
  select: (value: string) => void;
}
const GroupContext = createContext<GroupState | null>(null);

function Choice({
  type,
  children,
  description,
  size = "md",
  className,
  disabled,
  ...input
}: ChoiceBaseProps & { type: "checkbox" | "radio" }) {
  const bare = children === undefined || children === null || children === false;
  // 字の無い印では className を input に足す（label を描かないため）
  const mark = (
    <input
      {...input}
      type={type}
      className={bare && className ? `k-choice-input ${className}` : "k-choice-input"}
      disabled={disabled}
    />
  );
  if (bare) return mark;
  return (
    <label
      className={className ? `k-choice ${className}` : "k-choice"}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
    >
      <span className="k-choice-box">{mark}</span>
      <span className="k-choice-text">{children}</span>
      {description ? <span className="k-choice-desc">{description}</span> : null}
    </label>
  );
}

export function Checkbox(props: CheckboxProps) {
  return <Choice {...props} type="checkbox" />;
}

export function Radio({ name, checked, disabled, size, onChange, value, ...rest }: RadioProps) {
  const group = useContext(GroupContext);
  if (!group) {
    return (
      <Choice
        {...rest}
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        size={size}
        onChange={onChange}
        value={value}
      />
    );
  }
  const v = value === undefined ? undefined : String(value);
  return (
    <Choice
      {...rest}
      type="radio"
      name={name ?? group.name}
      value={value}
      checked={checked ?? (group.value === undefined ? undefined : group.value === v)}
      disabled={disabled ?? group.disabled}
      size={size ?? group.size}
      onChange={(e) => {
        onChange?.(e);
        if (v !== undefined && e.target.checked) group.select(v);
      }}
    />
  );
}

export interface RadioGroupProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "onChange" | "defaultValue"
> {
  legend: ReactNode;
  /** 見出しを読み上げだけに出す */
  hideLegend?: boolean;
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: ChoiceSize;
  className?: string;
  children: ReactNode;
}

export function RadioGroup({
  legend,
  hideLegend = false,
  name,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  size,
  className,
  children,
  ...rest
}: RadioGroupProps) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const state: GroupState = {
    name,
    value: current,
    disabled,
    size,
    select: (v) => {
      if (value === undefined) setOwn(v);
      onValueChange?.(v);
    },
  };
  return (
    <fieldset className={className ? `k-choice-group ${className}` : "k-choice-group"} disabled={disabled} {...rest}>
      <legend className={hideLegend ? "sr-only" : undefined}>{legend}</legend>
      <GroupContext.Provider value={state}>{children}</GroupContext.Provider>
    </fieldset>
  );
}
