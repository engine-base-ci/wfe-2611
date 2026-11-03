"use client";
// 入力（KN-104・正本 components.input）。見出し・説明・理由（422 の項目ごとの理由）を 1 つの組にする（Base UI Field）
//   理由は error に渡す（call() の fields[name] をそのまま）。読み上げは aria-describedby で Base UI がつなぐ
import { Field } from "@base-ui-components/react/field";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface Common {
  label: ReactNode;
  description?: ReactNode;
  /** 項目の理由（サーバーの 422 か、画面での確かめ）。あれば赤く出す */
  error?: string | null | undefined;
  required?: boolean;
  name: string;
}

function Frame({ label, description, error, required, name, children }: Common & { children: ReactNode }) {
  return (
    <Field.Root className="k-field" name={name} invalid={Boolean(error)}>
      <Field.Label className="k-label">
        {label}
        {required ? (
          <span className="k-req" aria-hidden="true">
            *
          </span>
        ) : null}
      </Field.Label>
      {children}
      {description ? <Field.Description className="k-desc">{description}</Field.Description> : null}
      {error ? (
        <Field.Error className="k-err" match>
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}

export type TextFieldProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "required">;
export function TextField({ label, description, error, required, name, ...input }: TextFieldProps) {
  return (
    <Frame label={label} description={description} error={error} required={required} name={name}>
      <Field.Control className="k-input" required={required} aria-required={required || undefined} {...input} />
    </Frame>
  );
}

export type TextAreaProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "required">;
export function TextArea({ label, description, error, required, name, ...area }: TextAreaProps) {
  return (
    <Frame label={label} description={description} error={error} required={required} name={name}>
      <Field.Control
        render={<textarea />}
        className="k-input"
        required={required}
        aria-required={required || undefined}
        {...(area as object)}
      />
    </Frame>
  );
}
