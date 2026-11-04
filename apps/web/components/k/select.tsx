"use client";
// 選ぶ（K-24・Base UI Select）。キーボード（↑↓・Enter・文字で飛ぶ）と読み上げは Base UI に任せる
import { Field } from "@base-ui/react/field";
import { Select as S } from "@base-ui/react/select";
import type { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps {
  label: ReactNode;
  name: string;
  options: SelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (v: string | null) => void;
  placeholder?: string;
  description?: ReactNode;
  error?: string | null | undefined;
  required?: boolean;
  disabled?: boolean;
}

export function Select({
  label,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "選ぶ",
  description,
  error,
  required,
  disabled,
}: SelectProps) {
  const labelOf = (v: string | null) => options.find((o) => o.value === v)?.label ?? placeholder;
  return (
    <Field.Root className="k-field" name={name} invalid={Boolean(error)} disabled={disabled}>
      <Field.Label className="k-label">{label}</Field.Label>
      <S.Root
        name={name}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onValueChange={(v) => onValueChange?.(v as string | null)}
        required={required}
        disabled={disabled}
      >
        <S.Trigger className="k-select-trigger">
          <S.Value>{(v: string | null) => labelOf(v)}</S.Value>
          <S.Icon aria-hidden="true">▾</S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Positioner sideOffset={4} alignItemWithTrigger={false}>
            <S.Popup className="k-select-popup">
              {options.map((o) => (
                <S.Item key={o.value} value={o.value} disabled={o.disabled} className="k-select-item">
                  <S.ItemIndicator className="k-select-check" keepMounted={false}>
                    ✓
                  </S.ItemIndicator>
                  <S.ItemText>{o.label}</S.ItemText>
                </S.Item>
              ))}
            </S.Popup>
          </S.Positioner>
        </S.Portal>
      </S.Root>
      {description ? <Field.Description className="k-desc">{description}</Field.Description> : null}
      {error ? (
        <Field.Error className="k-err" match>
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
