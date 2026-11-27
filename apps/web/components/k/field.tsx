"use client";
// 入力（K-24・正本 components.input）。見出し・説明・理由（422 の項目ごとの理由）を 1 つの組にする（Base UI Field）
//   理由は error に渡す（call() の fields[name] をそのまま）。読み上げは aria-describedby で Base UI がつなぐ
import { Field } from "@base-ui/react/field";
import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Common {
  label: ReactNode;
  description?: ReactNode;
  /** 項目名の横の括弧書きの補足（K-255・キャンバスの AuthSignup）。項目名の外に置き、読み上げの名前は項目名のまま。
   *  欄の説明として aria-describedby でつなぐ。括弧（）は部品が付ける */
  hint?: ReactNode;
  /** 項目の理由（サーバーの 422 か、画面での確かめ）。あれば赤く出す */
  error?: string | null | undefined;
  required?: boolean;
  name: string;
  /** 理由を読み上げの役 role="alert" で出す（画面の確かめの字を押したすぐ後に読ませる・K-1003）。既定は付けない（見た目は変わらない） */
  errorAlert?: boolean;
  /** 大きさ（K-218）：md＝作業の画面（既定・13px）・lg＝入口の画面（高さ 42・14px・項目名 500） */
  size?: "md" | "lg";
}

function Frame({
  label,
  description,
  hint,
  error,
  required,
  name,
  size = "md",
  errorAlert = false,
  children,
}: Common & { children: ReactNode }) {
  const head = (
    <Field.Label className="k-label">
      {label}
      {required ? (
        <span className="k-req" aria-hidden="true">
          *
        </span>
      ) : null}
    </Field.Label>
  );
  return (
    <Field.Root className="k-field" data-size={size} name={name} invalid={Boolean(error)}>
      {hint ? (
        <div className="k-label-row">
          {head}
          <Field.Description className="k-hint">（{hint}）</Field.Description>
        </div>
      ) : (
        head
      )}
      {children}
      {description ? <Field.Description className="k-desc">{description}</Field.Description> : null}
      {error ? (
        <Field.Error className="k-err" match {...(errorAlert ? { role: "alert" } : {})}>
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}

export type TextFieldProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "required" | "size">;
export function TextField({
  label,
  description,
  hint,
  error,
  required,
  name,
  size,
  errorAlert,
  ...input
}: TextFieldProps) {
  return (
    <Frame
      label={label}
      description={description}
      hint={hint}
      error={error}
      required={required}
      name={name}
      size={size}
      errorAlert={errorAlert ?? false}
    >
      <Field.Control className="k-input" required={required} aria-required={required || undefined} {...input} />
    </Frame>
  );
}

export type TextAreaProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "required">;
export function TextArea({
  label,
  description,
  hint,
  error,
  required,
  name,
  size,
  errorAlert,
  ...area
}: TextAreaProps) {
  return (
    <Frame
      label={label}
      description={description}
      hint={hint}
      error={error}
      required={required}
      name={name}
      size={size}
      errorAlert={errorAlert ?? false}
    >
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

export type PasswordFieldProps = Omit<TextFieldProps, "type">;
/** パスワード（D-087）：既定は隠す。押すと見え、もう一度押すと隠れる。読み上げの名前と aria-pressed も一緒に変わる。的は 24px 以上 */
export function PasswordField({
  label,
  description,
  hint,
  error,
  required,
  name,
  size,
  errorAlert,
  ...input
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <Frame
      label={label}
      description={description}
      hint={hint}
      error={error}
      required={required}
      name={name}
      size={size}
      errorAlert={errorAlert ?? false}
    >
      <div className="k-pw">
        <Field.Control
          className="k-input"
          type={shown ? "text" : "password"}
          required={required}
          aria-required={required || undefined}
          {...input}
        />
        <button
          type="button"
          className="k-pw-toggle"
          aria-pressed={shown}
          aria-label={shown ? "パスワードを隠す" : "パスワードを表示"}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </Frame>
  );
}
