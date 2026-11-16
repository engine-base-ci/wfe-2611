"use client";
// ダイアログ（K-24・Base UI Dialog）。開くと中に動き、Esc で閉じ、閉じると押した所に戻る（Base UI が持つ）
//   取り消せない操作の確かめは Confirm（主ボタンは danger・開いたときは「やめる」に動く）
//   形はキャンバスの StModal（K-218）：頭に題と右上の ×（名前「閉じる」）・下に線。足は上に線とボタン。
//   閉じる手段は頭の × と Esc。足に「閉じる」を重ねて置かない（同じ名前のボタンを 2 つにしない）。
//   開いたときのフォーカスは本文の最初の欄、無ければ足の最初のボタン、どちらも無ければ小窓そのもの（× には置かない）。
//   取り消せない確かめ（Confirm）は × を持たない（キャンバスの「承認して送ります」）。閉じるのは足の「やめる」と Esc
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useCallback, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "./button";

const CLOSE_LABEL = "閉じる";
const FIRST_FIELD =
  ".k-dialog-body input:not([type=hidden]):not(:disabled), .k-dialog-body textarea:not(:disabled), .k-dialog-body select:not(:disabled), .k-dialog-body [role=combobox]";
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
}

export function Dialog({ title, description, open, onOpenChange, trigger, children, actions }: DialogProps) {
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
        <D.Popup ref={popupRef} className="k-dialog" initialFocus={firstFocus}>
          <div className="k-dialog-head">
            <D.Title className="k-dialog-title">{title}</D.Title>
            <D.Close className="k-dialog-close" aria-label={CLOSE_LABEL}>
              <CloseIcon />
            </D.Close>
          </div>
          {description || children ? (
            <div className="k-dialog-body">
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
  description: ReactNode;
  confirmLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
}
export function Confirm({ title, description, confirmLabel, open, onOpenChange, onConfirm, busy }: ConfirmProps) {
  // 開いたときは取り消しの側（やめる）に動く
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="k-backdrop" />
        <AlertDialog.Popup className="k-dialog" initialFocus={cancelRef}>
          <div className="k-dialog-head">
            <AlertDialog.Title className="k-dialog-title">{title}</AlertDialog.Title>
          </div>
          <div className="k-dialog-body">
            <AlertDialog.Description className="k-dialog-desc">{description}</AlertDialog.Description>
          </div>
          <div className="k-dialog-actions">
            <AlertDialog.Close
              render={
                <Button ref={cancelRef} variant="outlined">
                  やめる
                </Button>
              }
            />
            <Button variant="danger" loading={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
