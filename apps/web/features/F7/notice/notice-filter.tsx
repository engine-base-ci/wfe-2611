"use client";
// お知らせの絞り込み：「未読だけ」のチェックと「人で絞る ▾」（自分に知らせた人の一覧から 1 人）。
//   人の箱は components/k の Menu（キーボードと読み上げは Base UI）。
import { Check } from "lucide-react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import type { NoticePerson } from "./notice-types";

export interface NoticeFilterProps {
  onlyUnread: boolean;
  onOnlyUnread?: ((v: boolean) => void) | undefined;
  people: readonly NoticePerson[];
  /** 絞っている人。null は全員 */
  personId: string | null;
  onPerson?: ((id: string | null) => void) | undefined;
  /** 人の箱を開いておく（モックで中身を見せる） */
  peopleOpen?: boolean | undefined;
}

export function NoticeFilter({ onlyUnread, onOnlyUnread, people, personId, onPerson, peopleOpen }: NoticeFilterProps) {
  const current = people.find((p) => p.id === personId);
  return (
    <span className="k-f7-notice-filter">
      <label className="k-f7-notice-only">
        <input type="checkbox" checked={onlyUnread} onChange={(e) => onOnlyUnread?.(e.currentTarget.checked)} />
        未読だけ
      </label>
      <Menu defaultOpen={peopleOpen ?? false}>
        <MenuTrigger className="k-f7-notice-people" label="人で絞る">
          {current ? `${current.name} ▾` : "人で絞る ▾"}
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onSelect={() => onPerson?.(null)}>
            <span className="k-f7-notice-check">
              {personId === null ? <Check size={14} aria-hidden="true" /> : null}
            </span>
            全員
          </MenuItem>
          {people.map((p) => (
            <MenuItem key={p.id} onSelect={() => onPerson?.(p.id)}>
              <span className="k-f7-notice-check">
                {p.id === personId ? <Check size={14} aria-hidden="true" /> : null}
              </span>
              {p.name}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </span>
  );
}
