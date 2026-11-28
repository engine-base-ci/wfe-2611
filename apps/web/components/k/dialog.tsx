"use client";
// ダイアログ（K-24・Base UI Dialog）。開くと中に動き、Esc で閉じ、閉じると押した所に戻る（Base UI が持つ）
//   取り消せない操作の確かめは Confirm（主ボタンは danger・開いたときは「やめる」に動く）
//   形はキャンバスの StModal（K-218）：頭に題と右上の ×（名前「閉じる」）・下に線。足は上に線とボタン。
//   閉じる手段は頭の × と Esc。足に「閉じる」を重ねて置かない（同じ名前のボタンを 2 つにしない）。
//   開いたときのフォーカスは本文の最初の欄、無ければ足の最初のボタン、どちらも無ければ小窓そのもの（× には置かない）。
//   取り消せない確かめ（Confirm）は × を持たない（キャンバスの「承認して送ります」）。閉じるのは足の「やめる」と Esc
//   置き場と幅（K-229・キャンバス）：上から 60px・左右の真ん中。幅は size（form＝420・confirm＝380・connect＝580（PC をつなぐ・K-230）。どれも画面の幅 − 48px まで）。
//   題の見出しの段（titleLevel・既定 2。小窓が画面の主役のときは 1）と、頭の題の下の補足（subtitle・読み上げの説明につなぐ）を持てる（K-230）。
//   Confirm は tone（主ボタン primary｜danger）・caution（赤い箱）・children（チェックなど）・confirmDisabled を持つ。赤い箱と説明は小窓の説明（読み上げ）につなぐ。
//   答えを待つ間（busy）は「やめる」も押せず、Esc でも閉じない（2 回目を送らせない）
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useCallback, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "./button";

const CLOSE_LABEL = "閉じる";
// 押せない欄（disabled・aria-disabled="true"）には乗らない（K-229：差し戻しの「どこを直すか」でなく「差し戻す理由」に乗る）
const USABLE = ":not(:disabled):not([aria-disabled=true])";
const FIRST_FIELD = [
  `.k-dialog-body input:not([type=hidden])${USABLE}`,
  `.k-dialog-body textarea${USABLE}`,
  `.k-dialog-body select${USABLE}`,
  `.k-dialog-body [role=combobox]${USABLE}`,
].join(", ");
const FIRST_ACTION = ".k-dialog-actions button:not(:disabled), .k-dialog-actions a[href]";

function CloseIcon() {
  return <X aria-hidden="true" size={16} />;
}

export interface DialogProps {
  title: ReactNode;
  description?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 開くボタン（Button など 1 つの要素） */
  trigger?: ReactElement<Record<string, unknown>>;
  children?: ReactNode;
  /** 足のボタン（右寄せ・やめる／決める）。無ければ足を出さない */
  actions?: ReactNode;
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」・12px・灰） */
  target?: ReactNode;
  /** 幅：form＝420（既定）・confirm＝380・connect＝580 */
  size?: DialogSize;
  /** 題の見出しの段（既定 2）。開くと後ろが読み上げから外れ、小窓が画面の主役になるときは 1（K-230） */
  titleLevel?: 1 | 2;
  /** 頭の題の下の補足（12px・灰）。description が無ければ読み上げの説明につなぐ（K-230） */
  subtitle?: ReactNode;
}
export type DialogSize = "form" | "confirm" | "connect";

export function Dialog({
  title,
  description,
  open,
  onOpenChange,
  trigger,
  children,
  actions,
  target,
  size = "form",
  titleLevel = 2,
  subtitle,
}: DialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  // 最初のフォーカス：本文の最初の欄 → 足の最初のボタン → 小窓そのもの（× に乗せて Enter で閉じないように）
  const firstFocus = useCallback((): HTMLElement | null => {
    const root = popupRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>(FIRST_FIELD) ?? root.querySelector<HTMLElement>(FIRST_ACTION) ?? root;
  }, []);
  return (
    <D.Root {...(open !== undefined ? { open } : {})} onOpenChange={(o) => onOpenChange?.(o)}>
      {trigger ? <D.Trigger render={trigger} /> : null}
      <D.Portal>
        <D.Backdrop className="k-backdrop" />
        <D.Popup ref={popupRef} className="k-dialog" data-size={size} initialFocus={firstFocus}>
          <div className="k-dialog-head">
            {subtitle ? (
              <div className="k-dialog-titles">
                <D.Title className="k-dialog-title" render={titleLevel === 1 ? <h1 /> : <h2 />}>
                  {title}
                </D.Title>
                {description ? (
                  <div className="k-dialog-sub">{subtitle}</div>
                ) : (
                  <D.Description className="k-dialog-sub" render={<div />}>
                    {subtitle}
                  </D.Description>
                )}
              </div>
            ) : (
              <D.Title className="k-dialog-title" render={titleLevel === 1 ? <h1 /> : <h2 />}>
                {title}
              </D.Title>
            )}
            <D.Close className="k-dialog-close" aria-label={CLOSE_LABEL}>
              <CloseIcon />
            </D.Close>
          </div>
          {description || children || target ? (
            <div className="k-dialog-body">
              {target ? <p className="k-dialog-target">{target}</p> : null}
              {description ? <D.Description className="k-dialog-desc">{description}</D.Description> : null}
              {children}
            </div>
          ) : null}
          {actions ? <div className="k-dialog-actions">{actions}</div> : null}
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}

export interface ConfirmProps {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** 答えを待っている間：主ボタンは処理中・「やめる」も押せず、Esc でも閉じない */
  busy?: boolean;
  /** 主ボタンの色：danger（既定・消すなど）・primary（承認して送る・K-229） */
  tone?: "danger" | "primary";
  /** 取り消せない注意（赤い箱）。1 行ずつ */
  caution?: readonly string[];
  /** 本文のチェックなど */
  children?: ReactNode;
  /** 主ボタンを押せない（目で見たに印が無い など） */
  confirmDisabled?: boolean;
}
export function Confirm({
  title,
  description,
  confirmLabel,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  tone = "danger",
  caution,
  children,
  confirmDisabled = false,
}: ConfirmProps) {
  // 開いたときは取り消しの側（やめる）に動く
  const cancelRef = useRef<HTMLButtonElement>(null);
  const hasBody = Boolean(description || children || caution?.length);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return; // 答えを待つ間は閉じない
        onOpenChange(o);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="k-backdrop" />
        <AlertDialog.Popup className="k-dialog" data-size="confirm" initialFocus={cancelRef}>
          <div className="k-dialog-head">
            <AlertDialog.Title className="k-dialog-title">{title}</AlertDialog.Title>
          </div>
          {hasBody ? (
            <div className="k-dialog-body">
              {/* 注意の赤い箱と説明は 1 つの説明（aria-describedby）にまとめ、開いたときの読み上げにつなぐ（K-229） */}
              {caution?.length || description ? (
                <AlertDialog.Description render={<div className="k-dialog-describe" />}>
                  {caution?.length ? (
                    <div className="k-dialog-caution">
                      {caution.map((c, i) => (
                        <p key={i}>{c}</p>
                      ))}
                    </div>
                  ) : null}
                  {description ? <p className="k-dialog-desc">{description}</p> : null}
                </AlertDialog.Description>
              ) : null}
              {children}
            </div>
          ) : null}
          <div className="k-dialog-actions">
            <AlertDialog.Close
              disabled={busy}
              render={
                <Button ref={cancelRef} variant="outlined" disabled={busy}>
                  やめる
                </Button>
              }
            />
            <Button
              variant={tone}
              loading={busy}
              disabled={confirmDisabled}
              onClick={() => {
                if (!busy && !confirmDisabled) onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
