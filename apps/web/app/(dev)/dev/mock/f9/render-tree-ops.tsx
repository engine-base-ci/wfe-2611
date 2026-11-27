"use client";
// 段 10 の下絵：木の操作と「…」メニューの 5 状態（K-684・下絵 v2 に無かった物を足した・字は仮）。
//   外枠付きの描き方は render-knowledge.tsx の物を使う。本文は段 5 の DocView（K-670 の INVOICE_DOC）
import type { ReactNode } from "react";
import { AddDialog, DeleteDialog, MoveDialog, VersionsDialog } from "@/features/F9/knowledge/tree-ops";
import { DocView } from "@/features/F4/doc/editor";
import { PageView } from "@/features/F9/knowledge/page-views";
import { EXPENSE, INVOICE, INVOICE_DOC, PLACE, treeFor } from "@/features/F9/knowledge/samples";
import type { Theme } from "@/lib/theme";
import { KnowledgeFrame } from "./frame";
import { ADMIN_TAKA, expense } from "./render-knowledge";

const FOLDERS = [
  { value: "root", label: "（会社の棚の直下）" },
  { value: "f-keiri", label: "経理" },
  { value: "f-cs", label: "お客さま対応" },
];

function invoice(theme: Theme, o: { moreOpen?: boolean; dialog?: ReactNode }): ReactNode {
  return (
    <KnowledgeFrame
      theme={theme}
      viewer="taka"
      path={["会社", "経理", INVOICE.title]}
      tree={{ data: treeFor("taka"), current: "p-invoice", admin: ADMIN_TAKA }}
      dialog={o.dialog}
    >
      <PageView
        place={PLACE.invoice}
        title={INVOICE.title}
        desc={INVOICE.desc}
        acts={["must-on", "edit"]}
        must
        moreOpen={Boolean(o.moreOpen)}
        foot={INVOICE.foot}
        doc={INVOICE_DOC}
      />
    </KnowledgeFrame>
  );
}

/** K-684 が描く 5 つの状態。持っていない id は null */
export function renderTreeOps(id: string, theme: Theme): ReactNode | null {
  switch (id) {
    case "kn-more":
      return invoice(theme, { moreOpen: true });
    case "kn-add":
      return invoice(theme, {
        dialog: <AddDialog shelf="会社" kind="page" name="" folders={FOLDERS} folder="f-keiri" />,
      });
    case "kn-move":
      return invoice(theme, {
        dialog: <MoveDialog target={`会社 › 経理 › ${INVOICE.title}`} folders={FOLDERS} folder="f-cs" />,
      });
    case "kn-delete":
      return expense(theme, {
        must: false,
        dialog: <DeleteDialog target={`会社 › 経理 › ${EXPENSE.title}`} />,
      });
    case "kn-versions":
      return invoice(theme, {
        dialog: (
          <VersionsDialog
            target={`会社 › 経理 › ${INVOICE.title}`}
            versions={[
              { version: 4, at: "11/18", by: "高本 聖斗" },
              { version: 3, at: "11/02", by: "佐藤 花子" },
              { version: 2, at: "10/20", by: "高本 聖斗" },
              { version: 1, at: "10/05", by: "高本 聖斗" },
            ]}
            selected={3}
          >
            <DocView doc={INVOICE_DOC} />
          </VersionsDialog>
        ),
      });
    default:
      return null;
  }
}
