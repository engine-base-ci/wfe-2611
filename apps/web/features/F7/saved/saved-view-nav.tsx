"use client";
// 保存した検索条件の、左のメニューの並び（グループの行の下・キャンバス LsSave の「グループの下に並ぶ」・D-151.9）。値を受け取って描くだけ。
//   行を押すと開く。直す（名前を直す）・消すは「…」のメニュー（作った人かそのグループのマネージャーにだけ出す）。
//   bare：外枠がグループの行を描くとき（本番・K-479）。グループの行のリンクを描かず、グループ名の小さな見出しと並びだけを描く。
//   行の見た目は外枠の項目（.k-nav-item・.k-group-mark）と同じ値を、自前の名前（.k-f7-saved-nav-*）と正本のトークンで写した
import { Bookmark } from "lucide-react";
import type { MouseEvent } from "react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import "../overview/tones.css";

export interface SavedViewItem {
  id: string;
  name: string;
  /** グループの全員に見える（札「全員」を出す） */
  shared: boolean;
  /** いま開いている */
  current?: boolean;
  /** 直す・消すを出す（作った人かそのグループのマネージャー） */
  canEdit: boolean;
  /** 開く一覧の URL（無ければ見本の #view） */
  href?: string;
}

export interface SavedViewNavProps {
  group: { code: string; name: string; tone: string };
  views: readonly SavedViewItem[];
  /** 「…」を最初から開いておく行（モックで中身を見せる） */
  openMenuOf?: string;
  /** グループの行を描かない（外枠が描く） */
  bare?: boolean;
  /** 項目を押したとき（移る前に列と高さを覚える） */
  onOpen?: (id: string, e: MouseEvent<HTMLAnchorElement>) => void;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SavedViewNav({
  group,
  views,
  openMenuOf,
  bare = false,
  onOpen,
  onRename,
  onDelete,
}: SavedViewNavProps) {
  return (
    <div className="k-f7-saved-nav">
      {bare ? (
        <p className="k-f7-saved-sub" aria-hidden="true">
          {group.name}
        </p>
      ) : (
        <a className="k-f7-saved-nav-link" data-group={group.name} href="#group" title={group.name}>
          <span className="k-f7-saved-nav-mark" data-f7-tone={group.tone} aria-hidden="true">
            {group.code}
          </span>
          <span className="k-f7-saved-nav-label">{group.name}</span>
        </a>
      )}
      <ul className="k-f7-saved-nav-list" aria-label={`${group.name}の保存した検索条件`}>
        {views.map((v) => (
          <li key={v.id} className="k-f7-saved-nav-row">
            <a
              className="k-f7-saved-nav-link k-f7-saved-nav-item"
              href={v.href ?? "#view"}
              title={v.name}
              aria-current={v.current ? "page" : undefined}
              onClick={onOpen ? (e) => onOpen(v.id, e) : undefined}
            >
              <Bookmark size={14} aria-hidden="true" />
              <span className="k-f7-saved-nav-label">{v.name}</span>
              {v.shared ? (
                <span className="k-f7-saved-nav-share" title="グループの全員に見える">
                  全員
                </span>
              ) : null}
            </a>
            {v.canEdit ? (
              <Menu defaultOpen={openMenuOf === v.id}>
                <MenuTrigger label={`${v.name}の操作`} className="k-f7-saved-nav-more">
                  …
                </MenuTrigger>
                <MenuPopup>
                  <MenuItem onSelect={onRename ? () => onRename(v.id) : undefined}>名前を直す</MenuItem>
                  <MenuItem onSelect={onDelete ? () => onDelete(v.id) : undefined}>消す</MenuItem>
                </MenuPopup>
              </Menu>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
