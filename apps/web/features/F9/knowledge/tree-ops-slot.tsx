"use client";
// K-684 木の操作と「…」の差し込み（page-slots.ts の PAGE_SLOTS に 1 行）。
//   more＝「…」の 4 項目（動かす・消すは口の答えの acts に edit があるときだけ）・add＝木の「＋」と空の木の「最初のページを書く」・
//   overlay＝いま開いている小窓（無ければ null：他の葉の小窓の邪魔をしない）。ページが無い間は add だけ渡す
import type { ReactNode } from "react";
import { useNotify } from "@/components/k";
import { DocView } from "@/features/F4/doc/editor";
import type { PageCtx, PageSlot } from "./page-slots";
import { AddDialog, DeleteDialog, MoveDialog, VersionsDialog } from "./tree-ops";
import type { PageAnswer } from "./shape";
import { TEXT, shelfNameOf, useTreeOps, type UseTreeOps } from "./use-tree-ops";
import type { MoreItem } from "./types";

const placeLine = (p: PageAnswer): string => [p.place.shelf_name, ...p.place.folders, p.title].join(" › ");

function Overlay({ ops, ctx }: { ops: UseTreeOps; ctx: PageCtx }): ReactNode {
  const d = ops.dialog;
  const p = ops.page;
  switch (d.kind) {
    case "add":
      return (
        <AddDialog
          shelf={shelfNameOf(ctx.tree, d.target)}
          kind={d.addKind}
          name={d.name}
          folders={ops.options}
          folder={d.folder}
          error={d.fieldError}
          notice={d.notice}
          busy={ops.busy}
          onKind={(addKind) => ops.setAdd({ addKind })}
          onName={(name) => ops.setAdd({ name })}
          onFolder={(folder) => ops.setAdd({ folder })}
          onSubmit={() => void ops.submitAdd()}
          onClose={ops.close}
        />
      );
    case "move":
      return p ? (
        <MoveDialog
          target={placeLine(p)}
          folders={ops.options}
          folder={d.folder}
          error={d.notice}
          busy={ops.busy}
          submitDisabled={d.folder === ops.currentFolder}
          onFolder={ops.setMoveFolder}
          onSubmit={() => void ops.submitMove()}
          onClose={ops.close}
        />
      ) : null;
    case "delete":
      return p ? (
        <DeleteDialog
          target={placeLine(p)}
          error={d.notice}
          busy={ops.busy}
          onSubmit={() => void ops.submitDelete()}
          onClose={ops.close}
        />
      ) : null;
    case "versions":
      return p ? (
        <VersionsDialog
          target={placeLine(p)}
          versions={d.list ?? []}
          selected={d.selected}
          error={d.notice}
          empty={d.list && d.list.length === 0 ? TEXT.noVersions : undefined}
          onSelect={ops.pickVersion}
          onClose={ops.close}
        >
          {d.body ? <DocView doc={d.body} /> : null}
        </VersionsDialog>
      ) : null;
    default:
      return null;
  }
}

export function useTreeOpsSlot(ctx: PageCtx): PageSlot {
  const notify = useNotify();
  const ops = useTreeOps(ctx, (text) => notify(text, { type: "error" }));
  const overlay = ops.dialog.kind === "none" ? null : <Overlay ops={ops} ctx={ctx} />;
  const page = ctx.page;
  const canEdit = Boolean(page?.acts.includes("edit"));
  const more: Partial<Record<MoreItem, () => void>> | undefined = page
    ? {
        versions: ops.openVersions,
        "copy-link": () => void ops.copyLink(),
        ...(canEdit ? { move: ops.openMove, delete: ops.openDelete } : {}),
      }
    : undefined;
  return { add: ops.openAdd, overlay, ...(more ? { more } : {}) };
}
