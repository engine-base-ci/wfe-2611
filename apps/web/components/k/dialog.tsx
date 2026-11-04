"use client";
// ダイアログ（K-24・Base UI Dialog）。開くと中に動き、Esc で閉じ、閉じると押した所に戻る（Base UI が持つ）
//   取り消せない操作の確かめは Confirm（主ボタンは danger・既定は「やめる」に動く）
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as D } from "@base-ui/react/dialog";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./button";

export interface DialogProps {
  title: ReactNode;
  description?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 開くボタン（Button など 1 つの要素） */
  trigger?: ReactElement<Record<string, unknown>>;
  children?: ReactNode;
  actions?: ReactNode;
}

export function Dialog({ title, description, open, onOpenChange, trigger, children, actions }: DialogProps) {
  return (
    <D.Root {...(open !== undefined ? { open } : {})} onOpenChange={(o) => onOpenChange?.(o)}>
      {trigger ? <D.Trigger render={trigger} /> : null}
      <D.Portal>
        <D.Backdrop className="k-backdrop" />
        <D.Popup className="k-dialog">
          <D.Title className="k-dialog-title">{title}</D.Title>
          {description ? <D.Description className="k-dialog-desc">{description}</D.Description> : null}
          {children}
          <div className="k-dialog-actions">
            {actions ?? <D.Close render={<Button variant="ghost">閉じる</Button>} />}
          </div>
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
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="k-backdrop" />
        <AlertDialog.Popup className="k-dialog">
          <AlertDialog.Title className="k-dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="k-dialog-desc">{description}</AlertDialog.Description>
          <div className="k-dialog-actions">
            <AlertDialog.Close render={<Button variant="ghost">やめる</Button>} />
            <Button variant="danger" loading={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
