"use client";
// まとめて承認（K-769）の確かめの小窓。並びは下絵の BulkConfirm（more/dialogs.tsx）と同じ：題・取り消せない物の注意・
//   チェックの無い確認項目の区画（0 件なら出さない）・足の［やめる］と［N 件を承認する］。スマホでは下から出す（more.css の印）
import type { ReactNode } from "react";
import { Confirm } from "@/components/k";
import {
  PENDING_DETAIL,
  confirmLabel,
  confirmTitle,
  irreversibleText,
  uncheckedText,
  type BulkScope,
} from "./bulk-words";
import type { BulkPreview } from "./use-bulk";

export interface BulkApproveConfirmProps {
  scope: BulkScope;
  preview: BulkPreview;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkApproveConfirm({
  scope,
  preview,
  busy,
  error,
  onConfirm,
  onCancel,
}: BulkApproveConfirmProps): ReactNode {
  const count = preview.eligible.length;
  return (
    <Confirm
      open
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      onConfirm={onConfirm}
      busy={busy}
      tone="primary"
      title={confirmTitle(scope, count)}
      confirmLabel={confirmLabel(count)}
      {...(preview.irreversible_count > 0 ? { caution: [irreversibleText(preview.irreversible_count)] } : {})}
    >
      <i className="k-more-sheetmark" hidden aria-hidden="true" />
      {preview.unchecked_count > 0 ? (
        <fieldset className="k-more-pending">
          <p>{uncheckedText(preview.unchecked_count)}</p>
          <p className="k-more-detail">{PENDING_DETAIL}</p>
        </fieldset>
      ) : null}
      {error ? (
        <p className="k-err" role="alert">
          {error}
        </p>
      ) : null}
    </Confirm>
  );
}
