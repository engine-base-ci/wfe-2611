"use client";
// K-693「グループを選んで共有」の差し込み（page-slots.ts の PAGE_SLOTS に 1 行）。acts.share（選ぶ小窓を開く）と overlay（ShareDialog）を返す。
//   ページが無い間は何も渡さない。小窓の行・ボタンの字・外す注意は share-shape.ts が組む
import { ShareDialog } from "./dialogs";
import { pageTarget } from "./must-shape";
import type { PageCtx, PageSlot } from "./page-slots";
import { removeNote, shareDiff, shareRows, shareSubmitLabel } from "./share-shape";
import { useShare } from "./use-share";

export function useShareSlot(ctx: PageCtx): PageSlot {
  const sh = useShare(ctx);
  const p = ctx.page;
  if (!p) return {};
  const s = sh.state;
  let dialog = null;
  if (s) {
    const groups = s.groups ?? [];
    const diff = shareDiff(groups, s.selected);
    // 外した行の順（付け外しした順）
    const nameOf = new Map(groups.map((g) => [g.group_id, g.name]));
    const removedNames = s.touched.filter((id) => diff.removed.includes(id)).map((id) => nameOf.get(id) ?? "");
    dialog = (
      <ShareDialog
        target={pageTarget(p.place, p.title)}
        from={s.fromGroupName}
        groups={shareRows(groups, s.selected)}
        loading={s.loading}
        error={s.error}
        busy={s.busy}
        submitLabel={shareSubmitLabel(diff.added.length, diff.removed.length)}
        submitDisabled={!s.groups || (!diff.added.length && !diff.removed.length)}
        removeNote={removeNote(removedNames)}
        onToggle={sh.toggle}
        onSubmit={() => void sh.submitShare()}
        onClose={sh.close}
      />
    );
  }
  return { acts: { share: sh.openShare }, overlay: dialog };
}
