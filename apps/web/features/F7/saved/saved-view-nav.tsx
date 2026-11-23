"use client";
// 保存した検索条件の、左のメニューの並び（グループの行の下・キャンバス LsSave の「グループの下に並ぶ」・D-151.9）。値を受け取って描くだけ。
//   行を押すと開く。直す（名前を直す）・消すは「…」のメニュー（作った人かそのグループのマネージャーにだけ出す）。
//   外枠（Shell）はグループの下に差し込む口をまだ持たない。本番では外枠の差し込み口（頼むこと）に、この並びが入る。
//   行の見た目は外枠の項目（.k-nav-item・.k-group-mark）と同じ
import { Bookmark } from "lucide-react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";

export interface SavedViewItem {
  id: string;
  name: string;
  /** グループの全員に見える（札「全員」を出す） */
  shared: boolean;
  /** いま開いている */
  current?: boolean;
  /** 直す・消すを出す（作った人かそのグループのマネージャー） */
  canEdit: boolean;
}

export interface SavedViewNavProps {
  group: { code: string; name: string; tone: string };
  views: readonly SavedViewItem[];
  /** 「…」を最初から開いておく行（モックで中身を見せる） */
  openMenuOf?: string;
}

export function SavedViewNav({ group, views, openMenuOf }: SavedViewNavProps) {
  return (
    <div className="k-f7-saved-nav">
      <a className="k-nav-item" data-group={group.name} href="#group" title={group.name}>
        <span className="k-group-mark" data-tone={group.tone} aria-hidden="true">
          {group.code}
        </span>
        <span className="k-nav-label">{group.name}</span>
      </a>
      <ul className="k-f7-saved-nav-list" aria-label={`${group.name}の保存した検索条件`}>
        {views.map((v) => (
          <li key={v.id} className="k-f7-saved-nav-row">
            <a
              className="k-nav-item k-f7-saved-nav-item"
              href="#view"
              title={v.name}
              aria-current={v.current ? "page" : undefined}
            >
              <Bookmark size={14} aria-hidden="true" />
              <span className="k-nav-label">{v.name}</span>
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
                  <MenuItem>名前を直す</MenuItem>
                  <MenuItem>消す</MenuItem>
                </MenuPopup>
              </Menu>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
