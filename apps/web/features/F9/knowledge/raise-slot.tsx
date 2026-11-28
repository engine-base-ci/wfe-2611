"use client";
// K-692「上の棚に上げる」の差し込み（page-slots.ts の PAGE_SLOTS に 1 行）。acts.raise（頼む小窓を開く）・bands（取り下げる・お知らせを消す・直してもう一度頼む）・
//   overlay（頼む小窓 RaiseDialog と似たページの小窓）を返す。似たページの小窓が出ている間は頼む小窓を隠す。ページが無い間は何も渡さない
import { RaiseDialog } from "./dialogs";
import { pageTarget } from "./must-shape";
import type { PageCtx, PageSlot } from "./page-slots";
import { approverText, raiseFolderChoices } from "./raise-shape";
import { useRaise } from "./use-raise";

export function useRaiseSlot(ctx: PageCtx): PageSlot {
  const r = useRaise(ctx);
  const p = ctx.page;
  if (!p) return {};
  const s = r.state;
  const dialog =
    s?.open && !r.similarOpen ? (
      <RaiseDialog
        target={pageTarget(p.place, p.title)}
        to={s.to.shelf_name}
        approver={approverText(s.to.approver_names ?? [], s.to.shelf, s.to.shelf_name)}
        folders={[]}
        folderOptions={raiseFolderChoices(ctx.tree, s.to)}
        folder={s.folder}
        message={s.message}
        messageError={s.messageError}
        folderError={s.folderError}
        error={s.error}
        busy={s.busy}
        onFolder={r.setFolder}
        onMessage={r.setMessage}
        onSubmit={() => void r.submitRaise()}
        onClose={r.close}
      />
    ) : null;
  return {
    acts: { raise: r.openRaise },
    bands: {
      withdraw: (id) => void r.withdraw(id),
      dismiss: (id) => void r.dismiss(id),
      redo: r.openRaise,
    },
    bandBusy: r.bandBusy,
    overlay: (
      <>
        {dialog}
        {r.similarDialog}
      </>
    ),
  };
}
