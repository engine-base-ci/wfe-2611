"use client";
// 詳細の「…」のメニュー（F7・段 8・A116・キャンバス TdMore）。段 8 が持つのは「消す」の項目だけ。
//   箱の中のほかの項目（複製・移す・種別・ひな形・リンク・版・実行の記録）は段 5 が作る：others に渡す（MoreMenuSlot に入る形）。
//   段 5 が箱を作るまでは、この部品が「…」の箱ごと出し、中は「消す」だけ（切り方 Q9）。
//   消せるのは作った人かそのグループで edit を持つ人（D-151.14）。持たない人には「消す」を押せない形で出し、訳は指を置くと読める。
//   アーカイブは作らない（D-151.20）。字も出さない
import type { ReactNode } from "react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import "./delete.css";

export interface DeleteMenuProps {
  /** 消せる人か */
  canDelete: boolean;
  /** 消せない訳（指を置くと読める） */
  deniedReason?: string | undefined;
  /** 箱の中の、段 5 の項目（消すの上に並ぶ） */
  others?: ReactNode;
  /** 最初から開いておく（モックで中身を見せる） */
  defaultOpen?: boolean;
  onDelete?: (() => void) | undefined;
}

export function DeleteMenu({ canDelete, deniedReason, others, defaultOpen = false, onDelete }: DeleteMenuProps) {
  return (
    <Menu defaultOpen={defaultOpen}>
      <MenuTrigger className="k-btn k-detail-more k-f7-del-more" label="ほかの操作">
        …
      </MenuTrigger>
      <MenuPopup align="end" className="k-f7-del-menu">
        {others}
        {others ? <div role="separator" className="k-f7-del-sep" /> : null}
        <MenuItem
          disabled={!canDelete}
          className="k-f7-del-item k-f7-del-danger"
          {...(canDelete ? { onSelect: onDelete } : {})}
        >
          <span {...(!canDelete && deniedReason ? { title: deniedReason } : {})}>消す</span>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
